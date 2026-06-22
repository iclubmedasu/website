import { Prisma } from '@prisma/client';
import express, { Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { generateUniqueConfirmationCode } from '../services/eventCode';
import { isWithinEventDays } from '../services/eventDates';
import { emitNotificationEvent } from '../services/notificationService';
import {
    collectChangedFields,
    changesToPayload,
    logEventActivity,
    summarizeChanges,
} from '../services/activityLogService';
import {
    buildAssignedDescription,
    buildAssignmentActivityValue,
    buildUnassignedDescription,
} from '../services/eventActivityHelpers';

const router = express.Router();

const MANAGER_ROLES = ['isDeveloper', 'isOfficer', 'isAdmin', 'isLeadership'];
const PUBLIC_VISIBLE_STATUSES = ['PUBLISHED', 'COMPLETED'];
const VALID_EVENT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']);
const VALID_PROGRESS_STATUSES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']);
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']);
const VALID_TIER_CURRENCIES = new Set(['USD', 'EUR', 'EGP']);

function normalizeTierCurrency(value: unknown): string {
    const currency = String(value || 'EGP').trim().toUpperCase();
    return VALID_TIER_CURRENCIES.has(currency) ? currency : 'EGP';
}

function parseTeamIds(teamIds: unknown): Array<{ teamId: number; canEdit: boolean; isOwner: boolean }> {
    if (!Array.isArray(teamIds)) return [];
    return teamIds
        .map((entry) => {
            const teamId = parseId((entry as { teamId?: unknown })?.teamId);
            if (!teamId) return null;
            return {
                teamId,
                canEdit: (entry as { canEdit?: boolean }).canEdit !== false,
                isOwner: (entry as { isOwner?: boolean }).isOwner === true,
            };
        })
        .filter((entry): entry is { teamId: number; canEdit: boolean; isOwner: boolean } => entry !== null);
}

function normalizePriority(value: unknown): string {
    const priority = String(value || 'MEDIUM').trim().toUpperCase();
    return VALID_PRIORITIES.has(priority) ? priority : 'MEDIUM';
}

function normalizeProgressStatus(value: unknown): string {
    const progressStatus = String(value || 'NOT_STARTED').trim().toUpperCase();
    return VALID_PROGRESS_STATUSES.has(progressStatus) ? progressStatus : 'NOT_STARTED';
}

function normalizeDescription(value: unknown): string | null {
    const text = String(value ?? '').trim();
    if (!text || text.toLowerCase() === 'null') return null;
    return text;
}

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasManagerAccess(req: Request): boolean {
    return !!req.user?.memberId && MANAGER_ROLES.some((key) => Boolean((req.user as Record<string, unknown>)[key]));
}

async function buildEventWhere(req: Request) {
    const where: Record<string, unknown> = {};
    const isArchivedQuery = String(req.query.archived || '').trim().toLowerCase() === 'true';

    if (isArchivedQuery) {
        where.isArchived = true;
    } else {
        where.isArchived = false;
    }

    const status = String(req.query.status || '').trim().toUpperCase();
    const projectId = parseId(req.query.projectId);
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const scope = String(req.query.scope || '').trim().toLowerCase();

    if (status && VALID_EVENT_STATUSES.has(status)) {
        where.status = status;
    } else if (!hasManagerAccess(req) || scope !== 'all') {
        where.status = { in: PUBLIC_VISIBLE_STATUSES };
    }

    if (projectId) {
        where.projectId = projectId;
    }

    if (dateFrom || dateTo) {
        const dateFilters: Record<string, unknown>[] = [];
        if (dateTo) {
            dateFilters.push({ eventDate: { lte: new Date(dateTo) } });
        }
        if (dateFrom) {
            dateFilters.push({ eventEndDate: { gte: new Date(dateFrom) } });
        }
        if (dateFilters.length === 1) {
            Object.assign(where, dateFilters[0]);
        } else if (dateFilters.length > 1) {
            where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...dateFilters];
        }
    }

    return where;
}

function eventInclude() {
    return {
        project: { select: { id: true, title: true, status: true } },
        projectType: { select: { id: true, name: true, category: true, description: true, icon: true } },
        createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        eventTeams: {
            include: {
                team: { select: { id: true, name: true } },
            },
        },
        tiers: {
            orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
            include: {
                _count: { select: { registrations: true } },
            },
        },
        customFields: {
            orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
        },
        _count: {
            select: { registrations: true },
        },
    };
}

async function getEventOr404(res: Response, eventId: number) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: eventInclude(),
    });

    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return null;
    }

    return event;
}

function canPublicView(event: { status: string; isActive: boolean }): boolean {
    return event.isActive && PUBLIC_VISIBLE_STATUSES.includes(event.status);
}

function normalizeOptions(options: unknown): unknown {
    if (options == null) return null;
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
        const trimmed = options.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    if (typeof options === 'object') return options;
    return null;
}

function toJsonInput(value: unknown): any {
    const normalized = normalizeOptions(value);
    return normalized === null ? Prisma.DbNull : normalized;
}

async function createRegistrationCodeWithRetry(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const confirmationCode = await generateUniqueConfirmationCode();
        const existing = await prisma.eventRegistration.findFirst({
            where: { confirmationCode },
            select: { id: true },
        });

        if (!existing) {
            return confirmationCode;
        }
    }

    throw new Error('Unable to generate a unique confirmation code');
}

async function getEventRegistrationCount(eventId: number): Promise<number> {
    return prisma.eventRegistration.count({ where: { eventId, status: { not: 'CANCELLED' } } });
}

function resolveEventEndDate(startDate: Date, rawEndDate: unknown): Date {
    if (rawEndDate != null && String(rawEndDate).trim()) {
        const endDate = new Date(String(rawEndDate));
        if (!Number.isNaN(endDate.getTime())) return endDate;
    }
    return startDate;
}

function assertValidEventDuration(startDate: Date, endDate: Date, res: Response): boolean {
    if (endDate.getTime() < startDate.getTime()) {
        res.status(400).json({ error: 'eventEndDate must be on or after eventDate' });
        return false;
    }
    return true;
}

type EventTeamSnapshot = { teamId: number; canEdit: boolean; isOwner: boolean };

function normalizeEventTeamSnapshot(eventTeams: EventTeamSnapshot[] | undefined | null): EventTeamSnapshot[] {
    return (eventTeams || [])
        .map((entry) => ({
            teamId: entry.teamId,
            canEdit: entry.canEdit,
            isOwner: entry.isOwner,
        }))
        .sort((a, b) => a.teamId - b.teamId);
}

function eventActivitySnapshot(event: {
    title: string;
    description?: string | null;
    venue?: string | null;
    eventDate: Date;
    eventEndDate: Date;
    registrationDeadline?: Date | null;
    capacity?: number | null;
    allowWalkIns: boolean;
    isCertifiable: boolean;
    projectId?: number | null;
    projectTypeId?: number | null;
    priority: string;
    status: string;
    progressStatus: string;
    eventTeams?: EventTeamSnapshot[];
}) {
    return {
        title: event.title,
        description: event.description,
        venue: event.venue,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        registrationDeadline: event.registrationDeadline,
        capacity: event.capacity,
        allowWalkIns: event.allowWalkIns,
        isCertifiable: event.isCertifiable,
        projectId: event.projectId,
        projectTypeId: event.projectTypeId,
        priority: event.priority,
        status: event.status,
        progressStatus: event.progressStatus,
        eventTeams: normalizeEventTeamSnapshot(event.eventTeams),
    };
}

const EVENT_FIELD_LABELS: Record<string, string> = {
    title: 'title',
    description: 'description',
    venue: 'venue',
    eventDate: 'event date',
    eventEndDate: 'end date',
    registrationDeadline: 'registration deadline',
    capacity: 'capacity',
    allowWalkIns: 'allow walk-ins',
    isCertifiable: 'certifiable',
    projectId: 'project',
    projectTypeId: 'project type',
    priority: 'priority',
    status: 'status',
    progressStatus: 'progress status',
    eventTeams: 'teams',
};

const TIER_FIELD_LABELS: Record<string, string> = {
    name: 'name',
    description: 'description',
    maxCapacity: 'max capacity',
    price: 'price',
    currency: 'currency',
    order: 'order',
    isActive: 'active',
};

