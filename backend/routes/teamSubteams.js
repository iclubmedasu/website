const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

// ============================================
// TEAM SUBTEAMS ENDPOINTS
// ============================================

// GET /api/team-subteams - Get all subteams (optionally filter by team)
router.get('/', async (req, res) => {
    try {
        const { teamId, isActive } = req.query;

        const where = {};
        const parsedTeamId = teamId ? parseInt(teamId, 10) : null;
        if (parsedTeamId != null && !Number.isNaN(parsedTeamId)) {
            where.teamId = parsedTeamId;
        }
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const subteams = await prisma.subteam.findMany({
            where,
            include: {
                team: true,
                _count: {
                    select: {
                        assignments: { where: { isActive: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(subteams);
    } catch (error) {
        console.error('[team-subteams GET]', error.message || error);
        return res.json([]);
    }
});

// GET /api/team-subteams/:id - Get single subteam with details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const subteam = await prisma.subteam.findUnique({
            where: { id: parseInt(id) },
            include: {
                team: true,
                assignments: {
                    where: { isActive: true },
                    include: {
                        member: true
                    }
                }
            }
        });

        if (!subteam) {
            return res.status(404).json({ error: 'Subteam not found' });
        }

        res.json(subteam);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch subteam' });
    }
});

// POST /api/team-subteams - Create new subteam for a team
router.post('/', async (req, res) => {
    try {
        const { teamId, name, description } = req.body;

        const team = await prisma.team.findUnique({
            where: { id: parseInt(teamId) }
        });

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const newSubteam = await prisma.subteam.create({
            data: {
                teamId: parseInt(teamId),
                name: name.trim(),
                description: description ? description.trim() : null
            },
            include: {
                team: true
            }
        });

        res.status(201).json(newSubteam);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Subteam name already exists in this team'
            });
        }

        res.status(500).json({ error: 'Failed to create subteam' });
    }
});

// PUT /api/team-subteams/:id - Update subteam
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description ? description.trim() : null;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedSubteam = await prisma.subteam.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                team: true
            }
        });

        res.json(updatedSubteam);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Subteam not found' });
        }

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Subteam name already exists in this team'
            });
        }

        res.status(500).json({ error: 'Failed to update subteam' });
    }
});

// PATCH /api/team-subteams/:id/deactivate - Deactivate subteam; clear subteamId for all members (they stay in team with same role)
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: 'Invalid subteam id' });
        }

        await prisma.$transaction([
            prisma.subteam.update({
                where: { id },
                data: { isActive: false }
            }),
            prisma.teamMember.updateMany({
                where: { subteamId: id },
                data: { subteamId: null }
            })
        ]);

        const deactivatedSubteam = await prisma.subteam.findUnique({
            where: { id },
            include: { team: true }
        });

        res.json({
            message: 'Subteam deactivated. All members have been removed from this subteam; they remain in the team with the same role.',
            subteam: deactivatedSubteam
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Subteam not found' });
        }
        res.status(500).json({ error: 'Failed to deactivate subteam' });
    }
});

// PATCH /api/team-subteams/:id/activate - Activate subteam
router.patch('/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;

        const activatedSubteam = await prisma.subteam.update({
            where: { id: parseInt(id) },
            data: { isActive: true },
            include: { team: true }
        });

        res.json({
            message: 'Subteam activated successfully',
            subteam: activatedSubteam
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Subteam not found' });
        }
        res.status(500).json({ error: 'Failed to activate subteam' });
    }
});

module.exports = router;
