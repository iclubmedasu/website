import { Prisma } from '@prisma/client';
import {
    coerceImportCustomFieldValue,
    CustomFieldRow,
    getDropdownOptions,
    getMissingRequiredCustomFieldsFromValues,
    toJsonInput,
    validateRequiredCustomFieldValues,
} from '../lib/customFields';
import { prisma } from '../db';
import express, { Request, Response } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import { generateUniqueConfirmationCode } from '../services/eventCode';
import { formatEventDay, isWithinEventDays, parseEventDayString, resolveCheckInEventDay, eventDayStringToDate, shouldSendWalkInTicket } from '../services/eventDates';
import { generateTokensForSession, generateTokensForRegistration } from '../services/sessionTokenService';
import { emitNotificationEvent } from '../services/notificationService';
import { sendEventReminderEmail, sendEventTicketEmail } from '../services/eventTicketEmailService';
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
import {
    assertAssigneesOnEventTeams,
    buildActiveEventVisibilityWhere,
    canUserAccessEventOperations,
    canUserEditEvent,
    canUserManageCustomFields,
    canUserManageEventLifecycle,
    canUserManageEventTasks,
    canUserManageEventTiers,
    canUserPublishEvent,
    canUserRemoveAttendance,
    canUserViewAllEvents,
    canUserViewEvent,
    isPrivilegedUser,
} from '../lib/eventPermissions';
import { mergeRegistrationCustomFieldValues } from '../lib/atomicJsonMerge';
import { respondWithPrismaConflict, sendConflictResponse } from '../lib/conflictResponse';
import {
    parseExpectedVersion,
    respondVersionConflict,
    updateEventRegistrationOptimistic,
} from '../lib/optimisticLock';
import { publishEventChanged } from '../lib/resourceRealtime';

const router = express.Router();

// Active events visible on the public registration site use isPublished.
const VALID_EVENT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']);
const VALID_PROGRESS_STATUSES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']);
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']);
const VALID_TIER_CURRENCIES = new Set(['USD', 'EUR', 'EGP']);
const VALID_SESSION_MODES = new Set(['ONSITE', 'ONLINE']);

function queueTicketEmail(registrationId: number, context: string): void {
    void sendEventTicketEmail(registrationId).catch((error) => {
        console.error(`Failed to send ticket email (${context}) for registration ${registrationId}:`, error);
    });
}

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

const registrationInclude = {
    tier: { select: { id: true, name: true } },
    member: { select: { id: true, fullName: true, email: true } },
    attendanceDays: { orderBy: { eventDay: 'asc' as const } },
    sessionAttendances: {
        select: { id: true, sessionId: true, registrationId: true, mode: true, joinedAt: true },
        orderBy: { joinedAt: 'asc' as const },
    },
    sessionSelections: {
        select: {
            sessionId: true,
            session: {
                select: {
                    id: true,
                    label: true,
                    sessionDate: true,
                    startTime: true,
                    endTime: true,
                    mode: true,
                },
            },
        },
    },
} satisfies Prisma.EventRegistrationInclude;

type RegistrationWithDays = Prisma.EventRegistrationGetPayload<{ include: typeof registrationInclude }>;

function serializeAttendanceDays(
    days: Array<{ eventDay: Date; checkedInAt: Date }>,
): Array<{ eventDay: string; checkedInAt: string }> {
    return days.map((day) => ({
        eventDay: formatEventDay(day.eventDay),
        checkedInAt: day.checkedInAt.toISOString(),
    }));
}

function serializeRegistration(registration: RegistrationWithDays | (Omit<RegistrationWithDays, 'sessionSelections'> & {
    sessionSelections?: Array<{
        sessionId: number;
        session?: {
            label: string | null;
            sessionDate: Date;
            startTime: string | null;
            endTime: string | null;
            mode: string;
        } | null;
    }>;
})) {
    const { attendanceDays, onlineAccessToken: _token, sessionSelections, ...rest } = registration;
    const selections = (sessionSelections ?? [])
        .map((selection) => ({
            sessionId: selection.sessionId,
            label: selection.session?.label ?? null,
            sessionDate: selection.session ? formatEventDay(selection.session.sessionDate) : '',
            startTime: selection.session?.startTime ?? null,
            endTime: selection.session?.endTime ?? null,
            mode: selection.session?.mode ?? 'ONSITE',
        }))
        .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

    return {
        ...rest,
        attendanceDays: serializeAttendanceDays(attendanceDays ?? []),
        sessionSelections: selections,
    };
}

function hasAttendanceOnDay(attendanceDays: Array<{ eventDay: Date }>, eventDay: string): boolean {
    return attendanceDays.some((day) => formatEventDay(day.eventDay) === eventDay);
}

async function findActiveEventRegistration(
    eventId: number,
    { email, memberId }: { email: string; memberId?: number | null },
): Promise<RegistrationWithDays | null> {
    const or: Prisma.EventRegistrationWhereInput[] = [
        { eventId, email, status: { not: 'CANCELLED' } },
    ];
    if (memberId) {
        or.push({ eventId, memberId, status: { not: 'CANCELLED' } });
    }
    return prisma.eventRegistration.findFirst({
        where: { OR: or },
        include: registrationInclude,
    });
}

async function resolveMemberIdByEmail(email: string): Promise<number | null> {
    const normalized = email.trim().toLowerCase();
    const member = await prisma.member.findFirst({
        where: {
            OR: [
                { email: normalized },
                { email2: normalized },
                { email3: normalized },
            ],
        },
        select: { id: true },
    });
    return member?.id ?? null;
}

function slugImportFullName(fullName: string): string {
    const slug = fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'attendee';
}

function buildImportPlaceholderEmail(eventId: number, fullName: string): string {
    return `import.${eventId}.${slugImportFullName(fullName)}@event-import.local`;
}

function isImportPlaceholderEmail(email: string): boolean {
    return email.trim().toLowerCase().endsWith('@event-import.local');
}

async function findActiveEventRegistrationForImport(
    eventId: number,
    { fullName, email }: { fullName: string; email?: string | null },
): Promise<RegistrationWithDays | null> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (normalizedEmail) {
        const memberId = await resolveMemberIdByEmail(normalizedEmail);
        return findActiveEventRegistration(eventId, { email: normalizedEmail, memberId });
    }

    const placeholderEmail = buildImportPlaceholderEmail(eventId, fullName);
    const byPlaceholder = await prisma.eventRegistration.findFirst({
        where: { eventId, email: placeholderEmail, status: { not: 'CANCELLED' } },
        include: registrationInclude,
    });
    if (byPlaceholder) return byPlaceholder;

    return prisma.eventRegistration.findFirst({
        where: {
            eventId,
            status: { not: 'CANCELLED' },
            fullName: { equals: fullName.trim(), mode: 'insensitive' },
            email: { endsWith: '@event-import.local' },
        },
        include: registrationInclude,
    });
}

async function ensureCanViewEvent(res: Response, req: Request, eventId: number, isArchived: boolean): Promise<boolean> {
    const allowed = await canUserViewEvent(req.user, eventId, isArchived);
    if (!allowed) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

async function ensureCanAccessEventOperations(res: Response, req: Request, eventId: number, isArchived: boolean): Promise<boolean> {
    const allowed = await canUserAccessEventOperations(req.user, eventId, isArchived);
    if (!allowed) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

async function ensureEventOperationsAccess(res: Response, req: Request, eventId: number): Promise<boolean> {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });
    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return false;
    }
    return ensureCanAccessEventOperations(res, req, eventId, event.isArchived);
}

async function ensureCanManageCustomFields(res: Response, req: Request, eventId: number): Promise<boolean> {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });
    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return false;
    }
    const allowed = await canUserManageCustomFields(req.user, eventId, event.isArchived);
    if (!allowed) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

async function buildEventWhere(req: Request) {
    const whereAnd: Record<string, unknown>[] = [];
    const isArchivedQuery = String(req.query.archived || '').trim().toLowerCase() === 'true';

    if (isArchivedQuery) {
        whereAnd.push({ isArchived: true });
    } else {
        whereAnd.push({ isArchived: false });
    }

    const status = String(req.query.status || '').trim().toUpperCase();
    const projectId = parseId(req.query.projectId);
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const scope = String(req.query.scope || '').trim().toLowerCase();

    if (status && VALID_EVENT_STATUSES.has(status)) {
        whereAnd.push({ status });
    } else if (canUserViewAllEvents(req.user) && scope === 'all') {
        // Global admin roles may request all statuses when scope=all.
    }

    if (projectId) {
        whereAnd.push({ projectId });
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
            whereAnd.push(dateFilters[0]);
        } else if (dateFilters.length > 1) {
            whereAnd.push(...dateFilters);
        }
    }

    if (!isArchivedQuery) {
        const visibilityWhere = await buildActiveEventVisibilityWhere(req.user);
        if (visibilityWhere) whereAnd.push(visibilityWhere);
    }

    return whereAnd.length ? { AND: whereAnd } : {};
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

function canPublicView(event: { isPublished: boolean; isActive: boolean; isArchived?: boolean }): boolean {
    return event.isActive && !event.isArchived && event.isPublished;
}

function parseSessionTime(value: unknown): string | null {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
    const [hours, minutes] = trimmed.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return trimmed;
}

function parseSessionDate(value: unknown): Date | null {
    const day = parseEventDayString(value);
    if (!day) return null;
    return eventDayStringToDate(day);
}

function normalizeSessionMode(value: unknown): string | null {
    const mode = String(value || '').trim().toUpperCase();
    return VALID_SESSION_MODES.has(mode) ? mode : null;
}

function requiresOnlineUrl(mode: string): boolean {
    return mode === 'ONLINE';
}

function parseSessionIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const ids = value
        .map((entry) => parseId(entry))
        .filter((id): id is number => id != null);
    return [...new Set(ids)];
}

type SessionTimeWindow = { sessionDate: Date; startTime: string | null; endTime: string | null };

