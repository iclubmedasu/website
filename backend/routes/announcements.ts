import express from 'express';
import { prisma } from '../db';
import { canManageAnnouncements } from '../lib/announcementPermissions';
import { canUserManageEventTasks } from '../lib/eventPermissions';
import { canUserViewProject } from '../lib/projectPermissions';
import { emitSystemAnnouncement } from '../services/notificationService';

const router: any = express.Router();

const TARGET_TYPES = new Set(['NONE', 'EVENT', 'PROJECT']);
const RESPONSE_STATUSES = new Set(['AVAILABLE', 'UNAVAILABLE']);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors task-assign elevated roles (canUserEditTask): no project-team check. */
function canElevatedAssignProjectTasks(user: {
    memberId?: number | null;
    isDeveloper?: boolean;
    isOfficer?: boolean;
    isAdmin?: boolean;
    isLeadership?: boolean;
    isSpecial?: boolean;
} | null | undefined): boolean {
    if (!user?.memberId) return false;
    return !!(
        user.isDeveloper
        || user.isOfficer
        || user.isAdmin
        || user.isLeadership
        || user.isSpecial
    );
}

const announcementInclude = {
    createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
    event: { select: { id: true, title: true, slug: true, eventDate: true, eventEndDate: true } },
    project: { select: { id: true, title: true, slug: true, startDate: true, dueDate: true } },
} as const;

const myResponseNestedInclude = (memberId: number) => ({
    responses: {
        where: { memberId },
        take: 1,
        include: {
            periods: {
                select: { startDate: true, endDate: true },
                orderBy: { startDate: 'asc' as const },
            },
        },
    },
});

const responsePeriodsInclude = {
    periods: {
        select: { startDate: true, endDate: true },
        orderBy: { startDate: 'asc' as const },
    },
};

function parseAnnouncementId(param: unknown) {
    const id = parseInt(String(param), 10);
    if (Number.isNaN(id)) return null;
    return id;
}

function requireMemberId(req, res): number | null {
    const memberId = req.user?.memberId;
    if (!memberId) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    return memberId;
}

