const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

// GET /api/alumni - List all alumni (members who left the club), optionally filter by team
router.get('/', async (req, res) => {
    try {
        const { teamId } = req.query;
        const where = {};
        if (teamId) where.teamId = parseInt(teamId);

        const list = await prisma.alumni.findMany({
            where,
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true
            },
            orderBy: { leftDate: 'desc' }
        });

        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch alumni' });
    }
});

module.exports = router;