const CUSTOM_FIELD_LABELS: Record<string, string> = {
    label: 'label',
    type: 'type',
    required: 'required',
    showOnPublic: 'show on public',
    isLocked: 'locked',
    order: 'order',
};

async function logEventFieldUpdate(
    eventId: number,
    memberId: number,
    before: ReturnType<typeof eventActivitySnapshot>,
    afterEvent: Parameters<typeof eventActivitySnapshot>[0],
    eventTitle: string,
): Promise<void> {
    const after = eventActivitySnapshot(afterEvent);
    const changes = collectChangedFields(before, after, EVENT_FIELD_LABELS);
    if (changes.length === 0) return;

    const { oldValue, newValue } = changesToPayload(changes);
    await logEventActivity({
        eventId,
        memberId,
        actionType: 'UPDATED',
        entityType: 'EVENT',
        oldValue,
        newValue,
        description: summarizeChanges(changes) || `Event "${eventTitle}" updated`,
    });
}

type CustomFieldRow = {
    id: number;
    label: string;
    type: string;
    required: boolean;
    showOnPublic: boolean;
    isActive: boolean;
    options?: unknown;
};

function getCustomFieldValueFromRecord(customFieldValues: unknown, field: { id: number; label: string }): unknown {
    if (!customFieldValues || typeof customFieldValues !== 'object' || Array.isArray(customFieldValues)) return undefined;
    const record = customFieldValues as Record<string, unknown>;
    return record[String(field.id)] ?? record[field.label];
}

function isCustomFieldValueEmpty(type: string, value: unknown): boolean {
    if (type === 'checkbox') return value !== true && value !== 'true';
    if (value === null || value === undefined || value === '') return true;
    return false;
}

function mergeCustomFieldValues(existing: unknown, incoming: unknown): Record<string, unknown> {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
        Object.assign(base, incoming as Record<string, unknown>);
    }
    return base;
}