function requireManage(req, res): boolean {
    if (!canManageAnnouncements(req.user)) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

function mapWithMyResponse(row: any) {
    const { responses, ...announcement } = row;
    return {
        ...announcement,
        myResponse: responses?.[0] ?? null,
    };
}

function toUtcDayKey(value: Date): string {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseIsoDay(raw: unknown): Date | null {
    if (typeof raw !== 'string') return null;
    const day = raw.trim();
    if (!ISO_DAY.test(day)) return null;

    const date = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    if (toUtcDayKey(date) !== day) return null;
    return date;
}

function asUtcDay(value: Date | string | null | undefined): Date | null {
    if (value == null) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return new Date(`${toUtcDayKey(value)}T00:00:00.000Z`);
    }
    return parseIsoDay(String(value).slice(0, 10));
}

type ParsedPeriod = { start: Date; end: Date };

function parsePeriods(periods: unknown):
    | { ok: true; periods: ParsedPeriod[] }
    | { ok: false; error: string } {
    if (periods === undefined || periods === null) {
        return { ok: true, periods: [] };
    }
    if (!Array.isArray(periods)) {
        return { ok: false, error: 'periods must be an array of { start, end }' };
    }

    const parsed: ParsedPeriod[] = [];

    for (const raw of periods) {
        if (!raw || typeof raw !== 'object') {
            return { ok: false, error: 'each period must be an object with start and end' };
        }
        const start = parseIsoDay((raw as { start?: unknown }).start);
        const end = parseIsoDay((raw as { end?: unknown }).end);
        if (!start || !end) {
            return { ok: false, error: 'each period needs ISO date start and end (YYYY-MM-DD)' };
        }
        if (start.getTime() > end.getTime()) {
            return { ok: false, error: 'each period must have start <= end' };
        }
        parsed.push({ start, end });
    }

    parsed.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

    // Merge overlapping and adjacent inclusive ranges before store
    const merged: ParsedPeriod[] = [];
    for (const curr of parsed) {
        if (!merged.length) {
            merged.push({ start: curr.start, end: curr.end });
            continue;
        }
        const last = merged[merged.length - 1];
        const nextAfterLast = new Date(last.end.getTime());
        nextAfterLast.setUTCDate(nextAfterLast.getUTCDate() + 1);
        if (curr.start.getTime() <= nextAfterLast.getTime()) {
            if (curr.end.getTime() > last.end.getTime()) {
                last.end = curr.end;
            }
        } else {
            merged.push({ start: curr.start, end: curr.end });
        }
    }

    return { ok: true, periods: merged };
}

function windowForAnnouncement(announcement: {
    targetType: string;
    event: { eventDate: Date; eventEndDate: Date | null } | null;
    project: { startDate: Date | null; dueDate: Date | null } | null;
}): { start: Date; end: Date } | null {
    if (announcement.targetType === 'EVENT' && announcement.event) {
        const start = asUtcDay(announcement.event.eventDate);
        const end = asUtcDay(announcement.event.eventEndDate ?? announcement.event.eventDate);
        if (!start || !end || start.getTime() > end.getTime()) return null;
        return { start, end };
    }
    if (announcement.targetType === 'PROJECT' && announcement.project) {
        const start = asUtcDay(announcement.project.startDate);
        const end = asUtcDay(announcement.project.dueDate);
        if (!start || !end || start.getTime() > end.getTime()) return null;
        return { start, end };
    }
    return null;
}

function periodsWithinWindow(
    periods: ParsedPeriod[],
    window: { start: Date; end: Date } | null,
): string | null {
    if (!window) return null;
    for (const period of periods) {
        if (period.start.getTime() < window.start.getTime() || period.end.getTime() > window.end.getTime()) {
            return 'periods must fall within the announcement date window';
        }
    }
    return null;
}

async function normalizeTargetFields({
    title,
    body,
    targetType,
    eventId,
    projectId,
    requireTitleBody = false,
    defaultTargetType,
}: {
    title?: unknown;
    body?: unknown;
    targetType?: unknown;
    eventId?: unknown;
    projectId?: unknown;
    requireTitleBody?: boolean;
    defaultTargetType?: string;
}): Promise<
    | { ok: true; data: { title?: string; body?: string; targetType: string; eventId: number | null; projectId: number | null } }
    | { ok: false; status: number; error: string }
> {
    const data: {
        title?: string;
        body?: string;
        targetType: string;
        eventId: number | null;
        projectId: number | null;
    } = {
        targetType: 'NONE',
        eventId: null,
        projectId: null,
    };

    if (title !== undefined || requireTitleBody) {
        const trimmedTitle = typeof title === 'string' ? title.trim() : '';
        if (!trimmedTitle) {
            return { ok: false, status: 400, error: 'title is required' };
        }
        data.title = trimmedTitle;
    }

    if (body !== undefined || requireTitleBody) {
        const trimmedBody = typeof body === 'string' ? body.trim() : '';
        if (!trimmedBody) {
            return { ok: false, status: 400, error: 'body is required' };
        }
        data.body = trimmedBody;
    }

    let resolvedType: string;
    if (targetType === undefined || targetType === null || targetType === '') {
        resolvedType = defaultTargetType ?? 'NONE';
    } else {
        resolvedType = String(targetType);
    }

    if (!TARGET_TYPES.has(resolvedType)) {
        return { ok: false, status: 400, error: 'targetType must be NONE, EVENT, or PROJECT' };
    }

    data.targetType = resolvedType;

    if (resolvedType === 'NONE') {
        data.eventId = null;
        data.projectId = null;
        return { ok: true, data };
    }

    if (resolvedType === 'EVENT') {
        if (eventId === undefined || eventId === null || eventId === '') {
            return { ok: false, status: 400, error: 'eventId is required for EVENT targetType' };
        }
        const parsedEventId = parseInt(String(eventId), 10);
        if (Number.isNaN(parsedEventId)) {
            return { ok: false, status: 400, error: 'Invalid eventId' };
        }
        const event = await prisma.event.findUnique({
            where: { id: parsedEventId },
            select: { id: true },
        });
        if (!event) {
            return { ok: false, status: 404, error: 'Event not found' };
        }
        data.eventId = parsedEventId;
        data.projectId = null;
        return { ok: true, data };
    }

    // PROJECT
    if (projectId === undefined || projectId === null || projectId === '') {
        return { ok: false, status: 400, error: 'projectId is required for PROJECT targetType' };
    }
    const parsedProjectId = parseInt(String(projectId), 10);
    if (Number.isNaN(parsedProjectId)) {
        return { ok: false, status: 400, error: 'Invalid projectId' };
    }
    const project = await prisma.project.findUnique({
        where: { id: parsedProjectId },
        select: { id: true },
    });
    if (!project) {
        return { ok: false, status: 404, error: 'Project not found' };
    }
    data.projectId = parsedProjectId;
    data.eventId = null;
    return { ok: true, data };
}

// ============================================
// GET /api/announcements
// ============================================
router.get('/', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;

        const includeInactive =
            (req.query.includeInactive === 'true' || req.query.includeInactive === '1') &&
            canManageAnnouncements(req.user);

        const announcements = await prisma.announcement.findMany({
            where: includeInactive ? undefined : { isActive: true },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
            include: {
                ...announcementInclude,
                ...myResponseNestedInclude(memberId),
            },
        });

        res.json(announcements.map(mapWithMyResponse));
    } catch (error) {
        console.error('GET /announcements', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

// ============================================
// POST /api/announcements
// ============================================
router.post('/', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;
        if (!requireManage(req, res)) return;

        const normalized = await normalizeTargetFields({
            title: req.body.title,
            body: req.body.body,
            targetType: req.body.targetType,
            eventId: req.body.eventId,
            projectId: req.body.projectId,
            requireTitleBody: true,
            defaultTargetType: 'NONE',
        });
        if (!normalized.ok) {
            return res.status(normalized.status).json({ error: normalized.error });
        }

        const isPinned = req.body.isPinned === true || req.body.isPinned === 'true';

        const announcement = await prisma.announcement.create({
            data: {
                title: normalized.data.title!,
                body: normalized.data.body!,
                targetType: normalized.data.targetType,
                eventId: normalized.data.eventId,
                projectId: normalized.data.projectId,
                isPinned,
                createdByMemberId: memberId,
            },
            include: announcementInclude,
        });

        try {
            await emitSystemAnnouncement({
                title: announcement.title,
                body: announcement.body,
                metadata: { announcementId: announcement.id },
            });
        } catch (notifyError) {
            console.error('POST /announcements notification fan-out failed', notifyError);
        }

        res.status(201).json({ ...announcement, myResponse: null });
    } catch (error) {
        console.error('POST /announcements', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
});

// ============================================
// GET /api/announcements/availability?eventId= | ?projectId=
// Auth mirrors assignable-members / project visibility (not announcement-manager).
// Mounted before /:id so "availability" is not parsed as an id.
// ============================================
router.get('/availability', async (req, res) => {
    try {
        if (!requireMemberId(req, res)) return;

        const hasEvent = req.query.eventId !== undefined && req.query.eventId !== null && req.query.eventId !== '';
        const hasProject =
            req.query.projectId !== undefined && req.query.projectId !== null && req.query.projectId !== '';

        if (hasEvent === hasProject) {
            return res.status(400).json({ error: 'Provide exactly one of eventId or projectId' });
        }

        let targetType: 'EVENT' | 'PROJECT';
        let eventId: number | null = null;
        let projectId: number | null = null;

        if (hasEvent) {
            const parsed = parseInt(String(req.query.eventId), 10);
            if (Number.isNaN(parsed)) {
                return res.status(400).json({ error: 'Invalid eventId' });
            }
            if (!canUserManageEventTasks(req.user)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const event = await prisma.event.findUnique({
                where: { id: parsed },
                select: { id: true },
            });
            if (!event) return res.status(404).json({ error: 'Event not found' });
            targetType = 'EVENT';
            eventId = parsed;
        } else {
            const parsed = parseInt(String(req.query.projectId), 10);
            if (Number.isNaN(parsed)) {
                return res.status(400).json({ error: 'Invalid projectId' });
            }
            const project = await prisma.project.findUnique({
                where: { id: parsed },
                select: { id: true, isArchived: true },
            });
            if (!project) return res.status(404).json({ error: 'Project not found' });
            const canAccess =
                canElevatedAssignProjectTasks(req.user)
                || (await canUserViewProject(req.user, parsed, project.isArchived));
            if (!canAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }
            targetType = 'PROJECT';
            projectId = parsed;
        }

        const announcement = await prisma.announcement.findFirst({
            where: {
                isActive: true,
                targetType,
                ...(eventId != null ? { eventId } : { projectId }),
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                targetType: true,
                eventId: true,
                projectId: true,
            },
        });

        if (!announcement) {
            return res.json({ announcement: null, responses: [] });
        }

        const responses = await prisma.announcementResponse.findMany({
            where: { announcementId: announcement.id },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                ...responsePeriodsInclude,
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json({
            announcement,
            responses: responses.map((row) => ({
                memberId: row.memberId,
                status: row.status,
                notes: row.notes,
                member: row.member,
                periods: (row.periods ?? []).map((period) => ({
                    startDate: toUtcDayKey(period.startDate),
                    endDate: toUtcDayKey(period.endDate),
                })),
            })),
        });
    } catch (error) {
        console.error('GET /announcements/availability', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// ============================================
// GET /api/announcements/:id/my-response
// ============================================
router.get('/:id/my-response', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const response = await prisma.announcementResponse.findUnique({
            where: {
                announcementId_memberId: {
                    announcementId: id,
                    memberId,
                },
            },
            include: responsePeriodsInclude,
        });

        res.json(response ?? null);
    } catch (error) {
        console.error('GET /announcements/:id/my-response', error);
        res.status(500).json({ error: 'Failed to fetch response' });
    }
});

// ============================================
// GET /api/announcements/:id/responses
// ============================================
router.get('/:id/responses', async (req, res) => {
    try {
        if (!requireMemberId(req, res)) return;
        if (!requireManage(req, res)) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const announcement = await prisma.announcement.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

        const responses = await prisma.announcementResponse.findMany({
            where: { announcementId: id },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                ...responsePeriodsInclude,
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json(responses);
    } catch (error) {
        console.error('GET /announcements/:id/responses', error);
        res.status(500).json({ error: 'Failed to fetch responses' });
    }
});

// ============================================
// POST /api/announcements/:id/respond
// ============================================
router.post('/:id/respond', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const announcement = await prisma.announcement.findUnique({
            where: { id },
            select: {
                id: true,
                isActive: true,
                targetType: true,
                event: { select: { eventDate: true, eventEndDate: true } },
                project: { select: { startDate: true, dueDate: true } },
            },
        });
        if (!announcement || !announcement.isActive) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        const status = req.body.status;
        if (!RESPONSE_STATUSES.has(status)) {
            return res.status(400).json({ error: 'status must be AVAILABLE or UNAVAILABLE' });
        }

        const notes = req.body.notes === undefined || req.body.notes === null
            ? null
            : String(req.body.notes);

        const parsedPeriods = parsePeriods(req.body.periods);
        if (!parsedPeriods.ok) {
            return res.status(400).json({ error: parsedPeriods.error });
        }

        const window = windowForAnnouncement(announcement);
        const boundsError = periodsWithinWindow(parsedPeriods.periods, window);
        if (boundsError) {
            return res.status(400).json({ error: boundsError });
        }

        // Clear periods when marking unavailable unless caller sent periods explicitly for AVAILABLE
        const periodsToStore =
            status === 'UNAVAILABLE' && req.body.periods === undefined
                ? []
                : parsedPeriods.periods;

        const response = await prisma.$transaction(async (tx) => {
            const upserted = await tx.announcementResponse.upsert({
                where: {
                    announcementId_memberId: {
                        announcementId: id,
                        memberId,
                    },
                },
                create: {
                    announcementId: id,
                    memberId,
                    status,
                    notes,
                },
                update: {
                    status,
                    notes,
                },
            });

            await tx.announcementResponsePeriod.deleteMany({
                where: { responseId: upserted.id },
            });

            if (periodsToStore.length > 0) {
                await tx.announcementResponsePeriod.createMany({
                    data: periodsToStore.map((period) => ({
                        responseId: upserted.id,
                        startDate: period.start,
                        endDate: period.end,
                    })),
                });
            }

            return tx.announcementResponse.findUnique({
                where: { id: upserted.id },
                include: responsePeriodsInclude,
            });
        });

        res.json(response);
    } catch (error) {
        console.error('POST /announcements/:id/respond', error);
        res.status(500).json({ error: 'Failed to submit response' });
    }
});

// ============================================
// PATCH /api/announcements/:id/deactivate
// ============================================
router.patch('/:id/deactivate', async (req, res) => {
    try {
        if (!requireMemberId(req, res)) return;
        if (!requireManage(req, res)) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return res.status(404).json({ error: 'Announcement not found' });

        const announcement = await prisma.announcement.update({
            where: { id },
            data: { isActive: false },
            include: announcementInclude,
        });

        res.json({ ...announcement, myResponse: null });
    } catch (error) {
        console.error('PATCH /announcements/:id/deactivate', error);
        res.status(500).json({ error: 'Failed to deactivate announcement' });
    }
});

// ============================================
// PATCH /api/announcements/:id/reactivate
// ============================================
router.patch('/:id/reactivate', async (req, res) => {
    try {
        if (!requireMemberId(req, res)) return;
        if (!requireManage(req, res)) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return res.status(404).json({ error: 'Announcement not found' });

        const announcement = await prisma.announcement.update({
            where: { id },
            data: { isActive: true },
            include: announcementInclude,
        });

        res.json({ ...announcement, myResponse: null });
    } catch (error) {
        console.error('PATCH /announcements/:id/reactivate', error);
        res.status(500).json({ error: 'Failed to reactivate announcement' });
    }
});

// ============================================
// PATCH /api/announcements/:id/pin
// ============================================
router.patch('/:id/pin', async (req, res) => {
    try {
        if (!requireMemberId(req, res)) return;
        if (!requireManage(req, res)) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        if (typeof req.body.isPinned !== 'boolean' && req.body.isPinned !== 'true' && req.body.isPinned !== 'false') {
            return res.status(400).json({ error: 'isPinned boolean is required' });
        }
        const isPinned = req.body.isPinned === true || req.body.isPinned === 'true';

        const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return res.status(404).json({ error: 'Announcement not found' });

        const announcement = await prisma.announcement.update({
            where: { id },
            data: { isPinned },
            include: announcementInclude,
        });

        res.json({ ...announcement, myResponse: null });
    } catch (error) {
        console.error('PATCH /announcements/:id/pin', error);
        res.status(500).json({ error: 'Failed to update pin status' });
    }
});

// ============================================
// GET /api/announcements/:id
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const announcement = await prisma.announcement.findUnique({
            where: { id },
            include: {
                ...announcementInclude,
                ...myResponseNestedInclude(memberId),
            },
        });

        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        if (!announcement.isActive && !canManageAnnouncements(req.user)) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json(mapWithMyResponse(announcement));
    } catch (error) {
        console.error('GET /announcements/:id', error);
        res.status(500).json({ error: 'Failed to fetch announcement' });
    }
});

// ============================================
// PUT /api/announcements/:id
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;
        if (!requireManage(req, res)) return;

        const id = parseAnnouncementId(req.params.id);
        if (id === null) return res.status(400).json({ error: 'Invalid announcement ID' });

        const existing = await prisma.announcement.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Announcement not found' });

        const data: any = {};

        if (req.body.title !== undefined) {
            const trimmedTitle = typeof req.body.title === 'string' ? req.body.title.trim() : '';
            if (!trimmedTitle) return res.status(400).json({ error: 'title is required' });
            data.title = trimmedTitle;
        }

        if (req.body.body !== undefined) {
            const trimmedBody = typeof req.body.body === 'string' ? req.body.body.trim() : '';
            if (!trimmedBody) return res.status(400).json({ error: 'body is required' });
            data.body = trimmedBody;
        }

        if (req.body.isPinned !== undefined) {
            data.isPinned = req.body.isPinned === true || req.body.isPinned === 'true';
        }

        if (req.body.isActive !== undefined) {
            data.isActive = req.body.isActive === true || req.body.isActive === 'true';
        }

        const targetFieldsChanging =
            req.body.targetType !== undefined
            || req.body.eventId !== undefined
            || req.body.projectId !== undefined;

        if (targetFieldsChanging) {
            const normalized = await normalizeTargetFields({
                targetType: req.body.targetType,
                eventId: req.body.eventId !== undefined ? req.body.eventId : existing.eventId,
                projectId: req.body.projectId !== undefined ? req.body.projectId : existing.projectId,
                defaultTargetType: existing.targetType,
            });
            if (!normalized.ok) {
                return res.status(normalized.status).json({ error: normalized.error });
            }
            data.targetType = normalized.data.targetType;
            data.eventId = normalized.data.eventId;
            data.projectId = normalized.data.projectId;
        }

        const announcement = await prisma.announcement.update({
            where: { id },
            data,
            include: {
                ...announcementInclude,
                ...myResponseNestedInclude(memberId),
            },
        });

        res.json(mapWithMyResponse(announcement));
    } catch (error) {
        console.error('PUT /announcements/:id', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

export default router;