function toLocalDayString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toLocalTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function doSessionsOverlap(a: SessionTimeWindow, b: SessionTimeWindow): boolean {
    if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
    if (formatEventDay(a.sessionDate) !== formatEventDay(b.sessionDate)) return false;
    return a.startTime < b.endTime && b.startTime < a.endTime;
}

async function getActiveSessionsAtTime(eventId: number, referenceDate: Date) {
    const day = toLocalDayString(referenceDate);
    const hhmm = toLocalTimeString(referenceDate);
    const sessions = await prisma.eventSession.findMany({
        where: {
            eventId,
            isActive: true,
            sessionDate: eventDayStringToDate(day),
            startTime: { not: null },
            endTime: { not: null },
        },
        orderBy: [{ startTime: 'asc' }, { order: 'asc' }],
    });
    return sessions.filter((session) => session.startTime! <= hhmm && hhmm < session.endTime!);
}

async function findOverlappingSessionAttendance(
    registrationId: number,
    target: SessionTimeWindow,
) {
    const attendances = await prisma.eventSessionAttendance.findMany({
        where: { registrationId, mode: 'ONSITE' },
        include: {
            session: {
                select: { label: true, sessionDate: true, startTime: true, endTime: true },
            },
        },
    });
    return attendances.find((attendance) => attendance.session && doSessionsOverlap(attendance.session, target)) ?? null;
}

async function validateSessionIdsForEvent(
    eventId: number,
    sessionIds: number[],
): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
    if (sessionIds.length === 0) {
        return { ok: true, ids: [] };
    }

    const sessions = await prisma.eventSession.findMany({
        where: { eventId, id: { in: sessionIds }, isActive: true },
        select: { id: true },
    });

    if (sessions.length !== sessionIds.length) {
        return { ok: false, error: 'One or more selected sessions are invalid' };
    }

    return { ok: true, ids: sessionIds };
}

async function createRegistrationSessionSelections(
    registrationId: number,
    sessionIds: number[],
): Promise<void> {
    if (sessionIds.length === 0) return;

    await prisma.eventRegistrationSession.createMany({
        data: sessionIds.map((sessionId) => ({ registrationId, sessionId })),
        skipDuplicates: true,
    });
}

function queueSessionTokenGeneration(sessionId: number, context: string): void {
    void generateTokensForSession(sessionId).catch((error) => {
        console.error(`Failed to generate session tokens (${context}) for session ${sessionId}:`, error);
    });
}

function queueRegistrationTokenGeneration(registrationId: number, context: string): void {
    void generateTokensForRegistration(registrationId).catch((error) => {
        console.error(`Failed to generate session tokens (${context}) for registration ${registrationId}:`, error);
    });
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
    showOnPublic: 'show on public',
};