async function getActiveCustomFields(eventId: number, options?: { publicOnly?: boolean }) {
    return prisma.eventCustomField.findMany({
        where: {
            eventId,
            isActive: true,
            ...(options?.publicOnly ? { showOnPublic: true } : {}),
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
}

function getMissingRequiredCustomFieldsFromValues(
    fields: CustomFieldRow[],
    customFieldValues: unknown,
    options?: { publicOnly?: boolean },
): CustomFieldRow[] {
    return fields.filter((field) => {
        if (!field.required) return false;
        if (options?.publicOnly && !field.showOnPublic) return false;
        const value = getCustomFieldValueFromRecord(customFieldValues, field);
        return isCustomFieldValueEmpty(field.type, value);
    });
}

function validateRequiredCustomFieldValues(
    fields: CustomFieldRow[],
    customFieldValues: unknown,
    options?: { publicOnly?: boolean },
): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of getMissingRequiredCustomFieldsFromValues(fields, customFieldValues, options)) {
        errors[String(field.id)] = `${field.label} is required.`;
    }
    return errors;
}

// ============================================
// Events list / detail
// ============================================
router.get('/', async (req, res) => {
    try {
        const where = await buildEventWhere(req);
        const events = await prisma.event.findMany({
            where,
            orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
            include: eventInclude(),
        });

        return res.json(events);
    } catch (error) {
        console.error('GET /events error:', error);
        return res.status(500).json({ error: 'Failed to fetch events' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const event = await getEventOr404(res, eventId);
        if (!event) return;

        if (!hasManagerAccess(req) && !canPublicView(event)) {
            return res.status(404).json({ error: 'Event not found' });
        }

        return res.json(event);
    } catch (error) {
        console.error(`GET /events/${req.params.id} error:`, error);
        return res.status(500).json({ error: 'Failed to fetch event' });
    }
});

router.get('/:id/activity', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const event = await getEventOr404(res, eventId);
        if (!event) return;

        if (!hasManagerAccess(req) && !canPublicView(event)) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const activity = await prisma.eventActivityLog.findMany({
            where: { eventId },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                eventTask: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return res.json(activity);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/activity error:`, error);
        return res.status(500).json({ error: 'Failed to fetch event activity' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const title = String(req.body?.title || '').trim();
        const eventDate = new Date(String(req.body?.eventDate || ''));
        if (!title || Number.isNaN(eventDate.getTime())) {
            return res.status(400).json({ error: 'title and valid eventDate are required' });
        }

        const eventEndDate = resolveEventEndDate(eventDate, req.body?.eventEndDate);
        if (!assertValidEventDuration(eventDate, eventEndDate, res)) return;

        const projectTypeId = parseId(req.body?.projectTypeId);
        if (!projectTypeId) {
            return res.status(400).json({ error: 'projectTypeId is required' });
        }

        const projectId = parseId(req.body?.projectId);
        const registrationDeadline = req.body?.registrationDeadline ? new Date(String(req.body.registrationDeadline)) : null;
        const parsedCapacity = req.body?.capacity === '' || req.body?.capacity == null ? undefined : Number.parseInt(String(req.body.capacity), 10);
        const capacity = typeof parsedCapacity === 'number' && Number.isInteger(parsedCapacity) && parsedCapacity >= 0 ? parsedCapacity : null;
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const status = normalizeProgressStatus(req.body?.status ?? req.body?.progressStatus);
        const priority = normalizePriority(req.body?.priority);
        const teamIds = parseTeamIds(req.body?.teamIds);

        const created = await prisma.event.create({
            data: {
                title,
                description: normalizeDescription(req.body?.description),
                venue: String(req.body?.venue || '').trim() || null,
                eventDate,
                eventEndDate,
                registrationDeadline: registrationDeadline && !Number.isNaN(registrationDeadline.getTime()) ? registrationDeadline : null,
                capacity,
                allowWalkIns: Boolean(req.body?.allowWalkIns),
                isCertifiable: Boolean(req.body?.isCertifiable),
                projectId,
                projectTypeId,
                priority,
                progressStatus: status,
                createdByMemberId: memberId,
                status,
                isActive: true,
                eventTeams: teamIds.length > 0 ? {
                    create: teamIds.map((team) => ({
                        teamId: team.teamId,
                        canEdit: team.canEdit,
                        isOwner: team.isOwner,
                    })),
                } : undefined,
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId: created.id,
            memberId,
            actionType: 'CREATED',
            entityType: 'EVENT',
            newValue: {
                title: created.title,
                projectTypeId: created.projectTypeId,
                priority: created.priority,
                status: created.status,
                eventDate: created.eventDate,
            },
            description: `Event "${created.title}" created`,
        });

        return res.status(201).json(created);
    } catch (error) {
        console.error('POST /events error:', error);
        return res.status(500).json({ error: 'Failed to create event' });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const existing = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                eventTeams: { select: { teamId: true, canEdit: true, isOwner: true } },
            },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const beforeSnapshot = eventActivitySnapshot(existing);
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventDateValue = req.body?.eventDate ? new Date(String(req.body.eventDate)) : null;
        const nextEventDate = eventDateValue && !Number.isNaN(eventDateValue.getTime()) ? eventDateValue : existing.eventDate;
        const nextEventEndDate = req.body?.eventEndDate !== undefined
            ? resolveEventEndDate(nextEventDate, req.body.eventEndDate)
            : (req.body?.eventDate !== undefined ? resolveEventEndDate(nextEventDate, existing.eventEndDate) : existing.eventEndDate);
        if (!assertValidEventDuration(nextEventDate, nextEventEndDate, res)) return;

        const registrationDeadlineValue = req.body?.registrationDeadline ? new Date(String(req.body.registrationDeadline)) : null;
        const parsedCapacity = req.body?.capacity === '' || req.body?.capacity == null ? undefined : Number.parseInt(String(req.body.capacity), 10);
        const capacity = typeof parsedCapacity === 'number' && Number.isInteger(parsedCapacity) && parsedCapacity >= 0 ? parsedCapacity : null;
        const projectId = req.body?.projectId === null ? null : parseId(req.body?.projectId);
        const projectTypeId = req.body?.projectTypeId !== undefined ? parseId(req.body?.projectTypeId) : undefined;

        const data: Record<string, unknown> = {
            title: req.body?.title !== undefined ? String(req.body.title).trim() : existing.title,
            description: req.body?.description !== undefined ? normalizeDescription(req.body.description) : existing.description,
            venue: req.body?.venue !== undefined ? String(req.body.venue).trim() || null : existing.venue,
            eventDate: nextEventDate,
            eventEndDate: nextEventEndDate,
            registrationDeadline:
                req.body?.registrationDeadline !== undefined
                    ? (registrationDeadlineValue && !Number.isNaN(registrationDeadlineValue.getTime()) ? registrationDeadlineValue : null)
                    : existing.registrationDeadline,
            capacity: req.body?.capacity !== undefined ? capacity : existing.capacity,
            allowWalkIns: req.body?.allowWalkIns !== undefined ? Boolean(req.body.allowWalkIns) : existing.allowWalkIns,
            isCertifiable: req.body?.isCertifiable !== undefined ? Boolean(req.body.isCertifiable) : existing.isCertifiable,
            projectId: req.body?.projectId !== undefined ? projectId : existing.projectId,
        };

        if (projectTypeId !== undefined) {
            if (!projectTypeId) {
                return res.status(400).json({ error: 'Invalid projectTypeId' });
            }
            data.projectTypeId = projectTypeId;
        }

        if (req.body?.priority !== undefined) {
            data.priority = normalizePriority(req.body.priority);
        }

        if (req.body?.status !== undefined || req.body?.progressStatus !== undefined) {
            const nextStatus = normalizeProgressStatus(req.body?.status ?? req.body?.progressStatus);
            data.status = nextStatus;
            data.progressStatus = nextStatus;
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data,
            include: eventInclude(),
        });

        if (Array.isArray(req.body?.teamIds)) {
            const incomingTeamIds = parseTeamIds(req.body.teamIds);

            await prisma.eventTeam.deleteMany({
                where: { eventId, teamId: { notIn: incomingTeamIds.map((team) => team.teamId) } },
            });

            for (const team of incomingTeamIds) {
                await prisma.eventTeam.upsert({
                    where: { eventId_teamId: { eventId, teamId: team.teamId } },
                    create: {
                        eventId,
                        teamId: team.teamId,
                        canEdit: team.canEdit,
                        isOwner: team.isOwner,
                    },
                    update: {
                        canEdit: team.canEdit,
                        isOwner: team.isOwner,
                    },
                });
            }

            const refreshed = await prisma.event.findUnique({
                where: { id: eventId },
                include: eventInclude(),
            });

            if (refreshed) {
                await logEventFieldUpdate(eventId, memberId, beforeSnapshot, {
                    ...refreshed,
                    eventTeams: (refreshed.eventTeams || []).map((team) => ({
                        teamId: team.teamId,
                        canEdit: team.canEdit,
                        isOwner: team.isOwner,
                    })),
                }, refreshed.title);
            }

            return res.json(refreshed);
        }

        await logEventFieldUpdate(eventId, memberId, beforeSnapshot, {
            ...updated,
            eventTeams: (updated.eventTeams || []).map((team) => ({
                teamId: team.teamId,
                canEdit: team.canEdit,
                isOwner: team.isOwner,
            })),
        }, updated.title);

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id} error:`, error);
        return res.status(500).json({ error: 'Failed to update event' });
    }
});

router.patch('/:id/deactivate', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (current.isArchived || current.isFinalized || current.status === 'CANCELLED' || !current.isActive) {
            return res.status(400).json({ error: 'Only active events can be held' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: { isActive: false },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'DEACTIVATED',
            entityType: 'EVENT',
            oldValue: { isActive: current.isActive },
            newValue: { isActive: false },
            description: `Event "${updated.title}" held`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/deactivate error:`, error);
        return res.status(500).json({ error: 'Failed to hold event' });
    }
});

router.patch('/:id/reactivate', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (current.isArchived) {
            return res.status(400).json({ error: 'Archived events cannot be reactivated' });
        }
        if (current.isFinalized) {
            return res.status(400).json({ error: 'Finalized events cannot be reactivated' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                isActive: true,
                progressStatus: current.status === 'CANCELLED' ? 'NOT_STARTED' : current.status,
                status: current.status === 'CANCELLED' ? 'NOT_STARTED' : current.status,
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'REACTIVATED',
            entityType: 'EVENT',
            oldValue: { isActive: current.isActive, status: current.status },
            newValue: { isActive: true, status: updated.status },
            description: `Event "${updated.title}" reactivated`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/reactivate error:`, error);
        return res.status(500).json({ error: 'Failed to reactivate event' });
    }
});

router.patch('/:id/abort', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (current.isArchived || current.isFinalized) {
            return res.status(400).json({ error: 'Only active or held events can be aborted' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                isActive: false,
                isFinalized: false,
                isArchived: false,
                progressStatus: 'CANCELLED',
                status: 'CANCELLED',
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'ABORTED',
            entityType: 'EVENT',
            oldValue: { status: current.status, isActive: current.isActive },
            newValue: { status: 'CANCELLED', isActive: false },
            description: `Event "${updated.title}" aborted`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/abort error:`, error);
        return res.status(500).json({ error: 'Failed to abort event' });
    }
});

router.patch('/:id/finalize', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (current.isArchived) {
            return res.status(400).json({ error: 'Archived events cannot be finalized' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                isFinalized: true,
                isActive: true,
                isArchived: false,
                progressStatus: 'COMPLETED',
                status: 'COMPLETED',
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'FINALIZED',
            entityType: 'EVENT',
            oldValue: { status: current.status, isFinalized: current.isFinalized },
            newValue: { status: 'COMPLETED', isFinalized: true },
            description: `Event "${updated.title}" finalized`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/finalize error:`, error);
        return res.status(500).json({ error: 'Failed to finalize event' });
    }
});

router.patch('/:id/archive', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (!current.isFinalized && current.status !== 'CANCELLED') {
            return res.status(400).json({ error: 'Only finalized or aborted events can be archived' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                isArchived: true,
                isActive: false,
                isFinalized: current.isFinalized,
                progressStatus: current.status,
                status: current.status,
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'ARCHIVED',
            entityType: 'EVENT',
            oldValue: { isArchived: current.isArchived, isActive: current.isActive },
            newValue: { isArchived: true, isActive: false },
            description: `Event "${updated.title}" archived`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/archive error:`, error);
        return res.status(500).json({ error: 'Failed to archive event' });
    }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const nextStatus = String(req.body?.status || req.body?.action || '').trim().toUpperCase();
        if (!VALID_EVENT_STATUSES.has(nextStatus)) {
            return res.status(400).json({ error: 'Invalid event status' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                status: nextStatus,
                isActive: nextStatus !== 'CANCELLED',
                deletedAt: nextStatus === 'CANCELLED' ? new Date() : null,
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'STATUS_CHANGED',
            entityType: 'EVENT',
            oldValue: { status: current.status },
            newValue: { status: nextStatus },
            description: `Event "${updated.title}" status changed to ${nextStatus}`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/status error:`, error);
        return res.status(500).json({ error: 'Failed to update event status' });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                status: 'CANCELLED',
                isActive: false,
                deletedAt: new Date(),
            },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'DELETED',
            entityType: 'EVENT',
            oldValue: { status: current.status, isActive: current.isActive },
            newValue: { status: 'CANCELLED', isActive: false },
            description: `Event "${updated.title}" cancelled`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`DELETE /events/${req.params.id} error:`, error);
        return res.status(500).json({ error: 'Failed to cancel event' });
    }
});

// ============================================
// Event tiers
// ============================================
router.get('/:id/tiers', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true, isActive: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!hasManagerAccess(req) && !canPublicView(event)) return res.status(404).json({ error: 'Event not found' });

        const tiers = await prisma.eventTier.findMany({
            where: { eventId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: { _count: { select: { registrations: true } } },
        });

        return res.json(tiers);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/tiers error:`, error);
        return res.status(500).json({ error: 'Failed to fetch tiers' });
    }
});

router.post('/:id/tiers', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Tier name is required' });

        const parsedMaxCapacity = req.body?.maxCapacity === '' || req.body?.maxCapacity == null ? undefined : Number.parseInt(String(req.body.maxCapacity), 10);
        const maxCapacity = typeof parsedMaxCapacity === 'number' && Number.isInteger(parsedMaxCapacity) && parsedMaxCapacity >= 0 ? parsedMaxCapacity : null;
        const priceValue = req.body?.price === '' || req.body?.price == null ? null : Number.parseFloat(String(req.body.price));

        const created = await prisma.eventTier.create({
            data: {
                eventId,
                name,
                description: String(req.body?.description || '').trim() || null,
                maxCapacity,
                price: Number.isFinite(priceValue) ? priceValue : null,
                currency: normalizeTierCurrency(req.body?.currency),
                order: Number.isInteger(Number(req.body?.order)) ? Number(req.body.order) : 0,
            },
            include: { _count: { select: { registrations: true } } },
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CREATED',
            entityType: 'TIER',
            newValue: { name: created.name, price: created.price, maxCapacity: created.maxCapacity },
            description: `Tier "${created.name}" created`,
        });

        return res.status(201).json(created);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/tiers error:`, error);
        return res.status(500).json({ error: 'Failed to create tier' });
    }
});

