const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const ADMINISTRATION_TEAM_NAME = 'Administration';
const adminOnly = (req, res, next) => requireAdmin(req, res, next).catch(next);

// Default roles created for every team (cannot be deactivated; systemRoleKey 1, 2, 3)
const DEFAULT_TEAM_ROLES = [
    { systemRoleKey: 1, roleName: 'Head of Team', roleType: 'Leadership', maxCount: 1 },
    { systemRoleKey: 2, roleName: 'Vice Head of Team', roleType: 'Leadership', maxCount: 1 },
    { systemRoleKey: 3, roleName: 'Member', roleType: 'Regular', maxCount: null }
];

// ============================================
// TEAM ENDPOINTS
// ============================================

// GET /api/teams - Get teams (excludes Administration team)
// - scope=all: return all teams for any authenticated user (e.g. Members/Alumni dropdowns)
// - no scope: developer or Administration member gets all; others get only teams they belong to
router.get('/', async (req, res) => {
    try {
        const { isActive, scope } = req.query;
        const where = isActive !== undefined ? { isActive: isActive === 'true' } : {};
        where.name = { not: ADMINISTRATION_TEAM_NAME };

        const wantAllTeams = scope === 'all';
        if (!wantAllTeams && req.user && !req.user.isDeveloper) {
            const adminMembership = await prisma.teamMember.findFirst({
                where: {
                    memberId: req.user.memberId,
                    isActive: true,
                    team: { name: ADMINISTRATION_TEAM_NAME }
                }
            });
            if (!adminMembership) {
                const myTeamIds = await prisma.teamMember.findMany({
                    where: { memberId: req.user.memberId, isActive: true },
                    select: { teamId: true }
                }).then((rows) => rows.map((r) => r.teamId));
                if (myTeamIds.length === 0) {
                    return res.json([]);
                }
                where.id = { in: myTeamIds };
            }
        }

        const teams = await prisma.team.findMany({
            where,
            include: {
                members: {
                    where: { isActive: true },
                    include: {
                        member: true,
                        role: true
                    }
                },
                roles: {
                    where: { isActive: true }
                },
                _count: {
                    select: {
                        members: { where: { isActive: true } },
                        roles: { where: { isActive: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(teams);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// GET /api/teams/:id - Get single team with full details (non-admin only if member of that team)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const teamId = parseInt(id);

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                members: {
                    include: {
                        member: true,
                        role: true
                    }
                },
                roles: true,
                roleHistory: {
                    include: {
                        member: true,
                        role: true
                    },
                    orderBy: { startDate: 'desc' }
                }
            }
        });

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        if (team.name === ADMINISTRATION_TEAM_NAME) {
            return res.status(404).json({ error: 'Team not found' });
        }

        if (!req.user.isDeveloper) {
            const adminMembership = await prisma.teamMember.findFirst({
                where: {
                    memberId: req.user.memberId,
                    isActive: true,
                    team: { name: ADMINISTRATION_TEAM_NAME }
                }
            });
            if (!adminMembership) {
                const myMembership = await prisma.teamMember.findFirst({
                    where: { teamId, memberId: req.user.memberId, isActive: true }
                });
                if (!myMembership) {
                    return res.status(403).json({ error: 'Access denied to this team' });
                }
            }
        }

        res.json(team);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

// POST /api/teams - Create new team and its 3 default roles (Head, Vice Head, Member) — admin only
router.post('/', adminOnly, async (req, res) => {
    try {
        const { name, establishedDate } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Team name is required' });
        }

        const newTeam = await prisma.$transaction(async (tx) => {
            const team = await tx.team.create({
                data: {
                    name: name.trim(),
                    establishedDate: establishedDate ? new Date(establishedDate) : undefined
                }
            });

            // Create the 3 default system roles in the same transaction (so they always exist for a new team)
            for (const r of DEFAULT_TEAM_ROLES) {
                await tx.teamRole.create({
                    data: {
                        teamId: team.id,
                        roleName: r.roleName,
                        roleType: r.roleType,
                        maxCount: r.maxCount,
                        systemRoleKey: r.systemRoleKey
                    }
                });
            }

            return tx.team.findUnique({
                where: { id: team.id },
                include: { roles: true }
            });
        });

        res.status(201).json(newTeam);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Team name already exists'
            });
        }

        res.status(500).json({ error: 'Failed to create team' });
    }
});

// PUT /api/teams/:id - Update team information — admin only
router.put('/:id', adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, establishedDate, isActive } = req.body;

        console.log('Updating team:', id);
        console.log('Request body:', req.body);

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (establishedDate !== undefined) updateData.establishedDate = new Date(establishedDate);
        if (isActive !== undefined) updateData.isActive = isActive;

        console.log('Update data:', updateData);

        const updatedTeam = await prisma.team.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json(updatedTeam);
    } catch (error) {
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Team not found' });
        }

        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Team name already exists' });
        }

        res.status(500).json({
            error: 'Failed to update team',
            details: error.message  // Add this for debugging
        });
    }
});

// PATCH /api/teams/:id/deactivate - Deactivate team and delete its member assignments (history preserved in MemberRoleHistory/Alumni) — admin only
router.patch('/:id/deactivate', adminOnly, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: 'Invalid team id' });
        }

        const memberIdsInTeam = await prisma.teamMember.findMany({
            where: { teamId: id },
            select: { memberId: true },
            distinct: ['memberId']
        }).then((rows) => rows.map((r) => r.memberId));

        await prisma.$transaction([
            prisma.team.update({
                where: { id },
                data: { isActive: false }
            }),
            prisma.teamMember.deleteMany({
                where: { teamId: id }
            })
        ]);

        // Members who had only this team and are not alumni → UNASSIGNED
        if (memberIdsInTeam.length > 0) {
            const [withActive, alumniIds] = await Promise.all([
                prisma.teamMember.findMany({
                    where: { memberId: { in: memberIdsInTeam } },
                    select: { memberId: true },
                    distinct: ['memberId']
                }).then((rows) => rows.map((r) => r.memberId)),
                prisma.alumni.findMany({
                    where: { memberId: { in: memberIdsInTeam } },
                    select: { memberId: true },
                    distinct: ['memberId']
                }).then((rows) => rows.map((r) => r.memberId))
            ]);
            const setUnassigned = memberIdsInTeam.filter(
                (mid) => !withActive.includes(mid) && !alumniIds.includes(mid)
            );
            if (setUnassigned.length > 0) {
                await prisma.member.updateMany({
                    where: { id: { in: setUnassigned } },
                    data: { assignmentStatus: 'UNASSIGNED' }
                });
            }
        }

        const deactivatedTeam = await prisma.team.findUnique({
            where: { id },
            include: { _count: { select: { members: true } } }
        });

        res.json({
            message: 'Team deactivated successfully. Member assignments for this team have been removed (history is preserved in role history).',
            team: deactivatedTeam
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to deactivate team' });
    }
});

// PATCH /api/teams/:id/activate - Activate team — admin only
router.patch('/:id/activate', adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const activatedTeam = await prisma.team.update({
            where: { id: parseInt(id) },
            data: { isActive: true }
        });

        res.json({
            message: 'Team activated successfully',
            team: activatedTeam
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to activate team' });
    }
});

// No DELETE - teams are only deactivated via PATCH /:id/deactivate

module.exports = router;