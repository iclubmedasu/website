import { Prisma } from '@prisma/client';
import express, { Request, Response } from 'express';
import { prisma } from '../db';
import { generateUniqueConfirmationCode } from '../services/eventCode';

const router = express.Router();

const MANAGER_ROLES = ['isDeveloper', 'isOfficer', 'isAdmin', 'isLeadership'];
const PUBLIC_VISIBLE_STATUSES = ['PUBLISHED', 'COMPLETED'];
const VALID_EVENT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']);

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasManagerAccess(req: Request): boolean {
    return !!req.user?.memberId && MANAGER_ROLES.some((key) => Boolean((req.user as Record<string, unknown>)[key]));
}

async function buildEventWhere(req: Request) {
    const where: Record<string, unknown> = {
        isActive: true,
    };

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
        where.eventDate = {} as Record<string, Date>;
        if (dateFrom) {
            (where.eventDate as Record<string, Date>).gte = new Date(dateFrom);
        }
        if (dateTo) {
            (where.eventDate as Record<string, Date>).lte = new Date(dateTo);
        }
    }

    return where;
}

function eventInclude() {
    return {
        project: { select: { id: true, title: true, status: true } },
        createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
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

router.post('/', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const title = String(req.body?.title || '').trim();
        const eventDate = new Date(String(req.body?.eventDate || ''));
        if (!title || Number.isNaN(eventDate.getTime())) {
            return res.status(400).json({ error: 'title and valid eventDate are required' });
        }

        const projectId = parseId(req.body?.projectId);
        const registrationDeadline = req.body?.registrationDeadline ? new Date(String(req.body.registrationDeadline)) : null;
        const parsedCapacity = req.body?.capacity === '' || req.body?.capacity == null ? undefined : Number.parseInt(String(req.body.capacity), 10);
        const capacity = typeof parsedCapacity === 'number' && Number.isInteger(parsedCapacity) && parsedCapacity >= 0 ? parsedCapacity : null;
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const created = await prisma.event.create({
            data: {
                title,
                description: String(req.body?.description || '').trim() || null,
                venue: String(req.body?.venue || '').trim() || null,
                eventDate,
                registrationDeadline: registrationDeadline && !Number.isNaN(registrationDeadline.getTime()) ? registrationDeadline : null,
                capacity,
                allowWalkIns: Boolean(req.body?.allowWalkIns),
                isCertifiable: Boolean(req.body?.isCertifiable),
                projectId,
                createdByMemberId: memberId,
                status: 'DRAFT',
                isActive: true,
            },
            include: eventInclude(),
        });

        return res.status(201).json(created);
    } catch (error) {
        console.error('POST /events error:', error);
        return res.status(500).json({ error: 'Failed to create event' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const existing = await prisma.event.findUnique({ where: { id: eventId } });
        if (!existing) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const eventDateValue = req.body?.eventDate ? new Date(String(req.body.eventDate)) : null;
        const registrationDeadlineValue = req.body?.registrationDeadline ? new Date(String(req.body.registrationDeadline)) : null;
        const parsedCapacity = req.body?.capacity === '' || req.body?.capacity == null ? undefined : Number.parseInt(String(req.body.capacity), 10);
        const capacity = typeof parsedCapacity === 'number' && Number.isInteger(parsedCapacity) && parsedCapacity >= 0 ? parsedCapacity : null;
        const projectId = req.body?.projectId === null ? null : parseId(req.body?.projectId);

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                title: req.body?.title !== undefined ? String(req.body.title).trim() : existing.title,
                description: req.body?.description !== undefined ? String(req.body.description).trim() || null : existing.description,
                venue: req.body?.venue !== undefined ? String(req.body.venue).trim() || null : existing.venue,
                eventDate: eventDateValue && !Number.isNaN(eventDateValue.getTime()) ? eventDateValue : existing.eventDate,
                registrationDeadline:
                    req.body?.registrationDeadline !== undefined
                        ? (registrationDeadlineValue && !Number.isNaN(registrationDeadlineValue.getTime()) ? registrationDeadlineValue : null)
                        : existing.registrationDeadline,
                capacity: req.body?.capacity !== undefined ? capacity : existing.capacity,
                allowWalkIns: req.body?.allowWalkIns !== undefined ? Boolean(req.body.allowWalkIns) : existing.allowWalkIns,
                isCertifiable: req.body?.isCertifiable !== undefined ? Boolean(req.body.isCertifiable) : existing.isCertifiable,
                projectId: req.body?.projectId !== undefined ? projectId : existing.projectId,
            },
            include: eventInclude(),
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id} error:`, error);
        return res.status(500).json({ error: 'Failed to update event' });
    }
});

router.patch('/:id/status', async (req, res) => {
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

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                status: nextStatus,
                isActive: nextStatus !== 'CANCELLED',
                deletedAt: nextStatus === 'CANCELLED' ? new Date() : null,
            },
            include: eventInclude(),
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/status error:`, error);
        return res.status(500).json({ error: 'Failed to update event status' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) {
            return res.status(403).json({ error: 'Event management access required' });
        }

        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: 'Invalid event ID' });
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

router.post('/:id/tiers', async (req, res) => {
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
                order: Number.isInteger(Number(req.body?.order)) ? Number(req.body.order) : 0,
            },
            include: { _count: { select: { registrations: true } } },
        });

        return res.status(201).json(created);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/tiers error:`, error);
        return res.status(500).json({ error: 'Failed to create tier' });
    }
});

router.put('/:id/tiers/:tierId', async (req, res) => {
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
                order: req.body?.order !== undefined && Number.isInteger(Number(req.body.order)) ? Number(req.body.order) : existing.order,
                isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive,
            },
            include: { _count: { select: { registrations: true } } },
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id}/tiers/${req.params.tierId} error:`, error);
        return res.status(500).json({ error: 'Failed to update tier' });
    }
});