router.put('/:id/tiers/:tierId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const tierId = parseId(req.params.tierId);
        if (!eventId || !tierId) return res.status(400).json({ error: 'Invalid event or tier ID' });

        const existing = await prisma.eventTier.findFirst({ where: { id: tierId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Tier not found' });

        const parsedMaxCapacity = req.body?.maxCapacity === '' || req.body?.maxCapacity == null ? undefined : Number.parseInt(String(req.body.maxCapacity), 10);
        const maxCapacity = typeof parsedMaxCapacity === 'number' && Number.isInteger(parsedMaxCapacity) && parsedMaxCapacity >= 0 ? parsedMaxCapacity : null;
        const priceValue = req.body?.price === '' || req.body?.price == null ? null : Number.parseFloat(String(req.body.price));

        const updated = await prisma.eventTier.update({
            where: { id: tierId },
            data: {
                name: req.body?.name !== undefined ? String(req.body.name).trim() : existing.name,
                description: req.body?.description !== undefined ? String(req.body.description).trim() || null : existing.description,
                maxCapacity: req.body?.maxCapacity !== undefined ? maxCapacity : existing.maxCapacity,
                price: req.body?.price !== undefined ? (Number.isFinite(priceValue) ? priceValue : null) : existing.price,
                currency: req.body?.currency !== undefined ? normalizeTierCurrency(req.body.currency) : existing.currency,
                order: req.body?.order !== undefined && Number.isInteger(Number(req.body.order)) ? Number(req.body.order) : existing.order,
                isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive,
            },
            include: { _count: { select: { registrations: true } } },
        });

        const tierChanges = collectChangedFields(existing, updated, TIER_FIELD_LABELS);
        if (tierChanges.length > 0) {
            const { oldValue, newValue } = changesToPayload(tierChanges);
            await logEventActivity({
                eventId,
                memberId: req.user!.memberId!,
                actionType: 'UPDATED',
                entityType: 'TIER',
                oldValue,
                newValue,
                description: summarizeChanges(tierChanges) || `Tier "${updated.name}" updated`,
            });
        }

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id}/tiers/${req.params.tierId} error:`, error);
        return res.status(500).json({ error: 'Failed to update tier' });
    }
});

router.delete('/:id/tiers/:tierId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const tierId = parseId(req.params.tierId);
        if (!eventId || !tierId) return res.status(400).json({ error: 'Invalid event or tier ID' });

        const tier = await prisma.eventTier.findFirst({ where: { id: tierId, eventId }, select: { name: true } });
        if (!tier) return res.status(404).json({ error: 'Tier not found' });

        const registrationCount = await prisma.eventRegistration.count({ where: { eventId, tierId, status: { not: 'CANCELLED' } } });
        if (registrationCount > 0) {
            return res.status(409).json({ error: 'Cannot delete a tier with registrations' });
        }

        await prisma.eventTier.deleteMany({ where: { id: tierId, eventId } });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'DELETED',
            entityType: 'TIER',
            oldValue: { name: tier.name },
            description: `Tier "${tier.name}" deleted`,
        });

        return res.json({ success: true });
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/tiers/${req.params.tierId} error:`, error);
        return res.status(500).json({ error: 'Failed to remove tier' });
    }
});

// ============================================
// Event custom fields
// ============================================
router.get('/:id/custom-fields', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true, isActive: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!hasManagerAccess(req) && !canPublicView(event)) return res.status(404).json({ error: 'Event not found' });

        const fields = await prisma.eventCustomField.findMany({
            where: {
                eventId,
                ...(req.query.publicOnly === 'true' && !hasManagerAccess(req)
                    ? { showOnPublic: true, isActive: true }
                    : {}),
            },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });

        return res.json(fields);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/custom-fields error:`, error);
        return res.status(500).json({ error: 'Failed to fetch custom fields' });
    }
});

router.post('/:id/custom-fields', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const label = String(req.body?.label || '').trim();
        const type = String(req.body?.type || '').trim();
        if (!label || !type) return res.status(400).json({ error: 'label and type are required' });

        const highestOrder = await prisma.eventCustomField.aggregate({
            where: { eventId },
            _max: { order: true },
        });

        const created = await prisma.eventCustomField.create({
            data: {
                eventId,
                label,
                type,
                options: toJsonInput(req.body?.options),
                required: Boolean(req.body?.required),
                showOnPublic: Boolean(req.body?.showOnPublic),
                order: Number.isInteger(Number(req.body?.order)) ? Number(req.body.order) : (highestOrder._max.order ?? -1) + 1,
                isLocked: Boolean(req.body?.isLocked),
            },
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CREATED',
            entityType: 'CUSTOM_FIELD',
            newValue: { label: created.label, type: created.type },
            description: `Custom field "${created.label}" created`,
        });

        return res.status(201).json(created);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/custom-fields error:`, error);
        return res.status(500).json({ error: 'Failed to create custom field' });
    }
});

router.put('/:id/custom-fields/:fieldId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const fieldId = parseId(req.params.fieldId);
        if (!eventId || !fieldId) return res.status(400).json({ error: 'Invalid event or field ID' });

        const existing = await prisma.eventCustomField.findFirst({ where: { id: fieldId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Custom field not found' });

        const updated = await prisma.eventCustomField.update({
            where: { id: fieldId },
            data: {
                label: req.body?.label !== undefined ? String(req.body.label).trim() : existing.label,
                type: req.body?.type !== undefined ? String(req.body.type).trim() : existing.type,
                options: req.body?.options !== undefined ? toJsonInput(req.body.options) : (existing.options as any),
                required: req.body?.required !== undefined ? Boolean(req.body.required) : existing.required,
                showOnPublic: req.body?.showOnPublic !== undefined ? Boolean(req.body.showOnPublic) : existing.showOnPublic,
                isLocked: req.body?.isLocked !== undefined ? Boolean(req.body.isLocked) : existing.isLocked,
                order: req.body?.order !== undefined && Number.isInteger(Number(req.body.order)) ? Number(req.body.order) : existing.order,
            },
        });

        const fieldChanges = collectChangedFields(existing, updated, CUSTOM_FIELD_LABELS);
        if (fieldChanges.length > 0) {
            const { oldValue, newValue } = changesToPayload(fieldChanges);
            await logEventActivity({
                eventId,
                memberId: req.user!.memberId!,
                actionType: 'UPDATED',
                entityType: 'CUSTOM_FIELD',
                oldValue,
                newValue,
                description: summarizeChanges(fieldChanges) || `Custom field "${updated.label}" updated`,
            });
        }

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id}/custom-fields/${req.params.fieldId} error:`, error);
        return res.status(500).json({ error: 'Failed to update custom field' });
    }
});

router.patch('/:id/custom-fields/reorder', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const order = Array.isArray(req.body?.order) ? req.body.order : [];
        if (order.length === 0) return res.status(400).json({ error: 'order array is required' });

        await prisma.$transaction(
            order.map((entry: any, index: number) => {
                const fieldId = parseId(entry?.id ?? entry);
                if (!fieldId) {
                    throw new Error('Invalid custom field order payload');
                }

                return prisma.eventCustomField.updateMany({
                    where: { id: fieldId, eventId },
                    data: { order: Number.isInteger(Number(entry?.order)) ? Number(entry.order) : index },
                });
            }),
        );

        const fields = await prisma.eventCustomField.findMany({ where: { eventId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'REORDERED',
            entityType: 'CUSTOM_FIELD',
            newValue: { order: fields.map((field) => ({ id: field.id, label: field.label, order: field.order })) },
            description: 'Custom fields reordered',
        });

        return res.json(fields);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/custom-fields/reorder error:`, error);
        return res.status(500).json({ error: 'Failed to reorder custom fields' });
    }
});

