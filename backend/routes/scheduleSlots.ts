const express: any = require('express');
const router: any = express.Router();
const { prisma }: { prisma: any } = require('../db');
const {
    collectChangedFields,
    changesToPayload,
    logProjectActivity,
    summarizeChanges,
} = require('../services/activityLogService');

function canManageSchedule(req) {
    return !!req.user?.memberId && !!(req.user.isDeveloper || req.user.isOfficer || req.user.isAdmin || req.user.isLeadership || req.user.isSpecial);
}

async function resolveProjectId({ projectId, taskId }: { projectId?: string | number; taskId?: string | number }) {
    if (projectId !== undefined && projectId !== null && projectId !== '') return parseInt(String(projectId), 10);
    if (!taskId) return null;

    const task = await prisma.task.findUnique({
        where: { id: parseInt(String(taskId), 10) },
        select: { projectId: true },
    });

    return task?.projectId ?? null;
}

function parseDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// ============================================
// GET /api/schedule-slots
// Query: projectId, taskId, memberId, includeInactive
// ============================================
router.get('/', async (req, res) => {
    try {
        const { projectId, taskId, memberId, includeInactive } = req.query;

        if (!projectId && !taskId) {
            return res.status(400).json({ error: 'projectId or taskId is required' });
        }

        const where: any = {};
        if (projectId) where.projectId = parseInt(projectId, 10);
        if (taskId) where.taskId = parseInt(taskId, 10);
        if (memberId) where.memberId = parseInt(memberId, 10);
        if (includeInactive !== 'true') where.isActive = true;

        const slots = await prisma.projectScheduleSlot.findMany({
            where,
            include: {
                project: { select: { id: true, title: true } },
                task: { select: { id: true, title: true, parentTaskId: true } },
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                createdBy: { select: { id: true, fullName: true } },
            },
            orderBy: [{ startDateTime: 'asc' }, { createdAt: 'asc' }],
        });

        res.json(slots);
    } catch (error) {
        console.error('GET /schedule-slots', error);
        res.status(500).json({ error: 'Failed to fetch schedule slots' });
    }
});

// ============================================
// POST /api/schedule-slots
// Body: { projectId?, taskId?, memberId, title?, notes?, startDateTime, endDateTime }
// ============================================
router.post('/', async (req, res) => {
    try {
        if (!canManageSchedule(req)) {
            return res.status(403).json({ error: 'Schedule edit access denied' });
        }

        const { projectId, taskId, memberId, title, notes, startDateTime, endDateTime } = req.body;
        if (!memberId) return res.status(400).json({ error: 'memberId is required' });

        const start = parseDateTime(startDateTime);
        const end = parseDateTime(endDateTime);
        if (!start || !end) return res.status(400).json({ error: 'Valid startDateTime and endDateTime are required' });
        if (end <= start) return res.status(400).json({ error: 'endDateTime must be after startDateTime' });

        const resolvedProjectId = await resolveProjectId({ projectId, taskId });
        if (!resolvedProjectId) return res.status(400).json({ error: 'projectId or taskId is required' });

        const slot = await prisma.projectScheduleSlot.create({
            data: {
                projectId: resolvedProjectId,
                taskId: taskId ? parseInt(taskId, 10) : null,
                memberId: parseInt(memberId, 10),
                createdByMemberId: req.user.memberId,
                title: title?.trim() || null,
                notes: notes?.trim() || null,
                startDateTime: start,
                endDateTime: end,
            },
            include: {
                project: { select: { id: true, title: true } },
                task: { select: { id: true, title: true, parentTaskId: true } },
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                createdBy: { select: { id: true, fullName: true } },
            },
        });

        await logProjectActivity({
            projectId: slot.projectId,
            taskId: slot.taskId,
            memberId: req.user.memberId,
            actionType: 'CREATED',
            entityType: 'SCHEDULE_SLOT',
            newValue: {
                memberId: slot.memberId,
                taskId: slot.taskId,
                title: slot.title,
                startDateTime: slot.startDateTime,
                endDateTime: slot.endDateTime,
            },
            description: `Schedule slot created for ${slot.member.fullName}`,
        });

        res.status(201).json(slot);
    } catch (error) {
        console.error('POST /schedule-slots', error);
        res.status(500).json({ error: 'Failed to create schedule slot' });
    }
});