const SESSION_FIELD_LABELS: Record<string, string> = {
    label: 'label',
    sessionDate: 'session date',
    startTime: 'start time',
    endTime: 'end time',
    mode: 'mode',
    onlineUrl: 'online URL',
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

function validateImportCustomFieldValues(
    fields: CustomFieldRow[],
    customFieldValues: Record<string, unknown>,
): string | null {
    for (const field of fields) {
        const value = customFieldValues[String(field.id)];
        if (value === null || value === undefined || value === '') {
            if (field.required) return `${field.label} is required.`;
            continue;
        }
        if (field.type === 'dropdown') {
            const allowed = getDropdownOptions(field.options);
            const raw = String(value).trim();
            const match = allowed.find((option) => option.toLowerCase() === raw.toLowerCase());
            if (!match) return `Invalid value "${raw}" for ${field.label}.`;
        }
    }
    return null;
}

function remapImportedCustomFieldValues(
    rawValues: Record<string, unknown> | undefined,
    newFieldIdByExcelColumn: Map<string, number>,
): Record<string, unknown> {
    if (!rawValues) return {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawValues)) {
        const mappedId = newFieldIdByExcelColumn.get(key) ?? parseId(key);
        if (mappedId) {
            result[String(mappedId)] = value;
        }
    }
    return result;
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

        if (!(await ensureCanViewEvent(res, req, eventId, event.isArchived))) return;

        const canEdit = await canUserEditEvent(req.user, eventId);
        return res.json({ ...event, canEdit });
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

        if (!(await ensureCanViewEvent(res, req, eventId, event.isArchived))) return;

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
        if (!canUserManageEventLifecycle(req.user)) {
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
        if (!canUserManageEventLifecycle(req.user)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        if (!(await canUserEditEvent(req.user, eventId))) {
            return res.status(403).json({ error: 'Event management access required' });
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
        if (!canUserManageEventLifecycle(req.user)) {
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
        if (!canUserManageEventLifecycle(req.user)) {
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
        if (!canUserManageEventLifecycle(req.user)) {
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
        if (!canUserManageEventLifecycle(req.user)) {
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
                isDisclosed: false,
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
        if (!canUserManageEventLifecycle(req.user)) {
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

router.patch('/:id/disclose', authenticateToken, async (req, res) => {
    try {
        if (!canUserManageEventLifecycle(req.user)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const disclosed = req.body?.disclosed;
        if (typeof disclosed !== 'boolean') {
            return res.status(400).json({ error: 'disclosed must be a boolean' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (!current.isArchived) {
            return res.status(400).json({ error: 'Only archived events can be disclosed on the public website' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: { isDisclosed: disclosed },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: disclosed ? 'DISCLOSED' : 'UNDISCLOSED',
            entityType: 'EVENT',
            oldValue: { isDisclosed: current.isDisclosed },
            newValue: { isDisclosed: disclosed },
            description: disclosed
                ? `Event "${current.title}" disclosed on the public website`
                : `Event "${current.title}" hidden from the public website`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/disclose error:`, error);
        return res.status(500).json({ error: 'Failed to update event disclosure' });
    }
});

router.patch('/:id/publish', authenticateToken, async (req, res) => {
    try {
        if (!canUserPublishEvent(req.user)) {
            return res.status(403).json({ error: 'Event publish access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const published = req.body?.published;
        if (typeof published !== 'boolean') {
            return res.status(400).json({ error: 'published must be a boolean' });
        }

        const current = await prisma.event.findUnique({ where: { id: eventId } });
        if (!current) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (current.isArchived) {
            return res.status(400).json({ error: 'Archived events cannot be published' });
        }
        if (current.isFinalized) {
            return res.status(400).json({ error: 'Finalized events cannot be published' });
        }
        if (!current.isActive || current.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Inactive or cancelled events cannot be published' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: { isPublished: published },
            include: eventInclude(),
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: published ? 'PUBLISHED' : 'UNPUBLISHED',
            entityType: 'EVENT',
            oldValue: { isPublished: current.isPublished },
            newValue: { isPublished: published },
            description: published
                ? `Event "${current.title}" published for public registration`
                : `Event "${current.title}" unpublished from the public website`,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/publish error:`, error);
        return res.status(500).json({ error: 'Failed to update event publish status' });
    }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        if (!canUserManageEventLifecycle(req.user)) {
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
                isPublished: nextStatus === 'PUBLISHED' && !current.isArchived,
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
        if (!canUserManageEventLifecycle(req.user)) {
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

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, isArchived: true, isActive: true, isPublished: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const canView = await canUserViewEvent(req.user, eventId, event.isArchived);
        if (!canView && !canPublicView(event)) return res.status(404).json({ error: 'Event not found' });

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
        if (!canUserManageEventTiers(req.user)) return res.status(403).json({ error: 'Access denied' });

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
                showOnPublic: Boolean(req.body?.showOnPublic),
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
        if (!canUserManageEventTiers(req.user)) return res.status(403).json({ error: 'Access denied' });

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
                showOnPublic: req.body?.showOnPublic !== undefined ? Boolean(req.body.showOnPublic) : existing.showOnPublic,
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
        if (!canUserManageEventTiers(req.user)) return res.status(403).json({ error: 'Access denied' });

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
// Event sessions
// ============================================
router.get('/:id/sessions', optionalAuthenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, isArchived: true, isActive: true, isPublished: true },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const canView = await canUserViewEvent(req.user, eventId, event.isArchived);
        if (!canView && !canPublicView(event)) return res.status(404).json({ error: 'Event not found' });

        const sessions = await prisma.eventSession.findMany({
            where: { eventId, isActive: true },
            orderBy: [{ sessionDate: 'asc' }, { order: 'asc' }],
            include: { _count: { select: { attendances: true } } },
        });

        return res.json(sessions);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/sessions error:`, error);
        return res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

router.post('/:id/sessions', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!await ensureEventOperationsAccess(res, req, eventId)) return;

        const sessionDate = parseSessionDate(req.body?.sessionDate);
        if (!sessionDate) return res.status(400).json({ error: 'Valid sessionDate is required (YYYY-MM-DD)' });

        const mode = normalizeSessionMode(req.body?.mode);
        if (!mode) return res.status(400).json({ error: 'Valid mode is required (ONSITE or ONLINE)' });

        const onlineUrl = req.body?.onlineUrl !== undefined && req.body?.onlineUrl !== null
            ? String(req.body.onlineUrl).trim() || null
            : null;
        if (requiresOnlineUrl(mode) && !onlineUrl) {
            return res.status(400).json({ error: 'onlineUrl is required for ONLINE sessions' });
        }

        const label = String(req.body?.label ?? '').trim();
        if (!label) return res.status(400).json({ error: 'Session title is required' });

        const startTime = req.body?.startTime !== undefined ? parseSessionTime(req.body.startTime) : null;
        if (req.body?.startTime !== undefined && req.body?.startTime !== null && String(req.body.startTime).trim() && !startTime) {
            return res.status(400).json({ error: 'startTime must be in HH:MM format' });
        }

        const endTime = req.body?.endTime !== undefined ? parseSessionTime(req.body.endTime) : null;
        if (req.body?.endTime !== undefined && req.body?.endTime !== null && String(req.body.endTime).trim() && !endTime) {
            return res.status(400).json({ error: 'endTime must be in HH:MM format' });
        }

        const created = await prisma.eventSession.create({
            data: {
                eventId,
                label,
                sessionDate,
                startTime,
                endTime,
                mode,
                onlineUrl,
                order: Number.isInteger(Number(req.body?.order)) ? Number(req.body.order) : 0,
            },
            include: { _count: { select: { attendances: true } } },
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CREATED',
            entityType: 'SESSION',
            newValue: {
                label: created.label,
                sessionDate: formatEventDay(created.sessionDate),
                mode: created.mode,
                onlineUrl: created.onlineUrl,
            },
            description: created.label
                ? `Session "${created.label}" created`
                : `Session on ${formatEventDay(created.sessionDate)} created`,
        });

        if (created.mode === 'ONLINE') {
            queueSessionTokenGeneration(created.id, 'session-create');
        }

        return res.status(201).json(created);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/sessions error:`, error);
        return res.status(500).json({ error: 'Failed to create session' });
    }
});

router.patch('/:id/sessions/generate-tokens', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const sessions = await prisma.eventSession.findMany({
            where: { eventId, isActive: true, mode: 'ONLINE' },
            select: { id: true },
        });

        let generated = 0;
        for (const session of sessions) {
            generated += await generateTokensForSession(session.id);
        }
        return res.json({ generated });
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/sessions/generate-tokens error:`, error);
        return res.status(500).json({ error: 'Failed to generate tokens' });
    }
});

router.put('/:id/sessions/:sessionId', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const sessionId = parseId(req.params.sessionId);
        if (!eventId || !sessionId) return res.status(400).json({ error: 'Invalid event or session ID' });
        if (!await ensureEventOperationsAccess(res, req, eventId)) return;

        const existing = await prisma.eventSession.findFirst({ where: { id: sessionId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Session not found' });

        const sessionDate = req.body?.sessionDate !== undefined
            ? parseSessionDate(req.body.sessionDate)
            : existing.sessionDate;
        if (req.body?.sessionDate !== undefined && !sessionDate) {
            return res.status(400).json({ error: 'Valid sessionDate is required (YYYY-MM-DD)' });
        }

        const mode = req.body?.mode !== undefined
            ? normalizeSessionMode(req.body.mode)
            : existing.mode;
        if (req.body?.mode !== undefined && !mode) {
            return res.status(400).json({ error: 'Valid mode is required (ONSITE or ONLINE)' });
        }

        const onlineUrl = req.body?.onlineUrl !== undefined
            ? (req.body.onlineUrl === null || String(req.body.onlineUrl).trim() === ''
                ? null
                : String(req.body.onlineUrl).trim())
            : existing.onlineUrl;

        if (mode && requiresOnlineUrl(mode) && !onlineUrl) {
            return res.status(400).json({ error: 'onlineUrl is required for ONLINE sessions' });
        }

        const nextLabel = req.body?.label !== undefined
            ? String(req.body.label).trim() || null
            : existing.label;
        if (!nextLabel) return res.status(400).json({ error: 'Session title is required' });

        let startTime = existing.startTime;
        if (req.body?.startTime !== undefined) {
            if (req.body.startTime === null || String(req.body.startTime).trim() === '') {
                startTime = null;
            } else {
                const parsed = parseSessionTime(req.body.startTime);
                if (!parsed) return res.status(400).json({ error: 'startTime must be in HH:MM format' });
                startTime = parsed;
            }
        }

        let endTime = existing.endTime;
        if (req.body?.endTime !== undefined) {
            if (req.body.endTime === null || String(req.body.endTime).trim() === '') {
                endTime = null;
            } else {
                const parsed = parseSessionTime(req.body.endTime);
                if (!parsed) return res.status(400).json({ error: 'endTime must be in HH:MM format' });
                endTime = parsed;
            }
        }

        const updated = await prisma.eventSession.update({
            where: { id: sessionId },
            data: {
                label: nextLabel,
                sessionDate: sessionDate ?? existing.sessionDate,
                startTime,
                endTime,
                mode: mode ?? existing.mode,
                onlineUrl,
                order: req.body?.order !== undefined && Number.isInteger(Number(req.body.order))
                    ? Number(req.body.order)
                    : existing.order,
                isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive,
            },
            include: { _count: { select: { attendances: true } } },
        });

        const sessionChanges = collectChangedFields(
            {
                ...existing,
                sessionDate: formatEventDay(existing.sessionDate),
            },
            {
                ...updated,
                sessionDate: formatEventDay(updated.sessionDate),
            },
            SESSION_FIELD_LABELS,
        );
        if (sessionChanges.length > 0) {
            const { oldValue, newValue } = changesToPayload(sessionChanges);
            await logEventActivity({
                eventId,
                memberId: req.user!.memberId!,
                actionType: 'UPDATED',
                entityType: 'SESSION',
                oldValue,
                newValue,
                description: summarizeChanges(sessionChanges) || `Session updated`,
            });
        }

        if (updated.mode === 'ONLINE') {
            queueSessionTokenGeneration(updated.id, 'session-update');
        }

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id}/sessions/${req.params.sessionId} error:`, error);
        return res.status(500).json({ error: 'Failed to update session' });
    }
});

router.delete('/:id/sessions/:sessionId', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const sessionId = parseId(req.params.sessionId);
        if (!eventId || !sessionId) return res.status(400).json({ error: 'Invalid event or session ID' });
        if (!await ensureEventOperationsAccess(res, req, eventId)) return;

        const session = await prisma.eventSession.findFirst({
            where: { id: sessionId, eventId },
            select: { id: true, label: true, sessionDate: true },
        });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const attendanceCount = await prisma.eventSessionAttendance.count({ where: { sessionId } });
        if (attendanceCount > 0) {
            return res.status(409).json({ error: 'Cannot delete a session that has attendance records' });
        }

        await prisma.eventSession.deleteMany({ where: { id: sessionId, eventId } });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'DELETED',
            entityType: 'SESSION',
            oldValue: {
                label: session.label,
                sessionDate: formatEventDay(session.sessionDate),
            },
            description: session.label
                ? `Session "${session.label}" deleted`
                : `Session on ${formatEventDay(session.sessionDate)} deleted`,
        });

        return res.json({ success: true });
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/sessions/${req.params.sessionId} error:`, error);
        return res.status(500).json({ error: 'Failed to remove session' });
    }
});

router.get('/:id/join', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const token = String(req.query.token || '').trim();

        if (!eventId || !token) {
            return res.status(400).json({ error: 'Invalid join link' });
        }

        const sessionToken = await prisma.eventSessionToken.findFirst({
            where: {
                token,
                session: { eventId, isActive: true },
            },
            select: {
                registrationId: true,
                session: {
                    select: {
                        id: true,
                        onlineUrl: true,
                        mode: true,
                        sessionDate: true,
                        startTime: true,
                        endTime: true,
                    },
                },
                registration: {
                    select: { id: true, status: true },
                },
            },
        });

        if (!sessionToken) {
            return res.status(404).json({ error: 'Join link not found or invalid' });
        }

        if (sessionToken.registration.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }

        const { session } = sessionToken;
        if (session.mode === 'ONSITE' || !session.onlineUrl) {
            return res.status(409).json({ error: 'This session is not available for online join' });
        }

        if (session.startTime && session.endTime) {
            const activeNow = await getActiveSessionsAtTime(eventId, new Date());
            if (!activeNow.some((active) => active.id === session.id)) {
                return res.status(409).json({
                    error: 'This session is not currently active. Online join is only available during the session time.',
                });
            }
        }

        await prisma.eventSessionAttendance.upsert({
            where: {
                sessionId_registrationId_mode: {
                    sessionId: session.id,
                    registrationId: sessionToken.registrationId,
                    mode: 'ONLINE',
                },
            },
            create: {
                sessionId: session.id,
                registrationId: sessionToken.registrationId,
                mode: 'ONLINE',
                joinedAt: new Date(),
            },
            update: {},
        });

        return res.redirect(session.onlineUrl);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/join error:`, error);
        return res.status(500).json({ error: 'Failed to process join link' });
    }
});

router.patch('/:id/registration-columns', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureCanManageCustomFields(res, req, eventId))) return;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                tierFieldShowOnPublic: true,
                tierFieldRequired: true,
                sessionFieldShowOnPublic: true,
                sessionFieldRequired: true,
            },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const data: Prisma.EventUpdateInput = {};
        if (req.body?.tierFieldShowOnPublic !== undefined) {
            data.tierFieldShowOnPublic = Boolean(req.body.tierFieldShowOnPublic);
        }
        if (req.body?.tierFieldRequired !== undefined) {
            data.tierFieldRequired = Boolean(req.body.tierFieldRequired);
        }
        if (req.body?.sessionFieldShowOnPublic !== undefined) {
            data.sessionFieldShowOnPublic = Boolean(req.body.sessionFieldShowOnPublic);
        }
        if (req.body?.sessionFieldRequired !== undefined) {
            data.sessionFieldRequired = Boolean(req.body.sessionFieldRequired);
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No registration column settings provided' });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data,
            select: {
                id: true,
                tierFieldShowOnPublic: true,
                tierFieldRequired: true,
                sessionFieldShowOnPublic: true,
                sessionFieldRequired: true,
            },
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/registration-columns error:`, error);
        return res.status(500).json({ error: 'Failed to update registration columns' });
    }
});

// ============================================
// Event custom fields
// ============================================
router.get('/:id/custom-fields', async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, isArchived: true, isActive: true, isPublished: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const canView = await canUserViewEvent(req.user, eventId, event.isArchived);
        if (!canView && !canPublicView(event)) return res.status(404).json({ error: 'Event not found' });

        const fields = await prisma.eventCustomField.findMany({
            where: {
                eventId,
                ...(req.query.publicOnly === 'true' && !canView
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
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureCanManageCustomFields(res, req, eventId))) return;

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
        const eventId = parseId(req.params.id);
        const fieldId = parseId(req.params.fieldId);
        if (!eventId || !fieldId) return res.status(400).json({ error: 'Invalid event or field ID' });
        if (!(await ensureCanManageCustomFields(res, req, eventId))) return;

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
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureCanManageCustomFields(res, req, eventId))) return;

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
        const eventId = parseId(req.params.id);
        const fieldId = parseId(req.params.fieldId);
        if (!eventId || !fieldId) return res.status(400).json({ error: 'Invalid event or field ID' });
        if (!(await ensureCanManageCustomFields(res, req, eventId))) return;

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
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const tierId = parseId(req.query.tierId);
        const checkInStatus = String(req.query.checkInStatus || '').trim().toUpperCase();
        const walkIn = String(req.query.walkIn || '').trim().toLowerCase();
        const source = String(req.query.source || '').trim().toUpperCase();
        const sourceGroup = String(req.query.sourceGroup || '').trim().toUpperCase();
        const ticketStatus = String(req.query.ticketStatus || '').trim().toUpperCase();
        const reminderStatus = String(req.query.reminderStatus || '').trim().toUpperCase();
        const eventDayFilter = parseEventDayString(req.query.eventDay);

        const VALID_REGISTRATION_SOURCES = new Set(['PORTAL', 'PUBLIC', 'IMPORT', 'WALK_IN']);

        const where: Prisma.EventRegistrationWhereInput = { eventId };
        if (tierId) where.tierId = tierId;
        if (checkInStatus === 'CHECKED_IN') {
            where.status = 'CHECKED_IN';
        } else if (checkInStatus === 'NOT_CHECKED_IN') {
            where.status = 'REGISTERED';
        } else if (checkInStatus === 'CHECKED_IN_TODAY') {
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: { eventDate: true, eventEndDate: true },
            });
            if (!event) return res.status(404).json({ error: 'Event not found' });
            const resolved = resolveCheckInEventDay(event.eventDate, event.eventEndDate);
            if (!resolved) {
                where.id = -1;
            } else {
                where.attendanceDays = { some: { eventDay: resolved.eventDayDate } };
            }
        }
        if (eventDayFilter) {
            where.attendanceDays = { some: { eventDay: eventDayStringToDate(eventDayFilter) } };
        }
        if (walkIn === 'true') where.isWalkIn = true;
        if (walkIn === 'false') where.isWalkIn = false;
        if (VALID_REGISTRATION_SOURCES.has(source)) where.source = source;
        if (sourceGroup === 'PRE_REGISTERED') {
            where.source = { in: ['PORTAL', 'PUBLIC'] };
        } else if (sourceGroup === 'WALK_IN') {
            where.OR = [{ source: 'WALK_IN' }, { isWalkIn: true }];
        } else if (sourceGroup === 'IMPORT') {
            where.source = 'IMPORT';
        }
        if (ticketStatus === 'SENT') where.ticketEmailSentAt = { not: null };
        if (ticketStatus === 'NOT_SENT') where.ticketEmailSentAt = null;
        if (reminderStatus === 'SENT') where.reminderEmailSentAt = { not: null };
        if (reminderStatus === 'NOT_SENT') where.reminderEmailSentAt = null;

        const registrations = await prisma.eventRegistration.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }],
            include: registrationInclude,
        });

        return res.json(registrations.map(serializeRegistration));
    } catch (error) {
        console.error(`GET /events/${req.params.id}/registrations error:`, error);
        return res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

router.get('/:id/registrations/lookup', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const confirmationCode = String(req.query.confirmationCode || '').trim().toUpperCase();
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!confirmationCode) return res.status(400).json({ error: 'confirmationCode is required' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const registration = await prisma.eventRegistration.findFirst({
            where: { eventId, confirmationCode },
            include: registrationInclude,
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { eventDate: true, eventEndDate: true },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const fields = await getActiveCustomFields(eventId);
        const missingRequiredFields = getMissingRequiredCustomFieldsFromValues(fields, registration.customFieldValues);
        const resolved = resolveCheckInEventDay(event.eventDate, event.eventEndDate);
        const eventDay = resolved?.eventDay ?? '';
        const checkedInToday = resolved
            ? hasAttendanceOnDay(registration.attendanceDays ?? [], resolved.eventDay)
            : false;
        const activeSessionsNow = await getActiveSessionsAtTime(eventId, new Date());

        return res.json({
            registration: serializeRegistration(registration),
            missingRequiredFields,
            eventDay,
            checkedInToday,
            alreadyCheckedInToday: checkedInToday,
            activeSessionsNow,
            existingSessionAttendances: registration.sessionAttendances ?? [],
        });
    } catch (error) {
        console.error(`GET /events/${req.params.id}/registrations/lookup error:`, error);
        return res.status(500).json({ error: 'Failed to lookup registration' });
    }
});

router.get('/:id/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const registration = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            include: registrationInclude,
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        return res.json(serializeRegistration(registration));
    } catch (error) {
        console.error(`GET /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to fetch registration' });
    }
});

router.post('/:id/registrations', optionalAuthenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const isManager = isPrivilegedUser(req.user);
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

        const publicTiers = !isManager
            ? await prisma.eventTier.findMany({
                where: { eventId, isActive: true, showOnPublic: true },
                select: { id: true, maxCapacity: true },
            })
            : [];

        const tierId = parseId(req.body?.tierId);
        const tier = tierId
            ? await prisma.eventTier.findFirst({
                where: { id: tierId, eventId },
                select: { id: true, maxCapacity: true, isActive: true, showOnPublic: true },
            })
            : null;
        if (tierId && !tier) return res.status(400).json({ error: 'Invalid tier for this event' });

        if (!isManager) {
            if (event.tierFieldShowOnPublic) {
                if (event.tierFieldRequired && !tierId) {
                    return res.status(400).json({ error: 'A registration tier is required' });
                }
                if (tierId && (!tier?.isActive || !tier.showOnPublic)) {
                    return res.status(400).json({ error: 'A valid registration tier is required' });
                }
            } else if (publicTiers.length > 0) {
                if (!tierId || !tier?.isActive || !tier.showOnPublic) {
                    return res.status(400).json({ error: 'A valid registration tier is required' });
                }
            }
        }

        const requestedSessionIds = parseSessionIds(req.body?.sessionIds);
        const sessionValidation = await validateSessionIdsForEvent(eventId, requestedSessionIds);
        if (!sessionValidation.ok) {
            return res.status(400).json({ error: sessionValidation.error });
        }

        if (!isManager && event.sessionFieldShowOnPublic && event.sessionFieldRequired && sessionValidation.ids.length === 0) {
            return res.status(400).json({ error: 'At least one session must be selected' });
        }

        if (!isManager && !event.sessionFieldShowOnPublic && sessionValidation.ids.length > 0) {
            return res.status(400).json({ error: 'Session selection is not available for this event' });
        }

        if (tier?.maxCapacity != null) {
            const tierRegistrationCount = await prisma.eventRegistration.count({ where: { eventId, tierId, status: { not: 'CANCELLED' } } });
            if (tierRegistrationCount >= tier.maxCapacity) {
                return res.status(409).json({ error: 'Selected tier is at capacity' });
            }
        }

        const fullName = String(req.body?.fullName || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!fullName || !email) return res.status(400).json({ error: 'fullName and email are required' });

        const registrationMemberId = req.user?.memberId ?? await resolveMemberIdByEmail(email);
        const existingRegistration = await findActiveEventRegistration(eventId, {
            email,
            memberId: registrationMemberId,
        });
        if (existingRegistration) {
            return res.status(409).json({ error: 'Already registered for this event' });
        }

        const customFieldValuesInput = req.body?.customFieldValues;
        if (!isManager) {
            const publicFields = await getActiveCustomFields(eventId, { publicOnly: true });
            const customFieldErrors = validateRequiredCustomFieldValues(publicFields, customFieldValuesInput, { publicOnly: true });
            if (Object.keys(customFieldErrors).length > 0) {
                return res.status(400).json({ error: 'Required custom fields are missing', fieldErrors: customFieldErrors });
            }
        }

        const confirmationCode = await createRegistrationCodeWithRetry();

        const registration = await prisma.$transaction(async (tx) => {
            const registrationCount = await tx.eventRegistration.count({
                where: { eventId, status: { not: 'CANCELLED' } },
            });
            if (event.capacity != null && registrationCount >= event.capacity) {
                throw Object.assign(new Error('Event capacity has been reached'), { code: 'CAPACITY_REACHED' });
            }

            if (tier?.maxCapacity != null) {
                const tierRegistrationCount = await tx.eventRegistration.count({
                    where: { eventId, tierId, status: { not: 'CANCELLED' } },
                });
                if (tierRegistrationCount >= tier.maxCapacity) {
                    throw Object.assign(new Error('Selected tier is at capacity'), { code: 'CAPACITY_REACHED' });
                }
            }

            return tx.eventRegistration.create({
                data: {
                    eventId,
                    tierId,
                    memberId: registrationMemberId,
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
        });

        await createRegistrationSessionSelections(registration.id, sessionValidation.ids);
        queueRegistrationTokenGeneration(registration.id, 'registration-create');

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

        if (!isManager) {
            queueTicketEmail(registration.id, 'public-registration');
        }

        publishEventChanged({
            eventId,
            version: registration.version,
            actorMemberId: req.user?.memberId ?? registration.memberId ?? null,
        });

        const { onlineAccessToken: _token, ...safeRegistration } = registration;
        return res.status(201).json(safeRegistration);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'CAPACITY_REACHED') {
            return sendConflictResponse(
                res,
                'CAPACITY_REACHED',
                error instanceof Error ? error.message : 'Event capacity has been reached',
            );
        }
        const prismaConflict = respondWithPrismaConflict(res, error);
        if (prismaConflict) return prismaConflict;
        console.error(`POST /events/${req.params.id}/registrations error:`, error);
        return res.status(500).json({ error: 'Failed to create registration' });
    }
});

router.post('/:id/registrations/walk-in', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

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

        const bodyMemberId = req.body?.memberId ? parseId(req.body.memberId) : null;
        const resolvedMemberId = bodyMemberId ?? await resolveMemberIdByEmail(email);
        const walkInCheckedInAt = new Date();
        const resolvedDay = resolveCheckInEventDay(event.eventDate, event.eventEndDate, { referenceDate: walkInCheckedInAt });
        if (!resolvedDay) {
            return res.status(409).json({ error: 'Walk-ins are only available on event days' });
        }

        const sessionId = parseId(req.body?.sessionId);
        const requestedSessionIds = parseSessionIds(req.body?.sessionIds);
        const sessionValidation = await validateSessionIdsForEvent(eventId, requestedSessionIds);
        if (!sessionValidation.ok) {
            return res.status(400).json({ error: sessionValidation.error });
        }
        const walkInTierId = parseId(req.body?.tierId);

        let targetSession: (SessionTimeWindow & { id: number; label: string | null }) | null = null;
        if (sessionId) {
            const session = await prisma.eventSession.findFirst({
                where: { id: sessionId, eventId, isActive: true },
                select: { id: true, label: true, sessionDate: true, startTime: true, endTime: true },
            });
            if (!session) {
                return res.status(400).json({ error: 'Invalid or inactive session for this event' });
            }
            targetSession = session;
        }

        const existingRegistration = await findActiveEventRegistration(eventId, {
            email,
            memberId: resolvedMemberId,
        });

        if (existingRegistration) {
            const alreadyCheckedInForDay = hasAttendanceOnDay(existingRegistration.attendanceDays ?? [], resolvedDay.eventDay);
            if (!sessionId && alreadyCheckedInForDay) {
                return res.status(409).json({ error: 'This person is already checked in today' });
            }

            if (sessionId && targetSession) {
                const conflict = await findOverlappingSessionAttendance(existingRegistration.id, targetSession);
                if (conflict) {
                    const sessionLabel = conflict.session?.label ?? 'session';
                    return res.status(409).json({
                        error: `Already checked into an overlapping session (${sessionLabel})`,
                    });
                }
            }

            const mergedCustomFieldValues = mergeCustomFieldValues(
                existingRegistration.customFieldValues,
                req.body?.customFieldValues ?? {},
            );
            const mergedFieldErrors = validateRequiredCustomFieldValues(walkInFields, mergedCustomFieldValues);
            if (Object.keys(mergedFieldErrors).length > 0) {
                return res.status(400).json({ error: 'Required custom fields are missing', fieldErrors: mergedFieldErrors });
            }

            const finalTierId = walkInTierId ?? existingRegistration.tierId ?? null;
            const existingSelectionIds = (existingRegistration.sessionSelections ?? []).map((s) => s.sessionId);
            const finalSessionIds = sessionValidation.ids.length > 0
                ? sessionValidation.ids
                : existingSelectionIds;

            if (event.tierFieldRequired && !finalTierId) {
                return res.status(400).json({ error: 'A registration tier is required' });
            }
            if (event.sessionFieldRequired && finalSessionIds.length === 0) {
                return res.status(400).json({ error: 'At least one session must be selected' });
            }

            if (walkInTierId) {
                const tier = await prisma.eventTier.findFirst({
                    where: { id: walkInTierId, eventId, isActive: true },
                    select: { id: true },
                });
                if (!tier) return res.status(400).json({ error: 'Invalid tier for this event' });
            }

            const updated = await prisma.$transaction(async (tx) => {
                if (!alreadyCheckedInForDay) {
                    await tx.eventRegistrationDay.create({
                        data: {
                            registrationId: existingRegistration.id,
                            eventDay: resolvedDay.eventDayDate,
                            checkedInAt: walkInCheckedInAt,
                        },
                    });
                }

                if (sessionId && targetSession) {
                    await tx.eventSessionAttendance.create({
                        data: {
                            sessionId,
                            registrationId: existingRegistration.id,
                            mode: 'ONSITE',
                            joinedAt: walkInCheckedInAt,
                        },
                    });
                }

                await mergeRegistrationCustomFieldValues(
                    existingRegistration.id,
                    req.body?.customFieldValues ?? {},
                    { tx, incrementVersion: false },
                );

                if (sessionValidation.ids.length > 0) {
                    await tx.eventRegistrationSession.createMany({
                        data: sessionValidation.ids.map((sid) => ({
                            registrationId: existingRegistration.id,
                            sessionId: sid,
                        })),
                        skipDuplicates: true,
                    });
                }

                return tx.eventRegistration.update({
                    where: { id: existingRegistration.id },
                    data: {
                        status: 'CHECKED_IN',
                        ...(existingRegistration.status !== 'CHECKED_IN' ? { checkedInAt: walkInCheckedInAt } : {}),
                        ...(resolvedMemberId && !existingRegistration.memberId ? { memberId: resolvedMemberId } : {}),
                        ...(walkInTierId !== null ? { tierId: walkInTierId } : {}),
                        version: { increment: 1 },
                    },
                    include: registrationInclude,
                });
            });

            await logEventActivity({
                eventId,
                memberId: req.user!.memberId!,
                actionType: 'CHECKED_IN',
                entityType: 'REGISTRATION',
                oldValue: { status: existingRegistration.status },
                newValue: {
                    status: 'CHECKED_IN',
                    fullName: updated.fullName,
                    eventDay: resolvedDay.eventDay,
                    source: 'WALK_IN',
                },
                description: `${updated.fullName} checked in for ${resolvedDay.eventDay} via walk-in`,
            });

            publishEventChanged({
                eventId,
                version: updated.version,
                actorMemberId: req.user!.memberId!,
            });

            return res.status(200).json({
                ...serializeRegistration(updated),
                action: 'checked_in_existing',
            });
        }

        if (event.tierFieldRequired && !walkInTierId) {
            return res.status(400).json({ error: 'A registration tier is required' });
        }
        if (event.sessionFieldRequired && sessionValidation.ids.length === 0) {
            return res.status(400).json({ error: 'At least one session must be selected' });
        }

        if (walkInTierId) {
            const tier = await prisma.eventTier.findFirst({
                where: { id: walkInTierId, eventId, isActive: true },
                select: { id: true },
            });
            if (!tier) return res.status(400).json({ error: 'Invalid tier for this event' });
        }

        const confirmationCode = await createRegistrationCodeWithRetry();
        const registration = await prisma.eventRegistration.create({
            data: {
                eventId,
                tierId: walkInTierId,
                memberId: resolvedMemberId,
                fullName,
                email,
                phoneNumber: String(req.body?.phoneNumber || '').trim() || null,
                confirmationCode,
                source: 'WALK_IN',
                status: 'CHECKED_IN',
                isWalkIn: true,
                checkedInAt: walkInCheckedInAt,
                notes: String(req.body?.notes || '').trim() || null,
                customFieldValues: toJsonInput(req.body?.customFieldValues),
                attendanceDays: {
                    create: {
                        eventDay: resolvedDay.eventDayDate,
                        checkedInAt: walkInCheckedInAt,
                    },
                },
                ...(sessionValidation.ids.length > 0 ? {
                    sessionSelections: {
                        create: sessionValidation.ids.map((sid) => ({ sessionId: sid })),
                    },
                } : {}),
                ...(sessionId ? {
                    sessionAttendances: {
                        create: {
                            sessionId,
                            mode: 'ONSITE',
                            joinedAt: walkInCheckedInAt,
                        },
                    },
                } : {}),
            },
            include: registrationInclude,
        });

        queueRegistrationTokenGeneration(registration.id, 'walk-in-create');

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

        if (shouldSendWalkInTicket(event.eventDate, event.eventEndDate, walkInCheckedInAt)) {
            queueTicketEmail(registration.id, 'walk-in');
        }

        publishEventChanged({
            eventId,
            version: registration.version,
            actorMemberId: req.user!.memberId!,
        });

        return res.status(201).json({
            ...serializeRegistration(registration),
            action: 'created',
        });
    } catch (error) {
        const prismaConflict = respondWithPrismaConflict(res, error);
        if (prismaConflict) return prismaConflict;
        console.error(`POST /events/${req.params.id}/registrations/walk-in error:`, error);
        return res.status(500).json({ error: 'Failed to create walk-in registration' });
    }
});

router.post('/:id/registrations/import', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, capacity: true },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        if (rows.length === 0) {
            return res.status(400).json({ error: 'At least one row is required for import' });
        }
        if (rows.length > 2000) {
            return res.status(400).json({ error: 'Import is limited to 2000 rows per file' });
        }

        const newCustomFieldsInput = Array.isArray(req.body?.newCustomFields) ? req.body.newCustomFields : [];
        const tiers = await prisma.eventTier.findMany({
            where: { eventId, isActive: true },
            select: { id: true, name: true, maxCapacity: true },
        });
        const tierByName = new Map(tiers.map((tier) => [tier.name.trim().toLowerCase(), tier]));

        const result = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [] as Array<{ row: number; email?: string; message: string }>,
            createdRegistrationIds: [] as number[],
        };

        const newFieldIdByExcelColumn = new Map<string, number>();
        let nextFieldOrder = await prisma.eventCustomField.aggregate({
            where: { eventId },
            _max: { order: true },
        });

        for (const spec of newCustomFieldsInput) {
            const excelColumn = String(spec?.excelColumn || '').trim();
            const label = String(spec?.label || '').trim();
            const type = String(spec?.type || '').trim();
            if (!excelColumn || !label || !type) {
                return res.status(400).json({ error: 'Each new custom field requires excelColumn, label, and type' });
            }

            const order = (nextFieldOrder._max.order ?? -1) + 1;
            nextFieldOrder = { _max: { order } };

            const createdField = await prisma.eventCustomField.create({
                data: {
                    eventId,
                    label,
                    type,
                    options: toJsonInput(spec?.options),
                    required: Boolean(spec?.required),
                    showOnPublic: false,
                    order,
                },
            });
            newFieldIdByExcelColumn.set(excelColumn, createdField.id);
        }

        const activeFields = await getActiveCustomFields(eventId);
        const seenImportKeys = new Map<string, number>();
        let registrationCount = await getEventRegistrationCount(eventId);

        for (let index = 0; index < rows.length; index += 1) {
            const rowNumber = index + 2;
            const row = rows[index] as Record<string, unknown>;
            const fullName = String(row?.fullName || '').trim();
            const rawEmail = row?.email !== undefined && row?.email !== null
                ? String(row.email).trim().toLowerCase()
                : '';

            if (!fullName) {
                result.skipped += 1;
                result.errors.push({
                    row: rowNumber,
                    email: rawEmail || undefined,
                    message: 'Full name is required.',
                });
                continue;
            }

            const resolvedEmail = rawEmail || buildImportPlaceholderEmail(eventId, fullName);
            const dedupKey = rawEmail || `name:${fullName.trim().toLowerCase()}`;

            if (seenImportKeys.has(dedupKey)) {
                result.errors.push({
                    row: rowNumber,
                    email: rawEmail || undefined,
                    message: `Duplicate entry in file; row ${seenImportKeys.get(dedupKey)} will be used instead.`,
                });
            }
            seenImportKeys.set(dedupKey, rowNumber);

            const remappedValues = remapImportedCustomFieldValues(
                row?.customFieldValues && typeof row.customFieldValues === 'object' && !Array.isArray(row.customFieldValues)
                    ? row.customFieldValues as Record<string, unknown>
                    : undefined,
                newFieldIdByExcelColumn,
            );

            const coercedValues: Record<string, unknown> = {};
            for (const field of activeFields) {
                if (!(String(field.id) in remappedValues)) continue;
                coercedValues[String(field.id)] = coerceImportCustomFieldValue(
                    field.type,
                    remappedValues[String(field.id)],
                    field.options,
                );
            }

            const fieldValidationError = validateImportCustomFieldValues(activeFields, coercedValues);
            if (fieldValidationError) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, email: rawEmail || undefined, message: fieldValidationError });
                continue;
            }

            let tierId: number | null = null;
            const tierName = String(row?.tierName || '').trim();
            if (tierName) {
                const tier = tierByName.get(tierName.toLowerCase());
                if (!tier) {
                    result.skipped += 1;
                    result.errors.push({ row: rowNumber, email: rawEmail || undefined, message: `Tier "${tierName}" was not found.` });
                    continue;
                }
                tierId = tier.id;
            }

            const memberId = rawEmail ? await resolveMemberIdByEmail(rawEmail) : null;
            const existing = await findActiveEventRegistrationForImport(eventId, { fullName, email: rawEmail || null });

            if (existing) {
                const mergedCustomFieldValues = Object.keys(coercedValues).length > 0
                    ? mergeCustomFieldValues(existing.customFieldValues, coercedValues)
                    : existing.customFieldValues;

                await prisma.eventRegistration.update({
                    where: { id: existing.id },
                    data: {
                        fullName,
                        ...(rawEmail ? { email: rawEmail } : {}),
                        phoneNumber: row?.phoneNumber !== undefined && row?.phoneNumber !== null
                            ? String(row.phoneNumber).trim() || null
                            : existing.phoneNumber,
                        tierId: tierName ? tierId : existing.tierId,
                        notes: row?.notes !== undefined && row?.notes !== null
                            ? String(row.notes).trim() || null
                            : existing.notes,
                        ...(Object.keys(coercedValues).length > 0
                            ? { customFieldValues: toJsonInput(mergedCustomFieldValues) }
                            : {}),
                        ...(memberId && !existing.memberId ? { memberId } : {}),
                    },
                });
                result.updated += 1;
                continue;
            }

            if (event.capacity != null && registrationCount >= event.capacity) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, email: rawEmail || undefined, message: 'Event capacity has been reached.' });
                continue;
            }

            if (tierId) {
                const tier = tiers.find((entry) => entry.id === tierId);
                if (tier?.maxCapacity != null) {
                    const tierRegistrationCount = await prisma.eventRegistration.count({
                        where: { eventId, tierId, status: { not: 'CANCELLED' } },
                    });
                    if (tierRegistrationCount >= tier.maxCapacity) {
                        result.skipped += 1;
                        result.errors.push({ row: rowNumber, email: rawEmail || undefined, message: `Tier "${tier.name}" is at capacity.` });
                        continue;
                    }
                }
            }

            const confirmationCode = await createRegistrationCodeWithRetry();
            const createdRegistration = await prisma.eventRegistration.create({
                data: {
                    eventId,
                    tierId,
                    memberId,
                    fullName,
                    email: resolvedEmail,
                    phoneNumber: row?.phoneNumber !== undefined && row?.phoneNumber !== null
                        ? String(row.phoneNumber).trim() || null
                        : null,
                    confirmationCode,
                    source: 'IMPORT',
                    status: 'REGISTERED',
                    isWalkIn: false,
                    notes: row?.notes !== undefined && row?.notes !== null
                        ? String(row.notes).trim() || null
                        : null,
                    customFieldValues: toJsonInput(coercedValues),
                },
            });

            queueRegistrationTokenGeneration(createdRegistration.id, 'import-create');

            registrationCount += 1;
            result.created += 1;
            result.createdRegistrationIds.push(createdRegistration.id);
        }

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'IMPORT',
            entityType: 'REGISTRATION',
            newValue: {
                created: result.created,
                updated: result.updated,
                skipped: result.skipped,
            },
            description: `Imported registrations: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
        });

        publishEventChanged({
            eventId,
            version: 0,
            actorMemberId: req.user!.memberId!,
        });

        return res.json(result);
    } catch (error) {
        const prismaConflict = respondWithPrismaConflict(res, error);
        if (prismaConflict) return prismaConflict;
        console.error(`POST /events/${req.params.id}/registrations/import error:`, error);
        return res.status(500).json({ error: 'Failed to import registrations' });
    }
});

router.patch('/:id/registrations/:registrationId/check-in', authenticateToken, async (req, res) => {
    let registration: RegistrationWithDays | null = null;
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        const confirmationCode = String(req.body?.confirmationCode || '').trim().toUpperCase();
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { eventDate: true, eventEndDate: true, tierFieldRequired: true, sessionFieldRequired: true },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        registration = registrationId
            ? await prisma.eventRegistration.findFirst({
                where: { id: registrationId, eventId },
                include: registrationInclude,
            })
            : confirmationCode
                ? await prisma.eventRegistration.findFirst({
                    where: { eventId, confirmationCode },
                    include: registrationInclude,
                })
                : null;

        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        const activeRegistration = registration;
        if (activeRegistration.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }

        const resolvedDay = resolveCheckInEventDay(event.eventDate, event.eventEndDate, {
            eventDay: req.body?.eventDay,
        });
        if (!resolvedDay) {
            return res.status(409).json({ error: 'Check-in is only available on event days' });
        }

        const sessionId = parseId(req.body?.sessionId);
        const alreadyCheckedInForDay = hasAttendanceOnDay(activeRegistration.attendanceDays ?? [], resolvedDay.eventDay);

        if (!sessionId && alreadyCheckedInForDay) {
            return res.status(409).json({ error: 'Already checked in for this day' });
        }

        let targetSession: SessionTimeWindow | null = null;
        if (sessionId) {
            const session = await prisma.eventSession.findFirst({
                where: { id: sessionId, eventId, isActive: true },
                select: { id: true, label: true, sessionDate: true, startTime: true, endTime: true },
            });
            if (!session) {
                return res.status(400).json({ error: 'Invalid or inactive session for this event' });
            }
            targetSession = session;

            const conflict = await findOverlappingSessionAttendance(activeRegistration.id, session);
            if (conflict) {
                const sessionLabel = conflict.session?.label ?? 'session';
                return res.status(409).json({
                    error: `Already checked into an overlapping session (${sessionLabel})`,
                });
            }
        }

        const customFieldPatch = req.body?.customFieldValues;
        const mergedCustomFieldValues = customFieldPatch !== undefined
            ? mergeCustomFieldValues(activeRegistration.customFieldValues, customFieldPatch)
            : mergeCustomFieldValues(activeRegistration.customFieldValues, {});

        const requiredFields = await getActiveCustomFields(eventId);
        const missingRequiredFields = getMissingRequiredCustomFieldsFromValues(requiredFields, mergedCustomFieldValues);
        if (missingRequiredFields.length > 0) {
            return res.status(409).json({
                error: 'Required custom fields must be completed before check-in',
                missingFields: missingRequiredFields,
            });
        }

        const tierIdFromBody = req.body?.tierId !== undefined ? parseId(req.body.tierId) : undefined;
        const requestedSessionIds = req.body?.sessionIds !== undefined ? parseSessionIds(req.body.sessionIds) : undefined;

        if (tierIdFromBody) {
            const tier = await prisma.eventTier.findFirst({
                where: { id: tierIdFromBody, eventId, isActive: true },
                select: { id: true },
            });
            if (!tier) return res.status(400).json({ error: 'Invalid tier for this event' });
        }

        let validatedSessionIds: number[] | undefined;
        if (requestedSessionIds !== undefined) {
            const sessionValidation = await validateSessionIdsForEvent(eventId, requestedSessionIds);
            if (!sessionValidation.ok) {
                return res.status(400).json({ error: sessionValidation.error });
            }
            validatedSessionIds = sessionValidation.ids;
        }

        const finalTierId = tierIdFromBody ?? activeRegistration.tierId ?? null;
        const existingSelectionIds = (activeRegistration.sessionSelections ?? []).map((s) => s.sessionId);
        const finalSessionIds = validatedSessionIds ?? existingSelectionIds;

        if (event.tierFieldRequired && !finalTierId) {
            return res.status(409).json({ error: 'A registration tier is required', missingTier: true });
        }
        if (event.sessionFieldRequired && finalSessionIds.length === 0) {
            return res.status(409).json({ error: 'At least one session must be selected', missingSessions: true });
        }

        const checkedInAt = new Date();
        const updated = await prisma.$transaction(async (tx) => {
            if (!alreadyCheckedInForDay) {
                await tx.eventRegistrationDay.create({
                    data: {
                        registrationId: activeRegistration.id,
                        eventDay: resolvedDay.eventDayDate,
                        checkedInAt,
                    },
                });
            }

            if (sessionId && targetSession) {
                await tx.eventSessionAttendance.create({
                    data: {
                        sessionId,
                        registrationId: activeRegistration.id,
                        mode: 'ONSITE',
                        joinedAt: checkedInAt,
                    },
                });
            }

            if (customFieldPatch !== undefined) {
                await mergeRegistrationCustomFieldValues(activeRegistration.id, customFieldPatch, {
                    tx,
                    incrementVersion: false,
                });
            }

            if (validatedSessionIds !== undefined && validatedSessionIds.length > 0) {
                await tx.eventRegistrationSession.createMany({
                    data: validatedSessionIds.map((sid) => ({
                        registrationId: activeRegistration.id,
                        sessionId: sid,
                    })),
                    skipDuplicates: true,
                });
            }

            return tx.eventRegistration.update({
                where: { id: activeRegistration.id },
                data: {
                    status: 'CHECKED_IN',
                    ...(activeRegistration.status !== 'CHECKED_IN' ? { checkedInAt } : {}),
                    ...(tierIdFromBody !== undefined ? { tierId: tierIdFromBody } : {}),
                    version: { increment: 1 },
                },
                include: registrationInclude,
            });
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'CHECKED_IN',
            entityType: 'REGISTRATION',
            oldValue: { status: registration.status },
            newValue: {
                status: 'CHECKED_IN',
                fullName: registration.fullName,
                eventDay: resolvedDay.eventDay,
            },
            description: `${registration.fullName} checked in for ${resolvedDay.eventDay}`,
        });

        publishEventChanged({
            eventId,
            version: updated.version,
            actorMemberId: req.user!.memberId!,
        });

        return res.json(serializeRegistration(updated));
    } catch (error) {
        const prismaConflict = respondWithPrismaConflict(
            res,
            error,
            registration ? serializeRegistration(registration) : undefined,
        );
        if (prismaConflict) return prismaConflict;
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId}/check-in error:`, error);
        return res.status(500).json({ error: 'Failed to check in registration' });
    }
});

