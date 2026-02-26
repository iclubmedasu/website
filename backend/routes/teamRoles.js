const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

// ============================================
// TEAM ROLE ENDPOINTS
// ============================================

// GET /api/team-roles - Get all roles (optionally filter by team)
router.get('/', async (req, res) => {
    try {
        const { teamId, isActive } = req.query;

        const where = {};
        if (teamId) where.teamId = parseInt(teamId);
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const roles = await prisma.teamRole.findMany({
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

        res.json(roles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch team roles' });
    }
});

// GET /api/team-roles/:id - Get single role with details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const role = await prisma.teamRole.findUnique({
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

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json(role);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch role' });
    }
});

// POST /api/team-roles - Create new role for a team
router.post('/', async (req, res) => {
    try {
        const { teamId, roleName, maxCount, roleType } = req.body;

        // Validate team exists
        const team = await prisma.team.findUnique({
            where: { id: parseInt(teamId) }
        });

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Leadership roles always have maxCount 1; other types use provided maxCount
        const isLeadership = (roleType || 'Member') === 'Leadership';
        const newRole = await prisma.teamRole.create({
            data: {
                teamId: parseInt(teamId),
                roleName,
                roleType: roleType || 'Regular',
                maxCount: isLeadership ? 1 : (maxCount ? parseInt(maxCount) : null)
            },
            include: {
                team: true
            }
        });

        res.status(201).json(newRole);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Role name already exists in this team'
            });
        }

        res.status(500).json({ error: 'Failed to create role' });
    }
});

// PUT /api/team-roles/:id - Update role information
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { roleName, maxCount, roleType, isActive } = req.body;

        const updateData = {};
        if (roleName !== undefined) updateData.roleName = roleName;
        if (roleType !== undefined) updateData.roleType = roleType;
        // Leadership always maxCount 1; otherwise use provided value
        if (roleType === 'Leadership') {
            updateData.maxCount = 1;
        } else if (maxCount !== undefined) {
            updateData.maxCount = maxCount ? parseInt(maxCount) : null;
        }
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedRole = await prisma.teamRole.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                team: true
            }
        });

        res.json(updatedRole);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Role not found' });
        }

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Role name already exists in this team'
            });
        }

        res.status(500).json({ error: 'Failed to update role' });
    }
});

// PATCH /api/team-roles/:id/deactivate - Deactivate role; members are moved to a fallback role
// System roles (systemRoleKey 1, 2, 3: Head of Team, Vice Head of Team, Member) cannot be deactivated.
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: 'Invalid role id' });
        }

        const role = await prisma.teamRole.findUnique({
            where: { id },
            include: { team: true }
        });
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }
        if (role.systemRoleKey != null) {
            return res.status(400).json({
                error: 'This is a default team role (Head of Team, Vice Head of Team, or Member) and cannot be deactivated.'
            });
        }

        const teamId = role.teamId;
        // Move members to the default "Member" role (systemRoleKey 3) for this team
        const memberRole = await prisma.teamRole.findFirst({
            where: {
                teamId,
                systemRoleKey: 3,
                isActive: true
            }
        });

        if (!memberRole) {
            return res.status(400).json({
                error: 'This team has no default "Member" role (system role). Cannot deactivate this role.'
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.teamRole.update({
                where: { id },
                data: { isActive: false }
            });
            await tx.teamMember.updateMany({
                where: { roleId: id },
                data: { roleId: memberRole.id }
            });
        });

        const deactivatedRole = await prisma.teamRole.findUnique({
            where: { id },
            include: { team: true }
        });

        res.json({
            message: 'Role deactivated. Members holding this role were moved to the default "Member" role; they remain in the team.',
            role: deactivatedRole
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to deactivate role' });
    }
});

// PATCH /api/team-roles/:id/activate - Activate role
router.patch('/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;

        const activatedRole = await prisma.teamRole.update({
            where: { id: parseInt(id) },
            data: { isActive: true }
        });

        res.json({
            message: 'Role activated successfully',
            role: activatedRole
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to activate role' });
    }
});

// No DELETE - roles are only deactivated via PATCH /:id/deactivate

module.exports = router;