router.delete('/:id/tiers/:tierId', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const tierId = parseId(req.params.tierId);
        if (!eventId || !tierId) return res.status(400).json({ error: 'Invalid event or tier ID' });

        const registrationCount = await prisma.eventRegistration.count({ where: { eventId, tierId, status: { not: 'CANCELLED' } } });
        if (registrationCount > 0) {
            return res.status(409).json({ error: 'Cannot delete a tier with registrations' });
        }

        await prisma.eventTier.deleteMany({ where: { id: tierId, eventId } });
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
            where: { eventId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });

        return res.json(fields);
    } catch (error) {
        console.error(`GET /events/${req.params.id}/custom-fields error:`, error);
        return res.status(500).json({ error: 'Failed to fetch custom fields' });
    }
});

router.post('/:id/custom-fields', async (req, res) => {
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
                order: Number.isInteger(Number(req.body?.order)) ? Number(req.body.order) : (highestOrder._max.order ?? -1) + 1,
                isLocked: Boolean(req.body?.isLocked),
            },
        });

        return res.status(201).json(created);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/custom-fields error:`, error);
        return res.status(500).json({ error: 'Failed to create custom field' });
    }
});

router.put('/:id/custom-fields/:fieldId', async (req, res) => {
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
                isLocked: req.body?.isLocked !== undefined ? Boolean(req.body.isLocked) : existing.isLocked,
                order: req.body?.order !== undefined && Number.isInteger(Number(req.body.order)) ? Number(req.body.order) : existing.order,
            },
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PUT /events/${req.params.id}/custom-fields/${req.params.fieldId} error:`, error);
        return res.status(500).json({ error: 'Failed to update custom field' });
    }
});

router.patch('/:id/custom-fields/reorder', async (req, res) => {
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
        return res.json(fields);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/custom-fields/reorder error:`, error);
        return res.status(500).json({ error: 'Failed to reorder custom fields' });
    }
});

router.delete('/:id/custom-fields/:fieldId', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const fieldId = parseId(req.params.fieldId);
        if (!eventId || !fieldId) return res.status(400).json({ error: 'Invalid event or field ID' });

        const registrationCount = await getEventRegistrationCount(eventId);
        if (registrationCount > 0) {
            return res.status(409).json({ error: 'Cannot delete a custom field after registrations exist' });
        }

        await prisma.eventCustomField.deleteMany({ where: { id: fieldId, eventId } });
        return res.json({ success: true });
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/custom-fields/${req.params.fieldId} error:`, error);
        return res.status(500).json({ error: 'Failed to remove custom field' });
    }
});

