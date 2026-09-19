import express, { Request, Response } from "express";
import { CertificateStatus } from "@prisma/client";
import { prisma } from "../db";
import { requireDeveloperOnly } from "../middleware/auth";
import { USAGE_ACTION_TYPES } from "../services/usageEventService";

const router = express.Router();

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnlyStart(value: string): Date | null {
    if (!DATE_ONLY.test(value)) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function parseDateOnlyEnd(value: string): Date | null {
    if (!DATE_ONLY.test(value)) return null;
    const d = new Date(`${value}T23:59:59.999Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function resolveWindow(query: Request["query"]):
    | { ok: true; since: Date; until: Date; windowDays: number }
    | { ok: false; status: number; error: string } {
    const fromRaw = typeof query.from === "string" ? query.from.trim() : "";
    const toRaw = typeof query.to === "string" ? query.to.trim() : "";
    const hasCustom = Boolean(fromRaw || toRaw);

    if (hasCustom) {
        if (!fromRaw || !toRaw) {
            return { ok: false, status: 400, error: "Both from and to (YYYY-MM-DD) are required" };
        }
        const since = parseDateOnlyStart(fromRaw);
        const until = parseDateOnlyEnd(toRaw);
        if (!since || !until) {
            return { ok: false, status: 400, error: "from and to must be valid YYYY-MM-DD dates" };
        }
        if (since.getTime() > until.getTime()) {
            return { ok: false, status: 400, error: "from must be on or before to" };
        }
        const spanDays = Math.floor((until.getTime() - since.getTime()) / DAY_MS) + 1;
        if (spanDays > MAX_DAYS) {
            return { ok: false, status: 400, error: `Date range cannot exceed ${MAX_DAYS} days` };
        }
        return { ok: true, since, until, windowDays: spanDays };
    }

    let days = DEFAULT_DAYS;
    if (query.days !== undefined && query.days !== null && String(query.days).trim() !== "") {
        const parsed = Number.parseInt(String(query.days), 10);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) {
            return { ok: false, status: 400, error: `days must be an integer between 1 and ${MAX_DAYS}` };
        }
        days = parsed;
    }

    const until = new Date();
    const since = new Date(until.getTime() - days * DAY_MS);
    return { ok: true, since, until, windowDays: days };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function hoursBetween(start: Date, end: Date): number {
    return Math.max(0, (end.getTime() - start.getTime()) / HOUR_MS);
}

function daysBetween(start: Date, end: Date): number {
    return Math.max(0, (end.getTime() - start.getTime()) / DAY_MS);
}

function countMapFromGroup(
    rows: Array<{ [key: string]: number | unknown; _count: { _all: number } }>,
    key: string,
): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of rows) {
        const id = row[key];
        if (typeof id === "number") {
            map.set(id, row._count._all);
        }
    }
    return map;
}

const softActiveEventWhere = {
    isActive: true,
    deletedAt: null,
} as const;

const softActiveProjectWhere = {
    isActive: true,
} as const;

const softActiveAnnouncementWhere = {
    isActive: true,
} as const;

const BODY_PREVIEW_MAX = 200;

function truncatePreview(text: string, max = BODY_PREVIEW_MAX): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max)}…`;
}

const issuedCertificateWhere = {
    status: { not: CertificateStatus.DRAFT },
} as const;

/**
 * GET /api/usage-dashboard/summary
 * Developer-only product analytics. Query: days=1..366 (default 30) OR from&to=YYYY-MM-DD.
 * Durable creates/issues/check-ins/registrations come from source tables;
 * logins and data exports still come from UsageEvent.
 */
router.get("/summary", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const [
            eventsCreated,
            certificatesIssued,
            checkInsScanned,
            registrationsCreated,
            usageGrouped,
            distinctLoginMembers,
        ] = await Promise.all([
            prisma.event.count({
                where: { createdAt: inRange },
            }),
            prisma.certificate.count({
                where: {
                    OR: [
                        { issuedAt: inRange },
                        {
                            issuedAt: null,
                            createdAt: inRange,
                            status: { not: CertificateStatus.DRAFT },
                        },
                    ],
                },
            }),
            prisma.eventRegistrationDay.count({
                where: { checkedInAt: inRange },
            }),
            prisma.eventRegistration.count({
                where: { createdAt: inRange },
            }),
            prisma.usageEvent.groupBy({
                by: ["actionType"],
                where: {
                    createdAt: inRange,
                    actionType: {
                        in: [USAGE_ACTION_TYPES.DATA_EXPORTED, USAGE_ACTION_TYPES.LOGIN],
                    },
                },
                _count: { _all: true },
            }),
            prisma.usageEvent.findMany({
                where: {
                    actionType: USAGE_ACTION_TYPES.LOGIN,
                    createdAt: inRange,
                    memberId: { not: null },
                },
                select: { memberId: true },
                distinct: ["memberId"],
            }),
        ]);

        const usageCounts: Record<string, number> = {
            [USAGE_ACTION_TYPES.DATA_EXPORTED]: 0,
            [USAGE_ACTION_TYPES.LOGIN]: 0,
        };
        for (const row of usageGrouped) {
            if (Object.prototype.hasOwnProperty.call(usageCounts, row.actionType)) {
                usageCounts[row.actionType] = row._count._all;
            }
        }

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            counts: {
                eventsCreated,
                certificatesIssued,
                checkInsScanned,
                registrationsCreated,
                dataExports: usageCounts[USAGE_ACTION_TYPES.DATA_EXPORTED],
                logins: usageCounts[USAGE_ACTION_TYPES.LOGIN],
                activeMembers: distinctLoginMembers.length,
            },
        });
    } catch (error) {
        console.error("GET /usage-dashboard/summary error:", error);
        return res.status(500).json({ error: "Failed to load usage summary" });
    }
});