router.delete('/:id/custom-fields/:fieldId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const fieldId = parseId(req.params.fieldId);
        if (!eventId || !fieldId) return res.status(400).json({ error: 'Invalid event or field ID' });

        const field = await prisma.eventCustomField.findFirst({ where: { id: fieldId, eventId }, select: { label: true } });
        if (!field) return res.status(404).json({ error: 'Custom field not found' });

        const registrationCount = await getEventRegistrationCount(eventId);
        if (registrationCount > 0) {
            return res.status(409).json({ error: 'Cannot delete a custom field after registrations exist' });
        }

        await prisma.eventCustomField.deleteMany({ where: { id: fieldId, eventId } });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'DELETED',
            entityType: 'CUSTOM_FIELD',
            oldValue: { label: field.label },
            description: `Custom field "${field.label}" deleted`,
        });

        return res.json({ success: true });
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/custom-fields/${req.params.fieldId} error:`, error);
        return res.status(500).json({ error: 'Failed to remove custom field' });
    }
});

// ============================================
// Registrations
// ============================================
router.get('/:id/registrations', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const tierId = parseId(req.query.tierId);
        const checkInStatus = String(req.query.checkInStatus || '').trim().toUpperCase();
        const walkIn = String(req.query.walkIn || '').trim().toLowerCase();

        const where: Record<string, unknown> = { eventId };
        if (tierId) where.tierId = tierId;
        if (checkInStatus === 'CHECKED_IN') {
            where.status = 'CHECKED_IN';
        } else if (checkInStatus === 'NOT_CHECKED_IN') {
            where.status = 'REGISTERED';
        }
        if (walkIn === 'true') where.isWalkIn = true;
        if (walkIn === 'false') where.isWalkIn = false;

        const registrations = await prisma.eventRegistration.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }],
            include: {
                tier: { select: { id: true, name: true } },
                member: { select: { id: true, fullName: true, email: true } },
            },
        });

        return res.json(registrations);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/registrations error:`, error);
        return res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

router.get('/:id/registrations/lookup', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const confirmationCode = String(req.query.confirmationCode || '').trim().toUpperCase();
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!confirmationCode) return res.status(400).json({ error: 'confirmationCode is required' });

        const registration = await prisma.eventRegistration.findFirst({
            where: { eventId, confirmationCode },
            include: {
                tier: { select: { id: true, name: true } },
                member: { select: { id: true, fullName: true, email: true } },
            },
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        const fields = await getActiveCustomFields(eventId);
        const missingRequiredFields = getMissingRequiredCustomFieldsFromValues(fields, registration.customFieldValues);

        return res.json({ registration, missingRequiredFields });
    } catch (error) {
        console.error(`GET /events/${req.params.id}/registrations/lookup error:`, error);
        return res.status(500).json({ error: 'Failed to lookup registration' });
    }
});

router.get('/:id/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });

        const registration = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            include: {
                tier: { select: { id: true, name: true } },
                member: { select: { id: true, fullName: true, email: true } },
            },
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        return res.json(registration);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to fetch registration' });
    }
});

router.post('/:id/registrations', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const isManager = hasManagerAccess(req);
        if (!isManager && !canPublicView(event)) {
            return res.status(403).json({ error: 'Registration is not open for this event' });
        }

        if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() < Date.now()) {
            return res.status(409).json({ error: 'Registration deadline has passed' });
        }

        const registrationCount = await getEventRegistrationCount(eventId);
        if (event.capacity != null && registrationCount >= event.capacity) {
            return res.status(409).json({ error: 'Event capacity has been reached' });
        }

        const tierId = parseId(req.body?.tierId);
        const tier = tierId
            ? await prisma.eventTier.findFirst({ where: { id: tierId, eventId }, select: { id: true, maxCapacity: true } })
            : null;
        if (tierId && !tier) return res.status(400).json({ error: 'Invalid tier for this event' });
        if (tier?.maxCapacity != null) {
            const tierRegistrationCount = await prisma.eventRegistration.count({ where: { eventId, tierId, status: { not: 'CANCELLED' } } });
            if (tierRegistrationCount >= tier.maxCapacity) {
                return res.status(409).json({ error: 'Selected tier is at capacity' });
            }
        }

        const fullName = String(req.body?.fullName || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!fullName || !email) return res.status(400).json({ error: 'fullName and email are required' });

        const customFieldValuesInput = req.body?.customFieldValues;
        if (!isManager) {
            const publicFields = await getActiveCustomFields(eventId, { publicOnly: true });
            const customFieldErrors = validateRequiredCustomFieldValues(publicFields, customFieldValuesInput, { publicOnly: true });
            if (Object.keys(customFieldErrors).length > 0) {
                return res.status(400).json({ error: 'Required custom fields are missing', fieldErrors: customFieldErrors });
            }
        }

        const confirmationCode = await createRegistrationCodeWithRetry();

        const registration = await prisma.eventRegistration.create({
            data: {
                eventId,
                tierId,
                memberId: req.user?.memberId ?? null,
                fullName,
                email,
                phoneNumber: String(req.body?.phoneNumber || '').trim() || null,
                confirmationCode,
                source: isManager ? 'PORTAL' : 'PUBLIC',
                status: 'REGISTERED',
                isWalkIn: Boolean(req.body?.isWalkIn),
                notes: String(req.body?.notes || '').trim() || null,
                customFieldValues: toJsonInput(req.body?.customFieldValues),
            },
            include: {
                tier: { select: { id: true, name: true } },
                member: { select: { id: true, fullName: true, email: true } },
            },
        });

        await logEventActivity({
            eventId,
            memberId: req.user?.memberId ?? registration.memberId ?? null,
            actionType: 'CREATED',
            entityType: 'REGISTRATION',
            newValue: {
                fullName: registration.fullName,
                email: registration.email,
                source: registration.source,
                status: registration.status,
            },
            description: isManager
                ? `Registration created for ${registration.fullName} (${registration.email})`
                : `Public registration: ${registration.fullName} (${registration.email})`,
        });

        return res.status(201).json(registration);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/registrations error:`, error);
        return res.status(500).json({ error: 'Failed to create registration' });
    }
});

router.post('/:id/registrations/walk-in', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!event.allowWalkIns) return res.status(409).json({ error: 'Walk-ins are disabled for this event' });
        if (!isWithinEventDays(event.eventDate, event.eventEndDate)) {
            return res.status(409).json({ error: 'Walk-ins are only available on event days' });
        }

        const fullName = String(req.body?.fullName || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!fullName || !email) return res.status(400).json({ error: 'fullName and email are required' });

        const walkInFields = await getActiveCustomFields(eventId);
        const walkInFieldErrors = validateRequiredCustomFieldValues(walkInFields, req.body?.customFieldValues);
        if (Object.keys(walkInFieldErrors).length > 0) {
            return res.status(400).json({ error: 'Required custom fields are missing', fieldErrors: walkInFieldErrors });
        }

        const confirmationCode = await createRegistrationCodeWithRetry();
        const registration = await prisma.eventRegistration.create({
            data: {
                eventId,
                tierId: parseId(req.body?.tierId),
                memberId: req.body?.memberId ? parseId(req.body.memberId) : null,
                fullName,
                email,
                phoneNumber: String(req.body?.phoneNumber || '').trim() || null,
                confirmationCode,
                source: 'WALK_IN',
                status: 'CHECKED_IN',
                isWalkIn: true,
                checkedInAt: new Date(),
                notes: String(req.body?.notes || '').trim() || null,
                customFieldValues: toJsonInput(req.body?.customFieldValues),
            },
            include: {
                tier: { select: { id: true, name: true } },
            },
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CREATED',
            entityType: 'REGISTRATION',
            newValue: {
                fullName: registration.fullName,
                email: registration.email,
                source: registration.source,
                status: registration.status,
                isWalkIn: true,
            },
            description: `Walk-in registration for ${registration.fullName} (${registration.email})`,
        });

        return res.status(201).json(registration);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/registrations/walk-in error:`, error);
        return res.status(500).json({ error: 'Failed to create walk-in registration' });
    }
});