// ============================================
// PATCH /api/schedule-slots/:id
// ============================================
router.patch('/:id', async (req, res) => {
    try {
        if (!canManageSchedule(req)) {
            return res.status(403).json({ error: 'Schedule edit access denied' });
        }

        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid slot ID' });

        const before = await prisma.projectScheduleSlot.findUnique({
            where: { id },
            select: {
                projectId: true,
                taskId: true,
                memberId: true,
                title: true,
                notes: true,
                startDateTime: true,
                endDateTime: true,
                isActive: true,
            },
        });
        if (!before) return res.status(404).json({ error: 'Schedule slot not found' });

        const data: any = {};
        if (req.body.title !== undefined) data.title = req.body.title?.trim() || null;
        if (req.body.notes !== undefined) data.notes = req.body.notes?.trim() || null;
        if (req.body.memberId !== undefined) data.memberId = parseInt(req.body.memberId, 10);
        if (req.body.taskId !== undefined) {
            data.taskId = req.body.taskId ? parseInt(req.body.taskId, 10) : null;
            if (data.taskId) {
                const resolvedProjectId = await resolveProjectId({ taskId: data.taskId });
                if (resolvedProjectId) data.projectId = resolvedProjectId;
            }
        }
        if (req.body.startDateTime !== undefined) {
            const start = parseDateTime(req.body.startDateTime);
            if (!start) return res.status(400).json({ error: 'Valid startDateTime is required' });
            data.startDateTime = start;
        }
        if (req.body.endDateTime !== undefined) {
            const end = parseDateTime(req.body.endDateTime);
            if (!end) return res.status(400).json({ error: 'Valid endDateTime is required' });
            data.endDateTime = end;
        }
        if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

        const nextStart = data.startDateTime ?? before.startDateTime;
        const nextEnd = data.endDateTime ?? before.endDateTime;
        if (nextEnd <= nextStart) return res.status(400).json({ error: 'endDateTime must be after startDateTime' });

        const slot = await prisma.projectScheduleSlot.update({
            where: { id },
            data,
            include: {
                project: { select: { id: true, title: true } },
                task: { select: { id: true, title: true, parentTaskId: true } },
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                createdBy: { select: { id: true, fullName: true } },
            },
        });

        const after = {
            projectId: slot.projectId,
            taskId: slot.taskId,
            memberId: slot.memberId,
            title: slot.title,
            notes: slot.notes,
            startDateTime: slot.startDateTime,
            endDateTime: slot.endDateTime,
            isActive: slot.isActive,
        };

        const changes = collectChangedFields(before, after, {
            projectId: 'project',
            taskId: 'task',
            memberId: 'member',
            title: 'title',
            notes: 'notes',
            startDateTime: 'start time',
            endDateTime: 'end time',
            isActive: 'active state',
        });

        if (changes.length > 0) {
            const { oldValue, newValue } = changesToPayload(changes);
            await logProjectActivity({
                projectId: slot.projectId,
                taskId: slot.taskId,
                memberId: req.user.memberId,
                actionType: 'UPDATED',
                entityType: 'SCHEDULE_SLOT',
                oldValue,
                newValue,
                description: summarizeChanges(changes) || 'Schedule slot updated',
            });
        }

        res.json(slot);
    } catch (error) {
        console.error('PATCH /schedule-slots/:id', error);
        res.status(500).json({ error: 'Failed to update schedule slot' });
    }
});

// ============================================
// DELETE /api/schedule-slots/:id
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        if (!canManageSchedule(req)) {
            return res.status(403).json({ error: 'Schedule edit access denied' });
        }

        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid slot ID' });

        const existing = await prisma.projectScheduleSlot.findUnique({
            where: { id },
            select: {
                projectId: true,
                taskId: true,
                memberId: true,
                title: true,
                notes: true,
                startDateTime: true,
                endDateTime: true,
            },
        });
        if (!existing) return res.status(404).json({ error: 'Schedule slot not found' });

        await logProjectActivity({
            projectId: existing.projectId,
            taskId: existing.taskId,
            memberId: req.user.memberId,
            actionType: 'DELETED',
            entityType: 'SCHEDULE_SLOT',
            oldValue: existing,
            description: `Schedule slot deleted for member #${existing.memberId}`,
        });

        await prisma.projectScheduleSlot.delete({ where: { id } });
        res.json({ message: 'Schedule slot deleted' });
    } catch (error) {
        console.error('DELETE /schedule-slots/:id', error);
        res.status(500).json({ error: 'Failed to delete schedule slot' });
    }
});

export default router;
