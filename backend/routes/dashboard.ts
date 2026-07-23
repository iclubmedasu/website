import express from 'express';
import { prisma } from '../db';

const router: any = express.Router();

type Urgency = 'OVERDUE' | 'DUE_SOON' | 'DUE_THIS_WEEK' | 'LATER';

function computeUrgency(dueDate: Date | null, now: Date): Urgency {
    if (!dueDate) return 'LATER';
    if (dueDate < now) return 'OVERDUE';
    const ms48h = 48 * 60 * 60 * 1000;
    if (dueDate.getTime() <= now.getTime() + ms48h) return 'DUE_SOON';
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    if (dueDate.getTime() <= now.getTime() + ms7d) return 'DUE_THIS_WEEK';
    return 'LATER';
}

/** Event tasks use scheduled timing, not deadlines — never OVERDUE. */
function computeEventTaskSchedule(taskDate: Date | null, now: Date): Urgency {
    if (!taskDate) return 'LATER';
    if (taskDate < now) return 'LATER';
    const ms48h = 48 * 60 * 60 * 1000;
    if (taskDate.getTime() <= now.getTime() + ms48h) return 'DUE_SOON';
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    if (taskDate.getTime() <= now.getTime() + ms7d) return 'DUE_THIS_WEEK';
    return 'LATER';
}

function parsePositiveInt(query: unknown, defaultValue: number): number {
    if (query === undefined || query === null || query === '') return defaultValue;
    const n = parseInt(String(query), 10);
    if (!Number.isFinite(n) || n <= 0) return defaultValue;
    return n;
}