/**
 * GET /api/usage-dashboard/events?from&to
 * Events with createdAt in range; org summary + per-event breakdown.
 */
router.get("/events", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const events = await prisma.event.findMany({
            where: {
                createdAt: inRange,
                ...softActiveEventWhere,
            },
            select: {
                id: true,
                title: true,
                venue: true,
                eventDate: true,
                eventEndDate: true,
                status: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const emptySummary = {
            eventsCreated: 0,
            eventTasks: 0,
            eventTaskAssignments: 0,
            tasksPerEvent: 0,
            peopleWorked: 0,
            totalAssignmentHours: 0,
            totalEventDurationHours: 0,
            registrations: 0,
            ticketsSent: 0,
            remindersSent: 0,
            certificatesIssued: 0,
            sessions: 0,
            filesUploaded: 0,
            photosUploaded: 0,
            checkIns: 0,
        };

        if (events.length === 0) {
            return res.json({
                windowDays,
                since: since.toISOString(),
                until: until.toISOString(),
                summary: emptySummary,
                events: [],
            });
        }

        const eventIds = events.map((e) => e.id);

        const [
            registrationCounts,
            ticketCounts,
            reminderCounts,
            sessionCounts,
            fileCounts,
            photoCounts,
            taskCounts,
            certificateCounts,
            checkInCount,
            assignments,
        ] = await Promise.all([
            prisma.eventRegistration.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds } },
                _count: { _all: true },
            }),
            prisma.eventRegistration.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds }, ticketEmailSentAt: { not: null } },
                _count: { _all: true },
            }),
            prisma.eventRegistration.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds }, reminderEmailSentAt: { not: null } },
                _count: { _all: true },
            }),
            prisma.eventSession.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.eventFile.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.eventPhoto.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.eventTask.groupBy({
                by: ["eventId"],
                where: { eventId: { in: eventIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.certificate.groupBy({
                by: ["eventId"],
                where: {
                    eventId: { in: eventIds },
                    ...issuedCertificateWhere,
                },
                _count: { _all: true },
            }),
            prisma.eventRegistrationDay.count({
                where: { registration: { eventId: { in: eventIds } } },
            }),
            prisma.eventTaskAssignment.findMany({
                where: {
                    eventTask: {
                        eventId: { in: eventIds },
                        isActive: true,
                    },
                },
                select: {
                    memberId: true,
                    startDateTime: true,
                    endDateTime: true,
                    eventTask: { select: { eventId: true } },
                },
            }),
        ]);

        const regsByEvent = countMapFromGroup(registrationCounts, "eventId");
        const ticketsByEvent = countMapFromGroup(ticketCounts, "eventId");
        const remindersByEvent = countMapFromGroup(reminderCounts, "eventId");
        const sessionsByEvent = countMapFromGroup(sessionCounts, "eventId");
        const filesByEvent = countMapFromGroup(fileCounts, "eventId");
        const photosByEvent = countMapFromGroup(photoCounts, "eventId");
        const tasksByEvent = countMapFromGroup(taskCounts, "eventId");
        const certsByEvent = countMapFromGroup(
            certificateCounts.filter((r) => r.eventId != null) as Array<{
                eventId: number;
                _count: { _all: number };
            }>,
            "eventId",
        );

        const peopleByEvent = new Map<number, Set<number>>();
        const hoursByEvent = new Map<number, number>();
        const allPeople = new Set<number>();
        let totalAssignmentHours = 0;

        for (const a of assignments) {
            const eventId = a.eventTask.eventId;
            const hrs = hoursBetween(a.startDateTime, a.endDateTime);
            totalAssignmentHours += hrs;
            hoursByEvent.set(eventId, (hoursByEvent.get(eventId) ?? 0) + hrs);
            allPeople.add(a.memberId);
            let set = peopleByEvent.get(eventId);
            if (!set) {
                set = new Set();
                peopleByEvent.set(eventId, set);
            }
            set.add(a.memberId);
        }

        let totalEventDurationHours = 0;
        let totalTasks = 0;
        let totalRegs = 0;
        let totalTickets = 0;
        let totalReminders = 0;
        let totalCerts = 0;
        let totalSessions = 0;
        let totalFiles = 0;
        let totalPhotos = 0;

        const rows = events.map((event) => {
            const durationHours = hoursBetween(event.eventDate, event.eventEndDate);
            totalEventDurationHours += durationHours;

            const tasks = tasksByEvent.get(event.id) ?? 0;
            const registrations = regsByEvent.get(event.id) ?? 0;
            const ticketsSent = ticketsByEvent.get(event.id) ?? 0;
            const remindersSent = remindersByEvent.get(event.id) ?? 0;
            const certificatesIssued = certsByEvent.get(event.id) ?? 0;
            const sessions = sessionsByEvent.get(event.id) ?? 0;
            const files = filesByEvent.get(event.id) ?? 0;
            const photos = photosByEvent.get(event.id) ?? 0;
            const peopleWorked = peopleByEvent.get(event.id)?.size ?? 0;
            const assignmentHours = round2(hoursByEvent.get(event.id) ?? 0);

            totalTasks += tasks;
            totalRegs += registrations;
            totalTickets += ticketsSent;
            totalReminders += remindersSent;
            totalCerts += certificatesIssued;
            totalSessions += sessions;
            totalFiles += files;
            totalPhotos += photos;

            return {
                id: event.id,
                title: event.title,
                venue: event.venue,
                eventDate: event.eventDate.toISOString(),
                eventEndDate: event.eventEndDate.toISOString(),
                status: event.status,
                registrations,
                sessions,
                ticketsSent,
                remindersSent,
                certificatesIssued,
                files,
                photos,
                peopleWorked,
                assignmentHours,
                tasks,
            };
        });

        const eventsCreated = events.length;
        const summary = {
            eventsCreated,
            eventTasks: totalTasks,
            eventTaskAssignments: assignments.length,
            tasksPerEvent: eventsCreated > 0 ? round2(totalTasks / eventsCreated) : 0,
            peopleWorked: allPeople.size,
            totalAssignmentHours: round2(totalAssignmentHours),
            totalEventDurationHours: round2(totalEventDurationHours),
            registrations: totalRegs,
            ticketsSent: totalTickets,
            remindersSent: totalReminders,
            certificatesIssued: totalCerts,
            sessions: totalSessions,
            filesUploaded: totalFiles,
            photosUploaded: totalPhotos,
            checkIns: checkInCount,
        };

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            summary,
            events: rows,
        });
    } catch (error) {
        console.error("GET /usage-dashboard/events error:", error);
        return res.status(500).json({ error: "Failed to load usage events" });
    }
});

