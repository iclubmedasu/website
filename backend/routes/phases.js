const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

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

        await prisma.projectPhase.delete({ where: { id } });

        res.json({ message: 'Phase deleted' });
    } catch (error) {
        console.error('DELETE /phases/:id', error);
        res.status(500).json({ error: 'Failed to delete phase' });
    }
});

module.exports = router;