router.delete('/:id/registrations/:registrationId/attendance', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!canUserRemoveAttendance(req.user)) {
            return res.status(403).json({ error: 'Attendance removal access required' });
        }

        const eventDay = parseEventDayString(req.body?.eventDay);
        if (!eventDay) return res.status(400).json({ error: 'Invalid event day' });

        const registration = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            include: { attendanceDays: true },
        });
        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        if (registration.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }

        const dayRecord = registration.attendanceDays.find(
            (day) => formatEventDay(day.eventDay) === eventDay,
        );
        if (!dayRecord) return res.status(404).json({ error: 'Attendance record not found' });

        const updated = await prisma.$transaction(async (tx) => {
            await tx.eventRegistrationDay.delete({ where: { id: dayRecord.id } });

            const remainingCount = await tx.eventRegistrationDay.count({
                where: { registrationId },
            });

            if (remainingCount === 0) {
                return tx.eventRegistration.update({
                    where: { id: registrationId },
                    data: { status: 'REGISTERED', checkedInAt: null },
                    include: registrationInclude,
                });
            }

            return tx.eventRegistration.findUniqueOrThrow({
                where: { id: registrationId },
                include: registrationInclude,
            });
        });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'ATTENDANCE_REMOVED',
            entityType: 'REGISTRATION',
            oldValue: { eventDay, status: registration.status },
            newValue: {
                eventDay,
                status: updated.status,
                fullName: registration.fullName,
            },
            description: `Removed check-in for ${registration.fullName} on ${eventDay}`,
        });

        return res.json(serializeRegistration(updated));
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/registrations/${req.params.registrationId}/attendance error:`, error);
        return res.status(500).json({ error: 'Failed to remove attendance' });
    }
});

router.delete('/:id/registrations/:registrationId/session-attendance/:sessionAttendanceId', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        const sessionAttendanceId = parseId(req.params.sessionAttendanceId);
        if (!eventId || !registrationId || !sessionAttendanceId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }
        if (!canUserRemoveAttendance(req.user)) {
            return res.status(403).json({ error: 'Attendance removal access required' });
        }

        const registration = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            select: { id: true, fullName: true, status: true },
        });
        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        if (registration.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }

        const attendance = await prisma.eventSessionAttendance.findFirst({
            where: { id: sessionAttendanceId, registrationId },
            include: {
                session: { select: { sessionDate: true, label: true } },
            },
        });
        if (!attendance) return res.status(404).json({ error: 'Session attendance record not found' });

        await prisma.eventSessionAttendance.delete({ where: { id: sessionAttendanceId } });

        const updated = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            include: registrationInclude,
        });
        if (!updated) return res.status(404).json({ error: 'Registration not found' });

        const sessionDateLabel = formatEventDay(attendance.session.sessionDate);
        const sessionLabel = attendance.session.label?.trim();
        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'ATTENDANCE_REMOVED',
            entityType: 'REGISTRATION',
            oldValue: {
                sessionAttendanceId,
                sessionId: attendance.sessionId,
                mode: attendance.mode,
            },
            newValue: {
                sessionAttendanceId,
                fullName: registration.fullName,
            },
            description: `Removed online check-in for ${registration.fullName}${sessionLabel ? ` (${sessionLabel})` : ''} on ${sessionDateLabel}`,
        });

        return res.json(serializeRegistration(updated));
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/registrations/${req.params.registrationId}/session-attendance/${req.params.sessionAttendanceId} error:`, error);
        return res.status(500).json({ error: 'Failed to remove session attendance' });
    }
});