/**
 * GET /api/usage-dashboard/events/:id?from&to
 * Detail for one event; 404 if missing, inactive, soft-deleted, or createdAt outside range.
 */
router.get("/events/:id", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const eventId = Number.parseInt(String(req.params.id), 10);
        if (!Number.isInteger(eventId) || eventId < 1) {
            return res.status(400).json({ error: "Invalid event id" });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                createdAt: inRange,
                ...softActiveEventWhere,
            },
            select: {
                id: true,
                title: true,
                venue: true,
                status: true,
                eventDate: true,
                eventEndDate: true,
                createdAt: true,
                capacity: true,
            },
        });

        if (!event) {
            return res.status(404).json({ error: "Event not found in selected period" });
        }

        const [
            registrations,
            sessions,
            tasks,
            filesCount,
            photosCount,
            certificates,
            checkIns,
            attendanceSegments,
        ] = await Promise.all([
            prisma.eventRegistration.findMany({
                where: { eventId },
                select: {
                    status: true,
                    isWalkIn: true,
                    ticketEmailSentAt: true,
                    reminderEmailSentAt: true,
                },
            }),
            prisma.eventSession.findMany({
                where: { eventId, isActive: true },
                select: {
                    id: true,
                    label: true,
                    sessionDate: true,
                    startDateTime: true,
                    endDateTime: true,
                    mode: true,
                    maxCapacity: true,
                },
                orderBy: [{ sessionDate: "asc" }, { order: "asc" }],
            }),
            prisma.eventTask.findMany({
                where: { eventId, isActive: true },
                select: {
                    id: true,
                    assignments: {
                        select: {
                            memberId: true,
                            startDateTime: true,
                            endDateTime: true,
                        },
                    },
                },
            }),
            prisma.eventFile.count({ where: { eventId, isActive: true } }),
            prisma.eventPhoto.count({ where: { eventId, isActive: true } }),
            prisma.certificate.findMany({
                where: { eventId, ...issuedCertificateWhere },
                select: { certificateEmailSentAt: true },
            }),
            prisma.eventRegistrationDay.count({
                where: { registration: { eventId } },
            }),
            prisma.eventSessionAttendance.findMany({
                where: { session: { eventId } },
                select: { joinedAt: true, checkedOutAt: true },
            }),
        ]);

        const totalRegistrations = registrations.length;
        const walkInRegistrations = registrations.filter((r) => r.isWalkIn).length;
        const cancelledRegistrations = registrations.filter((r) => r.status === "CANCELLED").length;
        const nonCancelled = totalRegistrations - cancelledRegistrations;
        const capacityFillPercent =
            event.capacity != null && event.capacity > 0
                ? round2((nonCancelled / event.capacity) * 100)
                : null;

        const ticketsSent = registrations.filter((r) => r.ticketEmailSentAt != null).length;
        const remindersSent = registrations.filter((r) => r.reminderEmailSentAt != null).length;
        const certificatesIssued = certificates.length;
        const certificateEmailsSent = certificates.filter((c) => c.certificateEmailSentAt != null).length;

        const people = new Set<number>();
        let assignmentHours = 0;
        let assignmentCount = 0;
        for (const task of tasks) {
            for (const a of task.assignments) {
                people.add(a.memberId);
                assignmentHours += hoursBetween(a.startDateTime, a.endDateTime);
                assignmentCount += 1;
            }
        }

        let attendanceDwellMinutes: number | null = null;
        let dwellSum = 0;
        let dwellCount = 0;
        for (const seg of attendanceSegments) {
            if (seg.checkedOutAt != null) {
                dwellSum += Math.max(0, (seg.checkedOutAt.getTime() - seg.joinedAt.getTime()) / MINUTE_MS);
                dwellCount += 1;
            }
        }
        if (dwellCount > 0) {
            attendanceDwellMinutes = round2(dwellSum);
        }

        const statusBreakdown: Record<string, number> = {};
        for (const r of registrations) {
            statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1;
        }

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            event: {
                id: event.id,
                title: event.title,
                venue: event.venue,
                status: event.status,
                eventDate: event.eventDate.toISOString(),
                eventEndDate: event.eventEndDate.toISOString(),
                createdAt: event.createdAt.toISOString(),
                capacity: event.capacity,
            },
            metrics: {
                durationHours: round2(hoursBetween(event.eventDate, event.eventEndDate)),
                sessions: sessions.length,
                registrations: totalRegistrations,
                walkInRegistrations,
                cancelledRegistrations,
                capacityFillPercent,
                ticketsSent,
                remindersSent,
                certificatesIssued,
                certificateEmailsSent,
                files: filesCount,
                photos: photosCount,
                eventTasks: tasks.length,
                eventTaskAssignments: assignmentCount,
                assignmentHours: round2(assignmentHours),
                peopleWorked: people.size,
                checkIns,
                sessionAttendanceSegments: attendanceSegments.length,
                sessionAttendanceDwellMinutes: attendanceDwellMinutes,
            },
            sessions: sessions.map((s) => ({
                id: s.id,
                label: s.label,
                sessionDate: s.sessionDate.toISOString(),
                startDateTime: s.startDateTime?.toISOString() ?? null,
                endDateTime: s.endDateTime?.toISOString() ?? null,
                mode: s.mode,
                maxCapacity: s.maxCapacity,
            })),
            registrationStatusBreakdown: statusBreakdown,
        });
    } catch (error) {
        console.error("GET /usage-dashboard/events/:id error:", error);
        return res.status(500).json({ error: "Failed to load usage event detail" });
    }
});

