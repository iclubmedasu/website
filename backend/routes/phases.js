const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { recomputeProjectWbs } = require('../services/wbsService');

/**
 * Is the user privileged (developer, officer, administration, leadership)?
 */
function isPrivilegedUser(req) {
    return !!(req.user.isDeveloper || req.user.isOfficer || req.user.isAdmin || req.user.isLeadership);
}

/**
 * Can the user modify phases (add/edit/delete)?
 * Privileged + special roles only.
 */
function canUserEditPhase(req) {
    if (!req.user.memberId) return false;
    return isPrivilegedUser(req) || !!req.user.isSpecial;
}

// ============================================
// GET /api/phases?projectId=X  –  list active phases for a project
// ============================================
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const phases = await prisma.projectPhase.findMany({
            where: {
                projectId: parseInt(projectId),
                isActive: true,
            },
            include: {
                _count: { select: { tasks: true } },
            },
            orderBy: { order: 'asc' },
        });

        res.json(phases);
    } catch (error) {
        console.error('GET /phases', error);
        res.status(500).json({ error: 'Failed to fetch phases' });
    }
});

// ============================================
// POST /api/phases  –  create a new phase
// Body: { projectId, title, description?, order? }
// ============================================
router.post('/', async (req, res) => {
    try {
        const { projectId, title, description, order } = req.body;

        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

        // Only privileged + special roles can create phases
        if (!canUserEditPhase(req)) {
            return res.status(403).json({ error: 'Only privileged and special roles can create phases' });
        }

        // Auto-set order to max existing order + 1 if not provided
        let phaseOrder = order;
        if (phaseOrder === undefined || phaseOrder === null) {
            const maxPhase = await prisma.projectPhase.findFirst({
                where: { projectId: parseInt(projectId) },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            phaseOrder = (maxPhase?.order ?? 0) + 1;
        }

        const phase = await prisma.projectPhase.create({
            data: {
                projectId: parseInt(projectId),
                title: title.trim(),
                description: description?.trim() || null,
                order: parseInt(phaseOrder),
            },
            include: {
                _count: { select: { tasks: true } },
            },
        });

        // Recompute WBS codes for the project
        await recomputeProjectWbs(parseInt(projectId));

        res.status(201).json(phase);
    } catch (error) {
        console.error('POST /phases', error);
        res.status(500).json({ error: 'Failed to create phase' });
    }
});

// ============================================
// PATCH /api/phases/:id  –  update a phase
// Body can include: title, description, order, isActive
// ============================================
router.patch('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid phase ID' });

        // Only privileged + special roles can edit phases
        if (!canUserEditPhase(req)) {
            return res.status(403).json({ error: 'Only privileged and special roles can edit phases' });
        }

        const { title, description, order, isActive } = req.body;

        const data = {};
        if (title !== undefined) data.title = title.trim();
        if (description !== undefined) data.description = description?.trim() || null;
        if (order !== undefined) data.order = parseInt(order);
        if (isActive !== undefined) data.isActive = isActive;

        const phase = await prisma.projectPhase.update({
            where: { id },
            data,
            include: {
                _count: { select: { tasks: true } },
            },
        });

        // Recompute WBS codes for the project
        await recomputeProjectWbs(phase.projectId);

        res.json(phase);
    } catch (error) {
        console.error('PATCH /phases/:id', error);
        res.status(500).json({ error: 'Failed to update phase' });
    }
});

// ============================================
// DELETE /api/phases/:id  –  hard-delete (cascades to tasks, assignments, comments, etc.)
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid phase ID' });

        // Only privileged + special roles can delete phases
        if (!canUserEditPhase(req)) {
            return res.status(403).json({ error: 'Only privileged and special roles can delete phases' });
        }

        // Fetch projectId before deleting
        const phaseToDelete = await prisma.projectPhase.findUnique({ where: { id }, select: { projectId: true } });
        await prisma.projectPhase.delete({ where: { id } });

        // Recompute WBS codes for the project
        if (phaseToDelete) await recomputeProjectWbs(phaseToDelete.projectId);

        res.json({ message: 'Phase deleted' });
    } catch (error) {
        console.error('DELETE /phases/:id', error);
        res.status(500).json({ error: 'Failed to delete phase' });
    }
});

// ============================================
// POST /api/phases/:id/duplicate  –  deep-copy phase with all tasks + subtasks
// Body: { afterOrder? }
// ============================================
router.post('/:id/duplicate', async (req, res) => {
    try {
        const sourceId = parseInt(req.params.id);
        if (isNaN(sourceId)) return res.status(400).json({ error: 'Invalid phase ID' });
        if (!canUserEditPhase(req)) {
            return res.status(403).json({ error: 'Only privileged and special roles can duplicate phases' });
        }

        const source = await prisma.projectPhase.findUnique({
            where: { id: sourceId },
            include: {
                tasks: {
                    where: { parentTaskId: null, isActive: true },
                    include: {
                        subtasks: { where: { isActive: true } },
                        taskTeams: true,
                    },
                },
            },
        });
        if (!source) return res.status(404).json({ error: 'Phase not found' });

        // Determine order for new phase
        const maxPhase = await prisma.projectPhase.findFirst({
            where: { projectId: source.projectId },
            orderBy: { order: 'desc' },
            select: { order: true },
        });
        const newOrder = (maxPhase?.order ?? 0) + 1;

        const newPhase = await prisma.projectPhase.create({
            data: {
                projectId: source.projectId,
                title: source.title + ' (Copy)',
                description: source.description,
                order: newOrder,
            },
        });

        // Deep-copy tasks and subtasks
        for (const task of source.tasks) {
            const newTask = await prisma.task.create({
                data: {
                    projectId: task.projectId,
                    phaseId: newPhase.id,
                    parentTaskId: null,
                    title: task.title,
                    description: task.description,
                    type: task.type,
                    status: 'NOT_STARTED',
                    difficulty: task.difficulty,
                    priority: task.priority,
                    startDate: task.startDate,
                    dueDate: task.dueDate,
                    estimatedHours: task.estimatedHours,
                },
            });

            // Copy subtasks
            for (const sub of (task.subtasks || [])) {
                await prisma.task.create({
                    data: {
                        projectId: sub.projectId,
                        phaseId: newPhase.id,
                        parentTaskId: newTask.id,
                        title: sub.title,
                        description: sub.description,
                        type: sub.type,
                        status: 'NOT_STARTED',
                        difficulty: sub.difficulty,
                        priority: sub.priority,
                        startDate: sub.startDate,
                        dueDate: sub.dueDate,
                        estimatedHours: sub.estimatedHours,
                    },
                });
            }

            // Copy team assignments
            for (const tt of (task.taskTeams || [])) {
                await prisma.taskTeam.create({
                    data: {
                        taskId: newTask.id,
                        teamId: tt.teamId,
                        canEdit: tt.canEdit,
                    },
                }).catch(() => {});
            }
        }

        const result = await prisma.projectPhase.findUnique({
            where: { id: newPhase.id },
            include: { _count: { select: { tasks: true } } },
        });

        // Recompute WBS codes for the project
        await recomputeProjectWbs(source.projectId);

        res.status(201).json(result);
    } catch (error) {
        console.error('POST /phases/:id/duplicate', error);
        res.status(500).json({ error: 'Failed to duplicate phase' });
    }
});

module.exports = router;