router.patch('/:id/registrations/:registrationId/sessions', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const existing = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            select: { id: true, fullName: true, status: true },
        });
        if (!existing) return res.status(404).json({ error: 'Registration not found' });
        if (existing.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }

        const requestedSessionIds = parseSessionIds(req.body?.sessionIds);
        const validation = await validateSessionIdsForEvent(eventId, requestedSessionIds);
        if (!validation.ok) return res.status(400).json({ error: validation.error });

        await prisma.$transaction(async (tx) => {
            await tx.eventRegistrationSession.deleteMany({ where: { registrationId } });
            if (validation.ids.length > 0) {
                await tx.eventRegistrationSession.createMany({
                    data: validation.ids.map((sessionId) => ({ registrationId, sessionId })),
                    skipDuplicates: true,
                });
            }
        });

        queueRegistrationTokenGeneration(registrationId, 'registration-sessions-update');

        const updated = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            include: registrationInclude,
        });
        if (!updated) return res.status(404).json({ error: 'Registration not found' });

        await logEventActivity({
            eventId,
            memberId: req.user!.memberId!,
            actionType: 'UPDATED',
            entityType: 'REGISTRATION',
            newValue: {
                sessionIds: validation.ids,
                fullName: existing.fullName,
            },
            description: `Updated session selections for ${existing.fullName}`,
        });

        publishEventChanged({
            eventId,
            version: updated.version,
            actorMemberId: req.user!.memberId!,
        });

        return res.json(serializeRegistration(updated));
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId}/sessions error:`, error);
        return res.status(500).json({ error: 'Failed to update registration sessions' });
    }
});

router.post('/:id/registrations/:registrationId/resend-ticket', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const registration = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            select: { id: true, email: true, status: true },
        });
        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        if (registration.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }
        if (!registration.email?.trim()) {
            return res.status(400).json({ error: 'Registration has no email address' });
        }

        await sendEventTicketEmail(registrationId);

        return res.json({ ok: true, message: 'Ticket email sent' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send ticket email';
        console.error(`POST /events/${req.params.id}/registrations/${req.params.registrationId}/resend-ticket error:`, error);
        if (message === 'Email service is not configured') {
            return res.status(503).json({ error: 'Email service is not configured' });
        }
        if (process.env.NODE_ENV !== 'production') {
            return res.status(502).json({ error: message });
        }
        return res.status(502).json({ error: 'Failed to send ticket email' });
    }
});

router.post('/:id/registrations/:registrationId/resend-reminder', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const registration = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            select: { id: true, email: true, status: true },
        });
        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        if (registration.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Registration has been cancelled' });
        }
        if (!registration.email?.trim()) {
            return res.status(400).json({ error: 'Registration has no email address' });
        }

        await sendEventReminderEmail(registrationId);

        return res.json({ ok: true, message: 'Reminder email sent' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send reminder email';
        console.error(`POST /events/${req.params.id}/registrations/${req.params.registrationId}/resend-reminder error:`, error);
        if (message === 'Email service is not configured') {
            return res.status(503).json({ error: 'Email service is not configured' });
        }
        if (process.env.NODE_ENV !== 'production') {
            return res.status(502).json({ error: message });
        }
        return res.status(502).json({ error: 'Failed to send reminder email' });
    }
});

router.post('/:id/registrations/send-tickets', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const rawIds = Array.isArray(req.body?.registrationIds) ? req.body.registrationIds : [];
        const registrationIds = rawIds
            .map((id) => parseId(id))
            .filter((id): id is number => id != null);

        if (registrationIds.length === 0) {
            return res.status(400).json({ error: 'At least one registration ID is required' });
        }
        if (registrationIds.length > 2000) {
            return res.status(400).json({ error: 'Ticket send is limited to 2000 registrations per request' });
        }

        const registrations = await prisma.eventRegistration.findMany({
            where: {
                eventId,
                id: { in: registrationIds },
                status: { not: 'CANCELLED' },
            },
            select: { id: true, email: true },
        });
        const registrationById = new Map(registrations.map((registration) => [registration.id, registration]));

        const result = {
            sent: 0,
            skipped: 0,
            failed: 0,
            errors: [] as Array<{ registrationId: number; message: string }>,
        };

        for (const registrationId of registrationIds) {
            const registration = registrationById.get(registrationId);
            if (!registration) {
                result.skipped += 1;
                continue;
            }

            const email = registration.email?.trim() ?? '';
            if (!email || isImportPlaceholderEmail(email)) {
                result.skipped += 1;
                continue;
            }

            try {
                await sendEventTicketEmail(registrationId);
                result.sent += 1;
            } catch (error) {
                result.failed += 1;
                result.errors.push({
                    registrationId,
                    message: error instanceof Error ? error.message : 'Failed to send ticket email',
                });
            }
        }

        return res.json(result);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/registrations/send-tickets error:`, error);
        return res.status(500).json({ error: 'Failed to send ticket emails' });
    }
});