// ============================================
// GET /api/dashboard/my-tasks
// Query: limit? (default 8)
// ============================================
router.get('/my-tasks', async (req, res) => {
    try {
        if (!req.user.memberId) {
            return res.status(400).json({ error: 'memberId required' });
        }

        const memberId = req.user.memberId;
        const limit = parsePositiveInt(req.query.limit, 8);
        const now = new Date();

        const [projectAssignments, eventAssignments] = await Promise.all([
            prisma.taskAssignment.findMany({
                where: {
                    memberId,
                    task: {
                        isActive: true,
                        status: { notIn: ['COMPLETED', 'CANCELLED'] },
                    },
                },
                include: {
                    task: {
                        select: {
                            id: true,
                            title: true,
                            dueDate: true,
                            priority: true,
                            project: {
                                select: { id: true, title: true },
                            },
                        },
                    },
                },
            }),
            prisma.eventTaskAssignment.findMany({
                where: {
                    memberId,
                    eventTask: {
                        isActive: true,
                        event: {
                            status: { not: 'CANCELLED' },
                            isArchived: false,
                        },
                    },
                },
                include: {
                    eventTask: {
                        select: {
                            id: true,
                            title: true,
                            taskDate: true,
                            location: true,
                            event: {
                                select: { id: true, title: true },
                            },
                        },
                    },
                },
            }),
        ]);

        const projectItems = projectAssignments.map((assignment) => {
            const { task } = assignment;
            return {
                id: `task-${task.id}`,
                kind: 'PROJECT_TASK' as const,
                title: task.title,
                dueDate: task.dueDate ? task.dueDate.toISOString() : null,
                parentTitle: task.project.title,
                parentId: task.project.id,
                parentType: 'project' as const,
                urgency: computeUrgency(task.dueDate, now),
                _sortDate: task.dueDate as Date | null,
            };
        });

        const seenEventTaskIds = new Set<number>();
        const eventItems: Array<{
            id: string;
            kind: 'EVENT_TASK';
            title: string;
            dueDate: string | null;
            parentTitle: string;
            parentId: number;
            parentType: 'event';
            urgency: Urgency;
            _sortDate: Date | null;
        }> = [];

        for (const assignment of eventAssignments) {
            const { eventTask } = assignment;
            if (seenEventTaskIds.has(eventTask.id)) continue;
            seenEventTaskIds.add(eventTask.id);
            eventItems.push({
                id: `eventtask-${eventTask.id}`,
                kind: 'EVENT_TASK',
                title: eventTask.title,
                dueDate: eventTask.taskDate ? eventTask.taskDate.toISOString() : null,
                parentTitle: eventTask.event.title,
                parentId: eventTask.event.id,
                parentType: 'event',
                urgency: computeEventTaskSchedule(eventTask.taskDate, now),
                _sortDate: eventTask.taskDate,
            });
        }

        const merged = [...projectItems, ...eventItems];
        merged.sort((a, b) => {
            if (a._sortDate === null && b._sortDate === null) return 0;
            if (a._sortDate === null) return 1;
            if (b._sortDate === null) return -1;
            return a._sortDate.getTime() - b._sortDate.getTime();
        });

        const totalCount = merged.length;
        const overdueCount = merged.filter(
            (item) => item.kind === 'PROJECT_TASK' && item.urgency === 'OVERDUE',
        ).length;

        const items = merged.slice(0, limit).map(({ _sortDate, ...rest }) => rest);

        return res.json({ items, totalCount, overdueCount });
    } catch (error) {
        console.error('GET /dashboard/my-tasks', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard tasks' });
    }
});

// ============================================
// GET /api/dashboard/my-activities
// Query: days? (default 14), limit? (default 20)
// ============================================
router.get('/my-activities', async (req, res) => {
    try {
        if (!req.user.memberId) {
            return res.status(400).json({ error: 'memberId required' });
        }

        const memberId = req.user.memberId;
        const days = parsePositiveInt(req.query.days, 14);
        const limit = parsePositiveInt(req.query.limit, 20);
        const now = new Date();
        const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        // Shared with my-tasks: active, non-archived, non-cancelled events.
        const eventParticipationFilter = {
            isActive: true,
            isArchived: false,
            status: { not: 'CANCELLED' as const },
        };

        // Registrations only: upcoming/ongoing within the window (include multi-day events already started).
        const eventRegistrationFilter = {
            ...eventParticipationFilter,
            eventEndDate: { gte: now },
            eventDate: { lte: windowEnd },
        };

        const projectFilter = {
            isActive: true,
            isArchived: false,
        };

        const projectSelect = {
            id: true,
            slug: true,
            title: true,
            startDate: true,
            createdAt: true,
        } as const;

        const eventSelect = {
            id: true,
            slug: true,
            title: true,
            eventDate: true,
            eventEndDate: true,
            venue: true,
        } as const;

        const [
            registrations,
            eventAssignments,
            createdEvents,
            teamMemberships,
            createdProjects,
            projectTaskAssignments,
        ] = await Promise.all([
            prisma.eventRegistration.findMany({
                where: {
                    memberId,
                    status: { not: 'CANCELLED' },
                    event: eventRegistrationFilter,
                },
                select: { event: { select: eventSelect } },
            }),
            prisma.eventTaskAssignment.findMany({
                where: {
                    memberId,
                    eventTask: {
                        isActive: true,
                        event: eventParticipationFilter,
                    },
                },
                select: {
                    eventTask: {
                        select: { event: { select: eventSelect } },
                    },
                },
            }),
            prisma.event.findMany({
                where: {
                    createdByMemberId: memberId,
                    ...eventParticipationFilter,
                },
                select: eventSelect,
            }),
            prisma.teamMember.findMany({
                where: { memberId, isActive: true },
                select: { teamId: true },
            }),
            prisma.project.findMany({
                where: {
                    createdByMemberId: memberId,
                    ...projectFilter,
                },
                select: projectSelect,
            }),
            prisma.taskAssignment.findMany({
                where: {
                    memberId,
                    task: {
                        isActive: true,
                        status: { notIn: ['COMPLETED', 'CANCELLED'] },
                        project: projectFilter,
                    },
                },
                select: {
                    task: {
                        select: { project: { select: projectSelect } },
                    },
                },
            }),
        ]);

        const teamIds = teamMemberships.map((row) => row.teamId);
        const teamProjects =
            teamIds.length > 0
                ? await prisma.projectTeam.findMany({
                      where: {
                          teamId: { in: teamIds },
                          project: projectFilter,
                      },
                      select: { project: { select: projectSelect } },
                  })
                : [];

        type EventAgg = {
            id: number;
            slug: string;
            title: string;
            eventDate: Date;
            eventEndDate: Date;
            venue: string | null;
            viaRegistration: boolean;
            viaTaskAssignment: boolean;
            viaCreated: boolean;
        };

        const eventsById = new Map<number, EventAgg>();

        const upsertEvent = (
            event: {
                id: number;
                slug: string;
                title: string;
                eventDate: Date;
                eventEndDate: Date;
                venue: string | null;
            },
            flags: Partial<Pick<EventAgg, 'viaRegistration' | 'viaTaskAssignment' | 'viaCreated'>>,
        ) => {
            const existing = eventsById.get(event.id);
            if (existing) {
                if (flags.viaRegistration) existing.viaRegistration = true;
                if (flags.viaTaskAssignment) existing.viaTaskAssignment = true;
                if (flags.viaCreated) existing.viaCreated = true;
                return;
            }
            eventsById.set(event.id, {
                id: event.id,
                slug: event.slug,
                title: event.title,
                eventDate: event.eventDate,
                eventEndDate: event.eventEndDate,
                venue: event.venue,
                viaRegistration: Boolean(flags.viaRegistration),
                viaTaskAssignment: Boolean(flags.viaTaskAssignment),
                viaCreated: Boolean(flags.viaCreated),
            });
        };

        for (const row of registrations) {
            upsertEvent(row.event, { viaRegistration: true });
        }
        for (const row of eventAssignments) {
            upsertEvent(row.eventTask.event, { viaTaskAssignment: true });
        }
        for (const event of createdEvents) {
            upsertEvent(event, { viaCreated: true });
        }

        type ProjectAgg = {
            id: number;
            slug: string;
            title: string;
            startDate: Date | null;
            createdAt: Date;
            viaTaskAssignment: boolean;
            viaCreated: boolean;
            viaTeam: boolean;
        };

        const projectsById = new Map<number, ProjectAgg>();

        const upsertProject = (
            project: {
                id: number;
                slug: string;
                title: string;
                startDate: Date | null;
                createdAt: Date;
            },
            flags: Partial<Pick<ProjectAgg, 'viaTaskAssignment' | 'viaCreated' | 'viaTeam'>>,
        ) => {
            const existing = projectsById.get(project.id);
            if (existing) {
                if (flags.viaTaskAssignment) existing.viaTaskAssignment = true;
                if (flags.viaCreated) existing.viaCreated = true;
                if (flags.viaTeam) existing.viaTeam = true;
                return;
            }
            projectsById.set(project.id, {
                id: project.id,
                slug: project.slug,
                title: project.title,
                startDate: project.startDate,
                createdAt: project.createdAt,
                viaTaskAssignment: Boolean(flags.viaTaskAssignment),
                viaCreated: Boolean(flags.viaCreated),
                viaTeam: Boolean(flags.viaTeam),
            });
        };

        for (const project of createdProjects) {
            upsertProject(project, { viaCreated: true });
        }
        for (const row of projectTaskAssignments) {
            upsertProject(row.task.project, { viaTaskAssignment: true });
        }
        for (const row of teamProjects) {
            upsertProject(row.project, { viaTeam: true });
        }

        type ActivityRow = {
            kind: 'event' | 'project';
            id: number;
            title: string;
            date: string | null;
            endDate?: string | null;
            hrefMeta?: { slug?: string };
            venue?: string | null;
            viaRegistration: boolean;
            viaTaskAssignment: boolean;
            viaCreated: boolean;
            viaTeam: boolean;
            _sortDate: Date | null;
        };

        const activityRows: ActivityRow[] = [
            ...Array.from(eventsById.values()).map((event) => ({
                kind: 'event' as const,
                id: event.id,
                title: event.title,
                date: event.eventDate.toISOString(),
                endDate: event.eventEndDate.toISOString(),
                hrefMeta: { slug: event.slug },
                venue: event.venue,
                viaRegistration: event.viaRegistration,
                viaTaskAssignment: event.viaTaskAssignment,
                viaCreated: event.viaCreated,
                viaTeam: false,
                _sortDate: event.eventDate,
            })),
            ...Array.from(projectsById.values()).map((project) => {
                const sortDate = project.startDate ?? project.createdAt;
                return {
                    kind: 'project' as const,
                    id: project.id,
                    title: project.title,
                    date: sortDate.toISOString(),
                    endDate: null,
                    hrefMeta: { slug: project.slug },
                    venue: null,
                    viaRegistration: false,
                    viaTaskAssignment: project.viaTaskAssignment,
                    viaCreated: project.viaCreated,
                    viaTeam: project.viaTeam,
                    _sortDate: sortDate,
                };
            }),
        ];

        activityRows.sort((a, b) => {
            if (a._sortDate === null && b._sortDate === null) return 0;
            if (a._sortDate === null) return 1;
            if (b._sortDate === null) return -1;
            return a._sortDate.getTime() - b._sortDate.getTime();
        });

        const totalCount = activityRows.length;
        const items = activityRows.slice(0, limit).map(({ _sortDate, ...rest }) => rest);

        return res.json({ items, totalCount });
    } catch (error) {
        console.error('GET /dashboard/my-activities', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard activities' });
    }
});

export default router;
