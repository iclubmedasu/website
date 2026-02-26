const express = require('express');
const router = express.Router();
const { prisma } = require('../db'); // Change from '../server' to '../prisma'

// ============================================
// ROLE HISTORY ENDPOINTS
// ============================================

// GET /api/role-history - Get role history (with filters)
router.get('/', async (req, res) => {
    try {
        const { memberId, teamId, changeType, isActive } = req.query;

        const where = {};
        if (memberId) where.memberId = parseInt(memberId);
        if (teamId) where.teamId = parseInt(teamId);
        if (changeType) where.changeType = changeType;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const history = await prisma.memberRoleHistory.findMany({
            where,
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true
            },
            orderBy: { startDate: 'desc' }
        });

        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch role history' });
    }
});

// GET /api/role-history/:id - Get single history entry
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const historyEntry = await prisma.memberRoleHistory.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true
            }
        });

        if (!historyEntry) {
            return res.status(404).json({ error: 'History entry not found' });
        }

        res.json(historyEntry);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch history entry' });
    }
});

// GET /api/role-history/member/:memberId - Get complete history for a member
router.get('/member/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;

        const history = await prisma.memberRoleHistory.findMany({
            where: { memberId: parseInt(memberId) },
            include: {
                team: true,
                role: true,
                subteam: true
            },
            orderBy: { startDate: 'desc' }
        });

        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch member history' });
    }
});

// GET /api/role-history/member/:memberId/timeline - Get member's timeline (formatted)
router.get('/member/:memberId/timeline', async (req, res) => {
    try {
        const { memberId } = req.params;

        const history = await prisma.memberRoleHistory.findMany({
            where: { memberId: parseInt(memberId) },
            include: {
                team: true,
                role: true,
                member: true,
                subteam: true
            },
            orderBy: { startDate: 'asc' }
        });

        // Format timeline for better visualization (includes subteam when present)
        const timeline = history.map(entry => ({
            id: entry.id,
            memberName: entry.member.fullName,
            teamName: entry.team?.name || 'Unknown Team',
            roleName: entry.role?.roleName || 'Unknown Role',
            subteamName: entry.subteam?.name || null,
            changeType: entry.changeType,
            changeReason: entry.changeReason,
            notes: entry.notes,
            period: {
                start: entry.startDate,
                end: entry.endDate,
                duration: entry.endDate
                    ? Math.floor((new Date(entry.endDate) - new Date(entry.startDate)) / (1000 * 60 * 60 * 24))
                    : 'Ongoing'
            },
            isActive: entry.isActive
        }));

        res.json(timeline);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch member timeline' });
    }
});

// GET /api/role-history/team/:teamId - Get complete history for a team
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        const history = await prisma.memberRoleHistory.findMany({
            where: { teamId: parseInt(teamId) },
            include: {
                member: true,
                role: true,
                subteam: true
            },
            orderBy: { startDate: 'desc' }
        });

        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch team history' });
    }
});

// GET /api/role-history/stats/changes - Get statistics about role changes
router.get('/stats/changes', async (req, res) => {
    try {
        const stats = await prisma.memberRoleHistory.groupBy({
            by: ['changeType'],
            _count: {
                changeType: true
            }
        });

        const formattedStats = stats.map(stat => ({
            changeType: stat.changeType,
            count: stat._count.changeType
        }));

        res.json(formattedStats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// PUT /api/role-history/:id - Update history entry (for corrections)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { changeReason, notes, changeType } = req.body;

        const updateData = {};
        if (changeReason !== undefined) updateData.changeReason = changeReason;
        if (notes !== undefined) updateData.notes = notes;
        if (changeType !== undefined) updateData.changeType = changeType;

        const updatedHistory = await prisma.memberRoleHistory.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true
            }
        });

        res.json(updatedHistory);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'History entry not found' });
        }

        res.status(500).json({ error: 'Failed to update history entry' });
    }
});

// DELETE /api/role-history/:id - Delete history entry (use with extreme caution!)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.memberRoleHistory.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'History entry permanently deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete history entry' });
    }
});

module.exports = router;