/**
 * GET /api/usage-dashboard/projects?from&to
 * Projects with createdAt in range; org summary + per-project breakdown.
 */
router.get("/projects", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const projects = await prisma.project.findMany({
            where: {
                createdAt: inRange,
                ...softActiveProjectWhere,
            },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                dueDate: true,
                completedDate: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const emptySummary = {
            projectsCreated: 0,
            tasks: 0,
            subtasks: 0,
            phases: 0,
            peopleWorked: 0,
            totalPlannedDurationDays: 0,
            files: 0,
            photos: 0,
            certificates: 0,
        };

        if (projects.length === 0) {
            return res.json({
                windowDays,
                since: since.toISOString(),
                until: until.toISOString(),
                summary: emptySummary,
                projects: [],
            });
        }

        const projectIds = projects.map((p) => p.id);

        const [
            taskRows,
            phaseCounts,
            fileCounts,
            photoCounts,
            certificateCounts,
            assignmentMemberRows,
        ] = await Promise.all([
            prisma.task.findMany({
                where: { projectId: { in: projectIds }, isActive: true },
                select: { id: true, projectId: true, parentTaskId: true },
            }),
            prisma.projectPhase.groupBy({
                by: ["projectId"],
                where: { projectId: { in: projectIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.projectFile.groupBy({
                by: ["projectId"],
                where: { projectId: { in: projectIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.projectPhoto.groupBy({
                by: ["projectId"],
                where: { projectId: { in: projectIds }, isActive: true },
                _count: { _all: true },
            }),
            prisma.certificate.groupBy({
                by: ["projectId"],
                where: {
                    projectId: { in: projectIds },
                    ...issuedCertificateWhere,
                },
                _count: { _all: true },
            }),
            prisma.taskAssignment.findMany({
                where: {
                    task: {
                        projectId: { in: projectIds },
                        isActive: true,
                    },
                },
                select: {
                    memberId: true,
                    task: { select: { projectId: true } },
                },
            }),
        ]);

        const tasksByProject = new Map<number, number>();
        const subtasksByProject = new Map<number, number>();
        for (const t of taskRows) {
            if (t.parentTaskId != null) {
                subtasksByProject.set(t.projectId, (subtasksByProject.get(t.projectId) ?? 0) + 1);
            } else {
                tasksByProject.set(t.projectId, (tasksByProject.get(t.projectId) ?? 0) + 1);
            }
        }

        const phasesByProject = countMapFromGroup(phaseCounts, "projectId");
        const filesByProject = countMapFromGroup(fileCounts, "projectId");
        const photosByProject = countMapFromGroup(photoCounts, "projectId");
        const certsByProject = countMapFromGroup(
            certificateCounts.filter((r) => r.projectId != null) as Array<{
                projectId: number;
                _count: { _all: number };
            }>,
            "projectId",
        );

        const peopleByProject = new Map<number, Set<number>>();
        const allPeople = new Set<number>();
        for (const a of assignmentMemberRows) {
            const projectId = a.task.projectId;
            allPeople.add(a.memberId);
            let set = peopleByProject.get(projectId);
            if (!set) {
                set = new Set();
                peopleByProject.set(projectId, set);
            }
            set.add(a.memberId);
        }

        let totalPlannedDurationDays = 0;
        let totalTasks = 0;
        let totalSubtasks = 0;
        let totalPhases = 0;
        let totalFiles = 0;
        let totalPhotos = 0;
        let totalCerts = 0;

        const rows = projects.map((project) => {
            if (project.startDate && project.dueDate) {
                totalPlannedDurationDays += daysBetween(project.startDate, project.dueDate);
            }

            const tasks = tasksByProject.get(project.id) ?? 0;
            const subtasks = subtasksByProject.get(project.id) ?? 0;
            const phases = phasesByProject.get(project.id) ?? 0;
            const files = filesByProject.get(project.id) ?? 0;
            const photos = photosByProject.get(project.id) ?? 0;
            const peopleWorked = peopleByProject.get(project.id)?.size ?? 0;
            const certificates = certsByProject.get(project.id) ?? 0;

            totalTasks += tasks;
            totalSubtasks += subtasks;
            totalPhases += phases;
            totalFiles += files;
            totalPhotos += photos;
            totalCerts += certificates;

            return {
                id: project.id,
                title: project.title,
                status: project.status,
                startDate: project.startDate?.toISOString() ?? null,
                dueDate: project.dueDate?.toISOString() ?? null,
                completedDate: project.completedDate?.toISOString() ?? null,
                tasks,
                subtasks,
                phases,
                peopleWorked,
                files,
                photos,
            };
        });

        const summary = {
            projectsCreated: projects.length,
            tasks: totalTasks,
            subtasks: totalSubtasks,
            phases: totalPhases,
            peopleWorked: allPeople.size,
            totalPlannedDurationDays: round2(totalPlannedDurationDays),
            files: totalFiles,
            photos: totalPhotos,
            certificates: totalCerts,
        };

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            summary,
            projects: rows,
        });
    } catch (error) {
        console.error("GET /usage-dashboard/projects error:", error);
        return res.status(500).json({ error: "Failed to load usage projects" });
    }
});

/**
 * GET /api/usage-dashboard/projects/:id?from&to
 * Detail for one project; 404 if missing, inactive, or createdAt outside range.
 */
router.get("/projects/:id", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const projectId = Number.parseInt(String(req.params.id), 10);
        if (!Number.isInteger(projectId) || projectId < 1) {
            return res.status(400).json({ error: "Invalid project id" });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                createdAt: inRange,
                ...softActiveProjectWhere,
            },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                dueDate: true,
                completedDate: true,
                createdAt: true,
                createdBy: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });

        if (!project) {
            return res.status(404).json({ error: "Project not found in selected period" });
        }

        const [tasks, phasesCount, filesCount, photosCount, certificatesCount, scheduleSlots, assignments] =
            await Promise.all([
                prisma.task.findMany({
                    where: { projectId, isActive: true },
                    select: {
                        id: true,
                        parentTaskId: true,
                        status: true,
                        estimatedHours: true,
                        actualHours: true,
                    },
                }),
                prisma.projectPhase.count({ where: { projectId, isActive: true } }),
                prisma.projectFile.count({ where: { projectId, isActive: true } }),
                prisma.projectPhoto.count({ where: { projectId, isActive: true } }),
                prisma.certificate.count({
                    where: { projectId, ...issuedCertificateWhere },
                }),
                prisma.projectScheduleSlot.findMany({
                    where: { projectId, isActive: true },
                    select: { startDateTime: true, endDateTime: true },
                }),
                prisma.taskAssignment.findMany({
                    where: {
                        task: { projectId, isActive: true },
                    },
                    select: {
                        memberId: true,
                        status: true,
                    },
                }),
            ]);

        const topLevelTasks = tasks.filter((t) => t.parentTaskId == null);
        const subtasks = tasks.filter((t) => t.parentTaskId != null);
        const completedTasks = topLevelTasks.filter((t) => t.status === "COMPLETED").length;
        const taskCompletionRate =
            topLevelTasks.length > 0 ? round2((completedTasks / topLevelTasks.length) * 100) : null;

        const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length;
        const assignmentCompletionRate =
            assignments.length > 0 ? round2((completedAssignments / assignments.length) * 100) : null;

        const peopleWorked = new Set(assignments.map((a) => a.memberId)).size;

        let scheduleSlotHours = 0;
        for (const slot of scheduleSlots) {
            scheduleSlotHours += hoursBetween(slot.startDateTime, slot.endDateTime);
        }

        let estimatedHours = 0;
        let actualHours = 0;
        for (const t of tasks) {
            if (t.estimatedHours != null) estimatedHours += t.estimatedHours;
            if (t.actualHours != null) actualHours += t.actualHours;
        }

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            project: {
                id: project.id,
                title: project.title,
                status: project.status,
                startDate: project.startDate?.toISOString() ?? null,
                dueDate: project.dueDate?.toISOString() ?? null,
                completedDate: project.completedDate?.toISOString() ?? null,
                createdAt: project.createdAt.toISOString(),
                createdBy: {
                    id: project.createdBy.id,
                    fullName: project.createdBy.fullName,
                },
            },
            metrics: {
                tasks: topLevelTasks.length,
                subtasks: subtasks.length,
                phases: phasesCount,
                peopleWorked,
                files: filesCount,
                photos: photosCount,
                certificates: certificatesCount,
                taskCompletionRate,
                assignmentCompletionRate,
                scheduleSlotHours: round2(scheduleSlotHours),
                estimatedHours: round2(estimatedHours),
                actualHours: round2(actualHours),
            },
        });
    } catch (error) {
        console.error("GET /usage-dashboard/projects/:id error:", error);
        return res.status(500).json({ error: "Failed to load usage project detail" });
    }
});