router.patch('/:id/registrations/:registrationId/check-in', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        const confirmationCode = String(req.body?.confirmationCode || '').trim().toUpperCase();
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const registration = registrationId
            ? await prisma.eventRegistration.findFirst({ where: { id: registrationId, eventId } })
            : confirmationCode
                ? await prisma.eventRegistration.findFirst({ where: { eventId, confirmationCode } })
                : null;

        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        if (registration.status === 'CHECKED_IN') {
            return res.status(409).json({ error: 'Attendee already checked in' });
        }

        const mergedCustomFieldValues = req.body?.customFieldValues !== undefined
            ? mergeCustomFieldValues(registration.customFieldValues, req.body.customFieldValues)
            : mergeCustomFieldValues(registration.customFieldValues, {});

        const requiredFields = await getActiveCustomFields(eventId);
        const missingRequiredFields = getMissingRequiredCustomFieldsFromValues(requiredFields, mergedCustomFieldValues);
        if (missingRequiredFields.length > 0) {
            return res.status(409).json({
                error: 'Required custom fields must be completed before check-in',
                missingFields: missingRequiredFields,
            });
        }

        const updated = await prisma.eventRegistration.update({
            where: { id: registration.id },
            data: {
                status: 'CHECKED_IN',
                checkedInAt: new Date(),
                ...(req.body?.customFieldValues !== undefined
                    ? { customFieldValues: toJsonInput(mergedCustomFieldValues) }
                    : {}),
            },
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CHECKED_IN',
            entityType: 'REGISTRATION',
            oldValue: { status: registration.status },
            newValue: { status: 'CHECKED_IN', fullName: registration.fullName },
            description: `${registration.fullName} checked in`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId}/check-in error:`, error);
        return res.status(500).json({ error: 'Failed to check in registration' });
    }
});

router.patch('/:id/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });

        const existing = await prisma.eventRegistration.findFirst({ where: { id: registrationId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Registration not found' });

        if (req.body?.customFieldValues !== undefined) {
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: { eventDate: true, eventEndDate: true },
            });
            if (!event || !isWithinEventDays(event.eventDate, event.eventEndDate)) {
                return res.status(409).json({ error: 'Custom fields can only be updated during event days' });
            }
        }

        const updated = await prisma.eventRegistration.update({
            where: { id: registrationId },
            data: {
                fullName: req.body?.fullName !== undefined ? String(req.body.fullName).trim() : existing.fullName,
                email: req.body?.email !== undefined ? String(req.body.email).trim().toLowerCase() : existing.email,
                phoneNumber: req.body?.phoneNumber !== undefined ? String(req.body.phoneNumber).trim() || null : existing.phoneNumber,
                tierId: req.body?.tierId !== undefined ? parseId(req.body.tierId) : existing.tierId,
                notes: req.body?.notes !== undefined ? String(req.body.notes).trim() || null : existing.notes,
                customFieldValues: req.body?.customFieldValues !== undefined ? toJsonInput(req.body.customFieldValues) : (existing.customFieldValues as any),
            },
        });

        const registrationChanges = collectChangedFields(existing, updated, {
            fullName: 'name',
            email: 'email',
            phoneNumber: 'phone',
            tierId: 'tier',
            notes: 'notes',
        });
        if (registrationChanges.length > 0) {
            const { oldValue, newValue } = changesToPayload(registrationChanges);
            await logEventActivity({
                eventId,
                memberId: req.user!.memberId!,
                actionType: 'UPDATED',
                entityType: 'REGISTRATION',
                oldValue,
                newValue,
                description: summarizeChanges(registrationChanges) || `Registration for ${updated.fullName} updated`,
            });
        }

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to update registration' });
    }
});

router.delete('/:id/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });

        const existing = await prisma.eventRegistration.findFirst({ where: { id: registrationId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Registration not found' });

        const updated = await prisma.eventRegistration.update({
            where: { id: registrationId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CANCELLED',
            entityType: 'REGISTRATION',
            oldValue: { status: existing.status, fullName: existing.fullName },
            newValue: { status: 'CANCELLED' },
            description: `Registration cancelled for ${existing.fullName}`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to cancel registration' });
    }
});

// ============================================
// Statistics
// ============================================
router.get('/:id/statistics', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, capacity: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const [totalRegistered, totalCheckedIn, walkInCount, noShowCount, byTier, registrationTimeline, attendanceTimeline] = await Promise.all([
            prisma.eventRegistration.count({ where: { eventId, isWalkIn: false, status: { not: 'CANCELLED' } } }),
            prisma.eventRegistration.count({ where: { eventId, isWalkIn: false, status: 'CHECKED_IN' } }),
            prisma.eventRegistration.count({ where: { eventId, isWalkIn: true, status: { not: 'CANCELLED' } } }),
            prisma.eventRegistration.count({ where: { eventId, status: 'REGISTERED', isWalkIn: false } }),
            prisma.eventTier.findMany({
                where: { eventId },
                select: { id: true, name: true, _count: { select: { registrations: true } } },
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            }),
            prisma.eventRegistration.findMany({
                where: { eventId, isWalkIn: false, status: { not: 'CANCELLED' } },
                select: { createdAt: true },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.eventRegistration.findMany({
                where: {
                    eventId,
                    status: 'CHECKED_IN',
                },
                select: { checkedInAt: true, createdAt: true },
                orderBy: { checkedInAt: 'asc' },
            }),
        ]);

        const registrationsByDay = new Map<string, number>();
        for (const item of registrationTimeline) {
            const day = item.createdAt.toISOString().slice(0, 10);
            registrationsByDay.set(day, (registrationsByDay.get(day) ?? 0) + 1);
        }

        const attendanceByDay = new Map<string, number>();
        for (const item of attendanceTimeline) {
            const timestamp = item.checkedInAt ?? item.createdAt;
            const day = timestamp.toISOString().slice(0, 10);
            attendanceByDay.set(day, (attendanceByDay.get(day) ?? 0) + 1);
        }

        return res.json({
            eventId,
            capacity: event.capacity,
            totalRegistered,
            totalCheckedIn,
            walkInCount,
            noShowCount,
            byTier: byTier.map((tier) => ({
                tierId: tier.id,
                name: tier.name,
                registrations: tier._count.registrations,
            })),
            registrationsOverTime: Array.from(registrationsByDay.entries()).map(([date, count]) => ({ date, count })),
            attendanceOverTime: Array.from(attendanceByDay.entries()).map(([date, count]) => ({ date, count })),
        });
    } catch (error) {
        console.error(`GET /events/${req.params.id}/statistics error:`, error);
        return res.status(500).json({ error: 'Failed to fetch event statistics' });
    }
});

// ============================================
// EVENT TASKS
// ============================================

function eventTaskInclude() {
    return {
        leader: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        createdBy: { select: { id: true, fullName: true } },
        assignments: {
            orderBy: [{ startDateTime: 'asc' as const }, { createdAt: 'asc' as const }],
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        },
    };
}

function buildEventTaskAssignedBody(taskTitle: string, eventTitle?: string | null) {
    const eventSuffix = eventTitle ? ` for event "${eventTitle}"` : '';
    return `You were assigned to task "${taskTitle}"${eventSuffix}.`;
}

function buildEventTaskLeaderAssignedBody(taskTitle: string, eventTitle?: string | null) {
    const eventSuffix = eventTitle ? ` for event "${eventTitle}"` : '';
    return `You were assigned as the leader for task "${taskTitle}"${eventSuffix}.`;
}

function uniqueAssigneeMemberIds(assignments: { memberId: number }[], leaderId?: number | null): number[] {
    const deduped = new Set<number>();
    for (const assignment of assignments) {
        if (leaderId != null && Number(assignment.memberId) === Number(leaderId)) continue;
        deduped.add(assignment.memberId);
    }
    return Array.from(deduped);
}

function parseDateTimeValue(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

interface ParsedAssignment {
    memberId: number;
    startDateTime: Date;
    endDateTime: Date;
}

function parseAssignments(value: unknown): { assignments: ParsedAssignment[]; error?: string } {
    if (!Array.isArray(value)) {
        return { assignments: [] };
    }

    const assignments: ParsedAssignment[] = [];
    for (const entry of value) {
        const memberId = parseId((entry as { memberId?: unknown })?.memberId);
        if (!memberId) return { assignments: [], error: 'Each assignment requires a valid memberId' };

        const start = parseDateTimeValue((entry as { startDateTime?: unknown })?.startDateTime);
        const end = parseDateTimeValue((entry as { endDateTime?: unknown })?.endDateTime);
        if (!start || !end) return { assignments: [], error: 'Each assignment requires valid start and end times' };
        if (end <= start) return { assignments: [], error: 'Assignment end time must be after start time' };
        if (start.getMinutes() % 15 !== 0 || end.getMinutes() % 15 !== 0) {
            return { assignments: [], error: 'Assignment times must use 15-minute intervals' };
        }

        assignments.push({ memberId, startDateTime: start, endDateTime: end });
    }

    return { assignments };
}

router.get('/:id/assignable-members', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const eventTeams = await prisma.eventTeam.findMany({
            where: { eventId },
            select: { teamId: true },
        });
        const teamIds = eventTeams.map((row) => row.teamId);

        if (teamIds.length === 0) return res.json([]);

        const teamMembers = await prisma.teamMember.findMany({
            where: { teamId: { in: teamIds }, isActive: true },
            select: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        const byId = new Map<number, { id: number; fullName: string; profilePhotoUrl: string | null }>();
        for (const row of teamMembers) {
            if (row.member && !byId.has(row.member.id)) {
                byId.set(row.member.id, row.member);
            }
        }

        const members = Array.from(byId.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
        return res.json(members);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/assignable-members error:`, error);
        return res.status(500).json({ error: 'Failed to fetch assignable members' });
    }
});