router.post('/:id/registrations/send-reminders', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const rawIds = Array.isArray(req.body?.registrationIds) ? req.body.registrationIds : [];
        const registrationIds = rawIds
            .map((id) => parseId(id))
            .filter((id): id is number => id != null);

        if (registrationIds.length === 0) {
            return res.status(400).json({ error: 'At least one registration ID is required' });
        }
        if (registrationIds.length > 2000) {
            return res.status(400).json({ error: 'Reminder send is limited to 2000 registrations per request' });
        }

        const registrations = await prisma.eventRegistration.findMany({
            where: {
                eventId,
                id: { in: registrationIds },
                status: { not: 'CANCELLED' },
            },
            select: { id: true, email: true },
        });
        const registrationById = new Map(registrations.map((registration) => [registration.id, registration]));

        const result = {
            sent: 0,
            skipped: 0,
            failed: 0,
            errors: [] as Array<{ registrationId: number; message: string }>,
        };

        for (const registrationId of registrationIds) {
            const registration = registrationById.get(registrationId);
            if (!registration) {
                result.skipped += 1;
                continue;
            }

            const email = registration.email?.trim() ?? '';
            if (!email || isImportPlaceholderEmail(email)) {
                result.skipped += 1;
                continue;
            }

            try {
                await sendEventReminderEmail(registrationId);
                result.sent += 1;
            } catch (error) {
                result.failed += 1;
                result.errors.push({
                    registrationId,
                    message: error instanceof Error ? error.message : 'Failed to send reminder email',
                });
            }
        }

        return res.json(result);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/registrations/send-reminders error:`, error);
        return res.status(500).json({ error: 'Failed to send reminder emails' });
    }
});

router.patch('/:id/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

        const existing = await prisma.eventRegistration.findFirst({ where: { id: registrationId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Registration not found' });

        const expectedVersion = parseExpectedVersion(req.body);
        const hasCustomFieldPatch = req.body?.customFieldValues !== undefined;
        const hasScalarPatch = ['fullName', 'email', 'phoneNumber', 'tierId', 'notes'].some(
            (key) => req.body?.[key] !== undefined,
        );

        if (hasCustomFieldPatch) {
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: { eventDate: true, eventEndDate: true },
            });
            if (!event || !isWithinEventDays(event.eventDate, event.eventEndDate)) {
                return res.status(409).json({ error: 'Custom fields can only be updated during event days' });
            }
        }

        let nextTierId = existing.tierId;
        if (req.body?.tierId !== undefined) {
            nextTierId = parseId(req.body.tierId);
            if (nextTierId) {
                const tier = await prisma.eventTier.findFirst({
                    where: { id: nextTierId, eventId },
                    select: { id: true, maxCapacity: true },
                });
                if (!tier) return res.status(400).json({ error: 'Invalid tier for this event' });

                if (tier.maxCapacity != null && nextTierId !== existing.tierId) {
                    const tierRegistrationCount = await prisma.eventRegistration.count({
                        where: {
                            eventId,
                            tierId: nextTierId,
                            status: { not: 'CANCELLED' },
                            id: { not: registrationId },
                        },
                    });
                    if (tierRegistrationCount >= tier.maxCapacity) {
                        return sendConflictResponse(res, 'CAPACITY_REACHED', 'Selected tier is at capacity');
                    }
                }
            }
        }

        if (hasScalarPatch) {
            const scalarData: Prisma.EventRegistrationUpdateInput = {
                fullName: req.body?.fullName !== undefined ? String(req.body.fullName).trim() : existing.fullName,
                email: req.body?.email !== undefined ? String(req.body.email).trim().toLowerCase() : existing.email,
                phoneNumber: req.body?.phoneNumber !== undefined ? String(req.body.phoneNumber).trim() || null : existing.phoneNumber,
                notes: req.body?.notes !== undefined ? String(req.body.notes).trim() || null : existing.notes,
                ...(req.body?.tierId !== undefined ? { tierId: nextTierId } : {}),
            };

            const scalarResult = await updateEventRegistrationOptimistic(
                registrationId,
                expectedVersion,
                scalarData,
                registrationInclude,
            );
            if (!scalarResult.ok) {
                return respondVersionConflict(
                    res,
                    scalarResult.latest ? serializeRegistration(scalarResult.latest) : null,
                );
            }

            const registrationChanges = collectChangedFields(existing, scalarResult.record, {
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
                    description: summarizeChanges(registrationChanges) || `Registration for ${scalarResult.record.fullName} updated`,
                });
            }
        } else if (hasCustomFieldPatch && expectedVersion !== null) {
            const versionResult = await updateEventRegistrationOptimistic(
                registrationId,
                expectedVersion,
                {},
                registrationInclude,
            );
            if (!versionResult.ok) {
                return respondVersionConflict(
                    res,
                    versionResult.latest ? serializeRegistration(versionResult.latest) : null,
                );
            }
        }

        if (hasCustomFieldPatch) {
            await mergeRegistrationCustomFieldValues(registrationId, req.body.customFieldValues, {
                incrementVersion: !hasScalarPatch && expectedVersion === null,
            });
        }

        const updated = await prisma.eventRegistration.findFirst({
            where: { id: registrationId, eventId },
            include: registrationInclude,
        });
        if (!updated) return res.status(404).json({ error: 'Registration not found' });

        publishEventChanged({
            eventId,
            version: updated.version,
            actorMemberId: req.user!.memberId!,
        });

        return res.json(serializeRegistration(updated));
    } catch (error) {
        const prismaConflict = respondWithPrismaConflict(res, error);
        if (prismaConflict) return prismaConflict;
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to update registration' });
    }
});

router.delete('/:id/registrations/:registrationId', authenticateToken, async (req, res) => {
    try {
        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });
        if (!(await ensureEventOperationsAccess(res, req, eventId))) return;

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
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, capacity: true, isArchived: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!(await ensureCanViewEvent(res, req, eventId, event.isArchived))) return;

        const [totalRegistered, totalCheckedIn, walkInCount, noShowCount, byTier, registrationTimeline, attendanceDayRows] = await Promise.all([
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
            prisma.eventRegistrationDay.findMany({
                where: {
                    registration: { eventId },
                },
                select: { eventDay: true },
                orderBy: { eventDay: 'asc' },
            }),
        ]);

        const sessionAttendanceCounts = await prisma.eventSession.findMany({
            where: { eventId, isActive: true },
            select: {
                id: true,
                label: true,
                sessionDate: true,
                mode: true,
                _count: { select: { attendances: true } },
            },
            orderBy: [{ sessionDate: 'asc' }, { order: 'asc' }],
        });

        const registrationsByDay = new Map<string, number>();
        for (const item of registrationTimeline) {
            const day = item.createdAt.toISOString().slice(0, 10);
            registrationsByDay.set(day, (registrationsByDay.get(day) ?? 0) + 1);
        }

        const attendanceByDay = new Map<string, number>();
        for (const item of attendanceDayRows) {
            const day = formatEventDay(item.eventDay);
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
            sessionAttendance: sessionAttendanceCounts.map((session) => ({
                id: session.id,
                label: session.label,
                sessionDate: formatEventDay(session.sessionDate),
                mode: session.mode,
                attendances: session._count.attendances,
            })),
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
        if (!canUserManageEventTasks(req.user)) return res.status(403).json({ error: 'Access denied' });

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
        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, isArchived: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!(await ensureCanViewEvent(res, req, eventId, event.isArchived))) return;

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
        if (!canUserManageEventTasks(req.user)) return res.status(403).json({ error: 'Access denied' });

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

        const assigneeError = await assertAssigneesOnEventTeams(eventId, {
            leaderId,
            memberIds: assignments.map((assignment) => assignment.memberId),
        });
        if (assigneeError) return res.status(400).json({ error: assigneeError });

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
        if (!canUserManageEventTasks(req.user)) return res.status(403).json({ error: 'Access denied' });

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

        const nextLeaderId = req.body?.leaderId !== undefined
            ? parseId(req.body.leaderId)
            : existing.leaderId;
        const nextMemberIds = parsedAssignments !== null
            ? parsedAssignments.map((assignment) => assignment.memberId)
            : existing.assignments.map((assignment) => assignment.memberId);

        const assigneeError = await assertAssigneesOnEventTeams(eventId, {
            leaderId: nextLeaderId,
            memberIds: nextMemberIds,
        });
        if (assigneeError) return res.status(400).json({ error: assigneeError });

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
        if (!canUserManageEventTasks(req.user)) return res.status(403).json({ error: 'Access denied' });

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
        if (!canUserManageEventTasks(req.user)) return res.status(403).json({ error: 'Access denied' });

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