/**
 * GET /api/usage-dashboard/announcements?from&to
 * Announcements with createdAt in range; org summary + per-announcement breakdown.
 */
router.get("/announcements", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const announcements = await prisma.announcement.findMany({
            where: {
                createdAt: inRange,
                ...softActiveAnnouncementWhere,
            },
            select: {
                id: true,
                title: true,
                createdAt: true,
                isPinned: true,
                isActive: true,
                targetType: true,
                eventId: true,
                projectId: true,
                createdByMemberId: true,
                createdBy: { select: { fullName: true } },
                event: { select: { title: true } },
                project: { select: { title: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const emptySummary = {
            announcementsCreated: 0,
            totalResponses: 0,
            availableCount: 0,
            unavailableCount: 0,
            avgResponsesPerAnnouncement: 0,
        };

        if (announcements.length === 0) {
            return res.json({
                windowDays,
                since: since.toISOString(),
                until: until.toISOString(),
                summary: emptySummary,
                announcements: [],
            });
        }

        const announcementIds = announcements.map((a) => a.id);

        const responses = await prisma.announcementResponse.findMany({
            where: { announcementId: { in: announcementIds } },
            select: {
                announcementId: true,
                status: true,
            },
        });

        const responseCountByAnnouncement = new Map<number, number>();
        const availableByAnnouncement = new Map<number, number>();
        const unavailableByAnnouncement = new Map<number, number>();
        let totalAvailable = 0;
        let totalUnavailable = 0;

        for (const r of responses) {
            responseCountByAnnouncement.set(
                r.announcementId,
                (responseCountByAnnouncement.get(r.announcementId) ?? 0) + 1,
            );
            if (r.status === "AVAILABLE") {
                totalAvailable += 1;
                availableByAnnouncement.set(
                    r.announcementId,
                    (availableByAnnouncement.get(r.announcementId) ?? 0) + 1,
                );
            } else if (r.status === "UNAVAILABLE") {
                totalUnavailable += 1;
                unavailableByAnnouncement.set(
                    r.announcementId,
                    (unavailableByAnnouncement.get(r.announcementId) ?? 0) + 1,
                );
            }
        }

        const announcementsCreated = announcements.length;
        const totalResponses = responses.length;

        const rows = announcements.map((a) => ({
            id: a.id,
            title: a.title,
            createdAt: a.createdAt.toISOString(),
            isPinned: a.isPinned,
            isActive: a.isActive,
            targetType: a.targetType,
            eventId: a.eventId,
            eventTitle: a.event?.title ?? null,
            projectId: a.projectId,
            projectTitle: a.project?.title ?? null,
            responseCount: responseCountByAnnouncement.get(a.id) ?? 0,
            availableCount: availableByAnnouncement.get(a.id) ?? 0,
            unavailableCount: unavailableByAnnouncement.get(a.id) ?? 0,
            createdByMemberId: a.createdByMemberId,
            createdByName: a.createdBy.fullName,
        }));

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            summary: {
                announcementsCreated,
                totalResponses,
                availableCount: totalAvailable,
                unavailableCount: totalUnavailable,
                avgResponsesPerAnnouncement:
                    announcementsCreated > 0 ? round2(totalResponses / announcementsCreated) : 0,
            },
            announcements: rows,
        });
    } catch (error) {
        console.error("GET /usage-dashboard/announcements error:", error);
        return res.status(500).json({ error: "Failed to load usage announcements" });
    }
});

/**
 * GET /api/usage-dashboard/announcements/:id?from&to
 * Detail for one announcement; 404 if missing, inactive, or createdAt outside range.
 */
router.get("/announcements/:id", requireDeveloperOnly, async (req: Request, res: Response) => {
    try {
        const window = resolveWindow(req.query);
        if (!window.ok) {
            return res.status(window.status).json({ error: window.error });
        }

        const announcementId = Number.parseInt(String(req.params.id), 10);
        if (!Number.isInteger(announcementId) || announcementId < 1) {
            return res.status(400).json({ error: "Invalid announcement id" });
        }

        const { since, until, windowDays } = window;
        const inRange = { gte: since, lte: until };

        const announcement = await prisma.announcement.findFirst({
            where: {
                id: announcementId,
                createdAt: inRange,
                ...softActiveAnnouncementWhere,
            },
            select: {
                id: true,
                title: true,
                body: true,
                createdAt: true,
                isPinned: true,
                isActive: true,
                targetType: true,
                eventId: true,
                projectId: true,
                createdByMemberId: true,
                createdBy: { select: { fullName: true } },
                event: { select: { title: true } },
                project: { select: { title: true } },
            },
        });

        if (!announcement) {
            return res.status(404).json({ error: "Announcement not found in selected period" });
        }

        const [responses, periodsCount] = await Promise.all([
            prisma.announcementResponse.findMany({
                where: { announcementId },
                select: { status: true },
            }),
            prisma.announcementResponsePeriod.count({
                where: { response: { announcementId } },
            }),
        ]);

        const statusBreakdown: Record<string, number> = {};
        let availableCount = 0;
        let unavailableCount = 0;
        for (const r of responses) {
            statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1;
            if (r.status === "AVAILABLE") availableCount += 1;
            else if (r.status === "UNAVAILABLE") unavailableCount += 1;
        }

        const responseCount = responses.length;
        const availablePercent =
            responseCount > 0 ? round2((availableCount / responseCount) * 100) : null;

        return res.json({
            windowDays,
            since: since.toISOString(),
            until: until.toISOString(),
            announcement: {
                id: announcement.id,
                title: announcement.title,
                bodyPreview: truncatePreview(announcement.body),
                createdAt: announcement.createdAt.toISOString(),
                isPinned: announcement.isPinned,
                isActive: announcement.isActive,
                targetType: announcement.targetType,
                eventId: announcement.eventId,
                eventTitle: announcement.event?.title ?? null,
                projectId: announcement.projectId,
                projectTitle: announcement.project?.title ?? null,
                createdByMemberId: announcement.createdByMemberId,
                createdByName: announcement.createdBy.fullName,
            },
            metrics: {
                responseCount,
                availableCount,
                unavailableCount,
                availablePercent,
                periodsCount,
            },
            statusBreakdown,
        });
    } catch (error) {
        console.error("GET /usage-dashboard/announcements/:id error:", error);
        return res.status(500).json({ error: "Failed to load usage announcement detail" });
    }
});

export default router;