router.get('/:id/tasks', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const tasks = await prisma.eventTask.findMany({
            where: { eventId, isActive: true },
            orderBy: [{ taskDate: 'asc' }, { location: 'asc' }, { createdAt: 'asc' }],
            include: eventTaskInclude(),
        });

        return res.json(tasks);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/tasks error:`, error);
        return res.status(500).json({ error: 'Failed to fetch event tasks' });
    }
});

router.post('/:id/tasks', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const title = String(req.body?.title || '').trim();
        const location = String(req.body?.location || '').trim();
        const taskDate = parseDateTimeValue(req.body?.taskDate);
        if (!title) return res.status(400).json({ error: 'Task title is required' });
        if (!location) return res.status(400).json({ error: 'Location is required' });
        if (!taskDate) return res.status(400).json({ error: 'A valid task date is required' });

        const leaderId = parseId(req.body?.leaderId);
        const { assignments, error: assignmentError } = parseAssignments(req.body?.assignments);
        if (assignmentError) return res.status(400).json({ error: assignmentError });
        if (assignments.length === 0) return res.status(400).json({ error: 'At least one assignment is required' });

        const created = await prisma.eventTask.create({
            data: {
                eventId,
                title,
                description: normalizeDescription(req.body?.description),
                location,
                taskDate,
                leaderId: leaderId ?? null,
                createdByMemberId: req.user?.memberId ?? null,
                assignments: assignments.length > 0 ? {
                    create: assignments.map((assignment) => ({
                        memberId: assignment.memberId,
                        startDateTime: assignment.startDateTime,
                        endDateTime: assignment.endDateTime,
                    })),
                } : undefined,
            },
            include: eventTaskInclude(),
        });

        const actorMemberId = req.user?.memberId ?? null;
        const assigneeMemberIds = uniqueAssigneeMemberIds(
            (created.assignments || []).map((assignment) => ({ memberId: assignment.memberId })),
            created.leaderId,
        );

        if (created.leaderId) {
            try {
                await emitNotificationEvent({
                    eventType: 'EVENT_TASK_LEADER_ASSIGNED',
                    audienceType: 'EVENT',
                    actorMemberId,
                    includeActor: created.leaderId === actorMemberId,
                    persistEventWhenNoRecipients: true,
                    title: `Event Task Leader Assigned: ${created.title}`,
                    body: buildEventTaskLeaderAssignedBody(created.title, event.title),
                    metadata: {
                        eventTaskId: created.id,
                        eventId,
                        eventTitle: event.title,
                        leaderMemberId: created.leaderId,
                    },
                    audienceData: {
                        eventTaskId: created.id,
                        eventId,
                        recipientScope: 'member',
                    },
                    recipientMemberIds: [created.leaderId],
                });
            } catch (notificationError) {
                console.error(`POST /events/${req.params.id}/tasks leader assignment notification emit failed`, notificationError);
            }
        }

        if (assigneeMemberIds.length > 0) {
            try {
                await emitNotificationEvent({
                    eventType: 'EVENT_TASK_ASSIGNED',
                    audienceType: 'EVENT',
                    actorMemberId,
                    includeActor: assigneeMemberIds.includes(actorMemberId ?? -1),
                    persistEventWhenNoRecipients: true,
                    title: `Event Task Assigned: ${created.title}`,
                    body: buildEventTaskAssignedBody(created.title, event.title),
                    metadata: {
                        eventTaskId: created.id,
                        eventId,
                        eventTitle: event.title,
                        assignedMemberIds: assigneeMemberIds,
                    },
                    audienceData: {
                        eventTaskId: created.id,
                        eventId,
                        recipientScope: 'member',
                    },
                    recipientMemberIds: assigneeMemberIds,
                });
            } catch (notificationError) {
                console.error(`POST /events/${req.params.id}/tasks assignment notification emit failed`, notificationError);
            }
        }

        if (req.user?.memberId) {
            await logEventActivity({
                eventId,
                memberId: req.user.memberId,
                eventTaskId: created.id,
                actionType: 'CREATED',
                entityType: 'TASK',
                newValue: { title: created.title, location: created.location, taskDate: created.taskDate },
                description: `Task "${created.title}" created`,
            });

            for (const assignment of created.assignments || []) {
                await logEventActivity({
                    eventId,
                    memberId: req.user.memberId,
                    eventTaskId: created.id,
                    actionType: 'ASSIGNED',
                    entityType: 'ASSIGNMENT',
                    newValue: buildAssignmentActivityValue(assignment),
                    description: buildAssignedDescription(created.title, assignment),
                });
            }
        }

        return res.status(201).json(created);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/tasks error:`, error);
        return res.status(500).json({ error: 'Failed to create event task' });
    }
});