// ============================================
// Registrations
// ============================================
router.get('/:id/registrations', async (req, res) => {
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
            where.status = { not: 'CHECKED_IN' };
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

router.get('/:id/registrations/:registrationId', async (req, res) => {
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

        return res.status(201).json(registration);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/registrations error:`, error);
        return res.status(500).json({ error: 'Failed to create registration' });
    }
});

router.post('/:id/registrations/walk-in', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!event.allowWalkIns) return res.status(409).json({ error: 'Walk-ins are disabled for this event' });

        const fullName = String(req.body?.fullName || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!fullName || !email) return res.status(400).json({ error: 'fullName and email are required' });

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
                status: 'REGISTERED',
                isWalkIn: true,
                notes: String(req.body?.notes || '').trim() || null,
                customFieldValues: toJsonInput(req.body?.customFieldValues),
            },
        });

        return res.status(201).json(registration);
    } catch (error) {
        console.error(`POST /events/${req.params.id}/registrations/walk-in error:`, error);
        return res.status(500).json({ error: 'Failed to create walk-in registration' });
    }
});

router.patch('/:id/registrations/:registrationId/check-in', async (req, res) => {
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
        if (registration.status === 'CHECKED_IN') return res.status(409).json({ error: 'Attendee already checked in' });

        const updated = await prisma.eventRegistration.update({
            where: { id: registration.id },
            data: { status: 'CHECKED_IN', checkedInAt: new Date() },
        });

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId}/check-in error:`, error);
        return res.status(500).json({ error: 'Failed to check in registration' });
    }
});

router.patch('/:id/registrations/:registrationId', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        const registrationId = parseId(req.params.registrationId);
        if (!eventId || !registrationId) return res.status(400).json({ error: 'Invalid registration ID' });

        const existing = await prisma.eventRegistration.findFirst({ where: { id: registrationId, eventId } });
        if (!existing) return res.status(404).json({ error: 'Registration not found' });

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

        return res.json(updated);
    } catch (error) {
        console.error(`PATCH /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to update registration' });
    }
});

router.delete('/:id/registrations/:registrationId', async (req, res) => {
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

        return res.json(updated);
    } catch (error) {
        console.error(`DELETE /events/${req.params.id}/registrations/${req.params.registrationId} error:`, error);
        return res.status(500).json({ error: 'Failed to cancel registration' });
    }
});

// ============================================
// Statistics
// ============================================
router.get('/:id/statistics', async (req, res) => {
    try {
        if (!hasManagerAccess(req)) return res.status(403).json({ error: 'Event management access required' });

        const eventId = parseId(req.params.id);
        if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, capacity: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const [totalRegistered, totalCheckedIn, walkInCount, noShowCount, byTier, timeline] = await Promise.all([
            prisma.eventRegistration.count({ where: { eventId, status: { not: 'CANCELLED' } } }),
            prisma.eventRegistration.count({ where: { eventId, status: 'CHECKED_IN' } }),
            prisma.eventRegistration.count({ where: { eventId, isWalkIn: true, status: { not: 'CANCELLED' } } }),
            prisma.eventRegistration.count({ where: { eventId, status: { in: ['REGISTERED'] } } }),
            prisma.eventTier.findMany({
                where: { eventId },
                select: { id: true, name: true, _count: { select: { registrations: true } } },
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            }),
            prisma.eventRegistration.findMany({
                where: { eventId, status: { not: 'CANCELLED' } },
                select: { createdAt: true },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        const registrationsByDay = new Map<string, number>();
        for (const item of timeline) {
            const day = item.createdAt.toISOString().slice(0, 10);
            registrationsByDay.set(day, (registrationsByDay.get(day) ?? 0) + 1);
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
        });
    } catch (error) {
        console.error(`GET /events/${req.params.id}/statistics error:`, error);
        return res.status(500).json({ error: 'Failed to fetch event statistics' });
    }
});

export default router;