router.put('/:id/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const taskId = parseId(req.params.taskId);
        if (!eventId || !taskId) return res.status(400).json({ error: 'Invalid event or task ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const existing = await prisma.eventTask.findFirst({
            where: { id: taskId, eventId },
            select: {
                id: true,
                title: true,
                description: true,
                location: true,
                taskDate: true,
                leaderId: true,
                assignments: {
                    select: {
                        memberId: true,
                        startDateTime: true,
                        endDateTime: true,
                        member: { select: { fullName: true } },
                    },
                },
            },
        });
        if (!existing) return res.status(404).json({ error: 'Event task not found' });

        const data: Prisma.EventTaskUpdateInput = {};
        if (req.body?.title !== undefined) {
            const title = String(req.body.title || '').trim();
            if (!title) return res.status(400).json({ error: 'Task title is required' });
            data.title = title;
        }
        if (req.body?.location !== undefined) {
            const location = String(req.body.location || '').trim();
            if (!location) return res.status(400).json({ error: 'Location is required' });
            data.location = location;
        }
        if (req.body?.description !== undefined) data.description = normalizeDescription(req.body.description);
        if (req.body?.taskDate !== undefined) {
            const taskDate = parseDateTimeValue(req.body.taskDate);
            if (!taskDate) return res.status(400).json({ error: 'A valid task date is required' });
            data.taskDate = taskDate;
        }
        if (req.body?.leaderId !== undefined) {
            const leaderId = parseId(req.body.leaderId);
            data.leader = leaderId ? { connect: { id: leaderId } } : { disconnect: true };
        }

        let parsedAssignments: ParsedAssignment[] | null = null;
        if (req.body?.assignments !== undefined) {
            const { assignments, error: assignmentError } = parseAssignments(req.body.assignments);
            if (assignmentError) return res.status(400).json({ error: assignmentError });
            if (assignments.length === 0) return res.status(400).json({ error: 'At least one assignment is required' });
            parsedAssignments = assignments;
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.eventTask.update({ where: { id: taskId }, data });

            if (parsedAssignments !== null) {
                await tx.eventTaskAssignment.deleteMany({ where: { eventTaskId: taskId } });
                if (parsedAssignments.length > 0) {
                    await tx.eventTaskAssignment.createMany({
                        data: parsedAssignments.map((assignment) => ({
                            eventTaskId: taskId,
                            memberId: assignment.memberId,
                            startDateTime: assignment.startDateTime,
                            endDateTime: assignment.endDateTime,
                        })),
                    });
                }
            }

            return tx.eventTask.findUnique({ where: { id: taskId }, include: eventTaskInclude() });
        });

        if (!updated) return res.status(404).json({ error: 'Event task not found' });

        const actorMemberId = req.user?.memberId ?? null;
        const beforeAssigneeIds = uniqueAssigneeMemberIds(existing.assignments, existing.leaderId);

        const leaderChanged = req.body?.leaderId !== undefined && updated.leaderId !== existing.leaderId;
        if (leaderChanged && updated.leaderId !== null) {
            try {
                await emitNotificationEvent({
                    eventType: 'EVENT_TASK_LEADER_ASSIGNED',
                    audienceType: 'EVENT',
                    actorMemberId,
                    includeActor: updated.leaderId === actorMemberId,
                    persistEventWhenNoRecipients: true,
                    title: `Event Task Leader Assigned: ${updated.title}`,
                    body: buildEventTaskLeaderAssignedBody(updated.title, event.title),
                    metadata: {
                        eventTaskId: taskId,
                        eventId,
                        eventTitle: event.title,
                        leaderMemberId: updated.leaderId,
                        previousLeaderMemberId: existing.leaderId,
                    },
                    audienceData: {
                        eventTaskId: taskId,
                        eventId,
                        recipientScope: 'member',
                    },
                    recipientMemberIds: [updated.leaderId],
                });
            } catch (notificationError) {
                console.error(`PUT /events/${req.params.id}/tasks/${req.params.taskId} leader assignment notification emit failed`, notificationError);
            }
        }

        if (parsedAssignments !== null) {
            const afterAssigneeIds = uniqueAssigneeMemberIds(
                (updated.assignments || []).map((assignment) => ({ memberId: assignment.memberId })),
                updated.leaderId,
            );
            const addedAssigneeIds = afterAssigneeIds.filter((memberId) => !beforeAssigneeIds.includes(memberId));

            if (addedAssigneeIds.length > 0) {
                try {
                    await emitNotificationEvent({
                        eventType: 'EVENT_TASK_ASSIGNED',
                        audienceType: 'EVENT',
                        actorMemberId,
                        includeActor: addedAssigneeIds.includes(actorMemberId ?? -1),
                        persistEventWhenNoRecipients: true,
                        title: `Event Task Assigned: ${updated.title}`,
                        body: buildEventTaskAssignedBody(updated.title, event.title),
                        metadata: {
                            eventTaskId: taskId,
                            eventId,
                            eventTitle: event.title,
                            assignedMemberIds: addedAssigneeIds,
                        },
                        audienceData: {
                            eventTaskId: taskId,
                            eventId,
                            recipientScope: 'member',
                        },
                        recipientMemberIds: addedAssigneeIds,
                    });
                } catch (notificationError) {
                    console.error(`PUT /events/${req.params.id}/tasks/${req.params.taskId} assignment notification emit failed`, notificationError);
                }
            }
        }

        if (req.user?.memberId) {
            const taskChanges = collectChangedFields(existing, updated, {
                title: 'title',
                description: 'description',
                location: 'location',
                taskDate: 'task date',
                leaderId: 'leader',
            });
            if (taskChanges.length > 0) {
                const { oldValue, newValue } = changesToPayload(taskChanges);
                await logEventActivity({
                    eventId,
                    memberId: req.user.memberId,
                    eventTaskId: taskId,
                    actionType: 'UPDATED',
                    entityType: 'TASK',
                    oldValue,
                    newValue,
                    description: summarizeChanges(taskChanges) || `Task "${updated.title}" updated`,
                });
            }

            if (parsedAssignments !== null) {
                const beforeKeys = new Set(
                    existing.assignments.map((a) => `${a.memberId}:${a.startDateTime.toISOString()}:${a.endDateTime.toISOString()}`),
                );
                const afterKeys = new Set(
                    (updated.assignments || []).map((a) => `${a.memberId}:${a.startDateTime.toISOString()}:${a.endDateTime.toISOString()}`),
                );

                for (const assignment of updated.assignments || []) {
                    const key = `${assignment.memberId}:${assignment.startDateTime.toISOString()}:${assignment.endDateTime.toISOString()}`;
                    if (!beforeKeys.has(key)) {
                        await logEventActivity({
                            eventId,
                            memberId: req.user.memberId,
                            eventTaskId: taskId,
                            actionType: 'ASSIGNED',
                            entityType: 'ASSIGNMENT',
                            newValue: buildAssignmentActivityValue(assignment),
                            description: buildAssignedDescription(updated.title, assignment),
                        });
                    }
                }

                for (const assignment of existing.assignments) {
                    const key = `${assignment.memberId}:${assignment.startDateTime.toISOString()}:${assignment.endDateTime.toISOString()}`;
                    if (!afterKeys.has(key)) {
                        await logEventActivity({
                            eventId,
                            memberId: req.user.memberId,
                            eventTaskId: taskId,
                            actionType: 'UNASSIGNED',
                            entityType: 'ASSIGNMENT',
                            oldValue: buildAssignmentActivityValue(assignment),
                            description: buildUnassignedDescription(updated.title, assignment),
                        });
                    }
                }
            }
        }

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id}/tasks/${req.params.taskId} error:`, error);
        return res.status(500).json({ error: 'Failed to update event task' });
    }
});

router.delete('/:id/tasks/:taskId/assignments/:assignmentId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const taskId = parseId(req.params.taskId);
        const assignmentId = parseId(req.params.assignmentId);
        if (!eventId || !taskId || !assignmentId) {
            return res.status(400).json({ error: 'Invalid event, task, or assignment ID' });
        }

        const task = await prisma.eventTask.findFirst({
            where: { id: taskId, eventId },
            select: { id: true, leaderId: true, title: true },
        });
        if (!task) return res.status(404).json({ error: 'Event task not found' });

        const assignment = await prisma.eventTaskAssignment.findFirst({
            where: { id: assignmentId, eventTaskId: taskId },
            select: {
                id: true,
                memberId: true,
                startDateTime: true,
                endDateTime: true,
                member: { select: { fullName: true } },
            },
        });
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            eventTaskId: taskId,
            actionType: 'UNASSIGNED',
            entityType: 'ASSIGNMENT',
            oldValue: buildAssignmentActivityValue(assignment),
            description: buildUnassignedDescription(task.title, assignment),
        });

        await prisma.$transaction(async (tx) => {
            await tx.eventTaskAssignment.delete({ where: { id: assignmentId } });

            if (task.leaderId != null && Number(task.leaderId) === Number(assignment.memberId)) {
                await tx.eventTask.update({
                    where: { id: taskId },
                    data: { leaderId: null },
                });
            }

            const remainingCount = await tx.eventTaskAssignment.count({ where: { eventTaskId: taskId } });
            if (remainingCount === 0) {
                await tx.eventTask.delete({ where: { id: taskId } });
            }
        });

        return res.json({ success: true, message: 'Assignment removed' });
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/tasks/${req.params.taskId}/assignments/${req.params.assignmentId} error:`, error);
        return res.status(500).json({ error: 'Failed to remove assignment' });
    }
});

router.delete('/:id/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const taskId = parseId(req.params.taskId);
        if (!eventId || !taskId) return res.status(400).json({ error: 'Invalid event or task ID' });

        const existing = await prisma.eventTask.findFirst({ where: { id: taskId, eventId }, select: { id: true, title: true } });
        if (!existing) return res.status(404).json({ error: 'Event task not found' });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            eventTaskId: taskId,
            actionType: 'DELETED',
            entityType: 'TASK',
            oldValue: { title: existing.title },
            description: `Task "${existing.title}" deleted`,
        });

        await prisma.eventTask.delete({ where: { id: taskId } });
        return res.json({ success: true, message: 'Event task deleted' });
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/tasks/${req.params.taskId} error:`, error);
        return res.status(500).json({ error: 'Failed to delete event task' });
    }
});

export default router;
