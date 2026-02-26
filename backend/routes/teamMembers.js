const express = require('express');
const router = express.Router();
const { prisma } = require('../db'); // Change from '../server' to '../prisma'

// ============================================
// TEAM MEMBER ASSIGNMENT ENDPOINTS
// ============================================

// GET /api/team-members - Get all team member assignments
router.get('/', async (req, res) => {
    try {
        const { teamId, memberId, isActive } = req.query;

        const where = {};
        if (teamId) where.teamId = parseInt(teamId);
        if (memberId) where.memberId = parseInt(memberId);
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const assignments = await prisma.teamMember.findMany({
            where,
            include: {
                team: true,
                member: true,
                role: true,
                subteam: true
            },
            orderBy: { joinedDate: 'desc' }
        });

        res.json(assignments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch team member assignments' });
    }
});

// GET /api/team-members/:id - Get single assignment
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const assignment = await prisma.teamMember.findUnique({
            where: { id: parseInt(id) },
            include: {
                team: true,
                member: true,
                role: true,
                subteam: true
            }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        res.json(assignment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch assignment' });
    }
});

// POST /api/team-members/assign - Assign member to team with role
router.post('/assign', async (req, res) => {
    try {
        const { memberId, teamId, roleId, changeType, changeReason, notes } = req.body;

        // Validate inputs exist
        const [member, team, role] = await Promise.all([
            prisma.member.findUnique({ where: { id: parseInt(memberId) } }),
            prisma.team.findUnique({ where: { id: parseInt(teamId) } }),
            prisma.teamRole.findUnique({ where: { id: parseInt(roleId) } })
        ]);

        if (!member) return res.status(404).json({ error: 'Member not found' });
        if (!team) return res.status(404).json({ error: 'Team not found' });
        if (!role) return res.status(404).json({ error: 'Role not found' });

        // Check if role belongs to the team
        if (role.teamId !== parseInt(teamId)) {
            return res.status(400).json({ error: 'Role does not belong to this team' });
        }

        const memberIdInt = parseInt(memberId);
        const teamIdInt = parseInt(teamId);
        const roleIdInt = parseInt(roleId);

        // Use transaction: create or reactivate assignment (team may have been deactivated then reactivated), clean up other inactive rows, update member tag
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.teamMember.findUnique({
                where: { teamId_memberId: { teamId: teamIdInt, memberId: memberIdInt } },
                include: { team: true, member: true, role: true }
            });

            let assignment;
            if (existing) {
                if (existing.isActive) {
                    throw Object.assign(new Error('Member is already assigned to this team'), { code: 'ALREADY_ACTIVE' });
                }
                assignment = await tx.teamMember.update({
                    where: { id: existing.id },
                    data: {
                        roleId: roleIdInt,
                        isActive: true,
                        leftDate: null
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true
                    }
                });
            } else {
                assignment = await tx.teamMember.create({
                    data: {
                        memberId: memberIdInt,
                        teamId: teamIdInt,
                        roleId: roleIdInt
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true
                    }
                });
            }

            // Remove any other inactive TeamMember rows for this member (e.g. from another deactivated team) so they don't appear as duplicate/inactive
            await tx.teamMember.deleteMany({
                where: {
                    memberId: memberIdInt,
                    isActive: false,
                    id: { not: assignment.id }
                }
            });

            const historyChangeType = (changeType && typeof changeType === 'string' && changeType.trim())
                ? changeType.trim()
                : (existing && !existing.isActive ? 'Reactivation' : 'New');
            const historyChangeReason = changeReason || (existing && !existing.isActive ? 'Team reactivated' : 'Initial assignment');

            const historyEntry = await tx.memberRoleHistory.create({
                data: {
                    memberId: memberIdInt,
                    teamId: teamIdInt,
                    roleId: roleIdInt,
                    changeType: historyChangeType,
                    changeReason: historyChangeReason,
                    notes
                }
            });

            await tx.member.update({
                where: { id: memberIdInt },
                data: { assignmentStatus: 'ASSIGNED' }
            });

            return { assignment, historyEntry };
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Member is already assigned to this team'
            });
        }
        if (error.code === 'ALREADY_ACTIVE') {
            return res.status(400).json({
                error: 'Member is already assigned to this team'
            });
        }

        res.status(500).json({ error: 'Failed to assign member to team' });
    }
});

// PATCH /api/team-members/:id/change-role - Change member's role (and optional subteam) in team
router.patch('/:id/change-role', async (req, res) => {
    try {
        const { id } = req.params;
        const { newRoleId, newSubteamId, changeType, changeReason, notes } = req.body;

        // Get current assignment
        const currentAssignment = await prisma.teamMember.findUnique({
            where: { id: parseInt(id) },
            include: { role: true }
        });

        if (!currentAssignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Validate new role exists and belongs to same team
        const newRole = await prisma.teamRole.findUnique({
            where: { id: parseInt(newRoleId) }
        });

        if (!newRole) {
            return res.status(404).json({ error: 'New role not found' });
        }

        if (newRole.teamId !== currentAssignment.teamId) {
            return res.status(400).json({
                error: 'New role must belong to the same team'
            });
        }

        // Validate new subteam if provided (must belong to same team)
        let subteamIdValue = null;
        if (newSubteamId != null && newSubteamId !== '') {
            const subteamIdInt = parseInt(newSubteamId);
            if (!Number.isNaN(subteamIdInt)) {
                const subteam = await prisma.subteam.findUnique({
                    where: { id: subteamIdInt }
                });
                if (!subteam) {
                    return res.status(404).json({ error: 'Subteam not found' });
                }
                if (subteam.teamId !== currentAssignment.teamId) {
                    return res.status(400).json({
                        error: 'Subteam must belong to the same team'
                    });
                }
                subteamIdValue = subteamIdInt;
            }
        }

        // Use transaction to update assignment and create history
        const result = await prisma.$transaction(async (tx) => {
            // Close current role history entry
            await tx.memberRoleHistory.updateMany({
                where: {
                    memberId: currentAssignment.memberId,
                    teamId: currentAssignment.teamId,
                    isActive: true
                },
                data: {
                    endDate: new Date(),
                    isActive: false
                }
            });

            // Update team member assignment (role and optional subteam)
            const updatedAssignment = await tx.teamMember.update({
                where: { id: parseInt(id) },
                data: {
                    roleId: parseInt(newRoleId),
                    subteamId: subteamIdValue
                },
                include: {
                    team: true,
                    member: true,
                    role: true,
                    subteam: true
                }
            });

            // Create new role history entry
            const historyEntry = await tx.memberRoleHistory.create({
                data: {
                    memberId: currentAssignment.memberId,
                    teamId: currentAssignment.teamId,
                    roleId: parseInt(newRoleId),
                    subteamId: subteamIdValue,
                    changeType: changeType || 'Promotion',
                    changeReason,
                    notes
                }
            });

            return { updatedAssignment, historyEntry };
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to change role' });
    }
});

// PATCH /api/team-members/:id/transfer - Transfer member to different team
router.patch('/:id/transfer', async (req, res) => {
    try {
        const { id } = req.params;
        const { newTeamId, newRoleId, newSubteamId, changeReason, notes, changeType } = req.body;

        // Get current assignment
        const currentAssignment = await prisma.teamMember.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentAssignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Validate new team and role
        const [newTeam, newRole] = await Promise.all([
            prisma.team.findUnique({ where: { id: parseInt(newTeamId) } }),
            prisma.teamRole.findUnique({ where: { id: parseInt(newRoleId) } })
        ]);

        if (!newTeam) return res.status(404).json({ error: 'New team not found' });
        if (!newRole) return res.status(404).json({ error: 'New role not found' });

        if (newRole.teamId !== parseInt(newTeamId)) {
            return res.status(400).json({
                error: 'Role does not belong to the new team'
            });
        }

        // Validate new subteam if provided (must belong to new team)
        let subteamIdValue = null;
        if (newSubteamId != null && newSubteamId !== '') {
            const subteamIdInt = parseInt(newSubteamId);
            if (!Number.isNaN(subteamIdInt)) {
                const subteam = await prisma.subteam.findUnique({
                    where: { id: subteamIdInt }
                });
                if (!subteam) {
                    return res.status(404).json({ error: 'Subteam not found' });
                }
                if (subteam.teamId !== parseInt(newTeamId)) {
                    return res.status(400).json({
                        error: 'Subteam must belong to the new team'
                    });
                }
                subteamIdValue = subteamIdInt;
            }
        }

        // Determine change type - use provided changeType or default to 'Transfer'
        const finalChangeType = changeType || 'Transfer';

        const memberId = currentAssignment.memberId;
        const newTeamIdInt = parseInt(newTeamId);
        const newRoleIdInt = parseInt(newRoleId);

        // Use transaction: close old team history, remove current assignment, then either update existing or create new row for target team
        const result = await prisma.$transaction(async (tx) => {
            // Close current role history for the old team (keeps timeline in MemberRoleHistory)
            await tx.memberRoleHistory.updateMany({
                where: {
                    memberId,
                    teamId: currentAssignment.teamId,
                    isActive: true
                },
                data: {
                    endDate: new Date(),
                    isActive: false
                }
            });

            // Delete current assignment (member is leaving this team)
            await tx.teamMember.delete({
                where: { id: parseInt(id) }
            });

            // Target team allows only one row per (teamId, memberId). If an old inactive row exists (e.g. from a previous transfer back), update it; otherwise create.
            const existingInTarget = await tx.teamMember.findUnique({
                where: {
                    teamId_memberId: { teamId: newTeamIdInt, memberId }
                }
            });

            let newAssignment;
            if (existingInTarget) {
                // Reactivate and update the existing row (e.g. transfer back to original team)
                newAssignment = await tx.teamMember.update({
                    where: { id: existingInTarget.id },
                    data: {
                        roleId: newRoleIdInt,
                        subteamId: subteamIdValue,
                        isActive: true,
                        leftDate: null
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true,
                        subteam: true
                    }
                });
            } else {
                newAssignment = await tx.teamMember.create({
                    data: {
                        memberId,
                        teamId: newTeamIdInt,
                        roleId: newRoleIdInt,
                        subteamId: subteamIdValue
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true,
                        subteam: true
                    }
                });
            }

            // Create new role history for the target team
            const historyEntry = await tx.memberRoleHistory.create({
                data: {
                    memberId,
                    teamId: newTeamIdInt,
                    roleId: newRoleIdInt,
                    subteamId: subteamIdValue,
                    changeType: finalChangeType,
                    changeReason,
                    notes
                }
            });

            return { newAssignment, historyEntry };
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to transfer member' });
    }
});

// PATCH /api/team-members/:id/status - Update assignment status (active/inactive) only
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, changeType, changeReason, notes } = req.body;

        const assignment = await prisma.teamMember.findUnique({
            where: { id: parseInt(id) },
            include: { team: true, member: true, role: true }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive must be true or false' });
        }

        const result = await prisma.$transaction(async (tx) => {
            if (isActive) {
                // Reactivate: clear leftDate, set isActive true
                const updated = await tx.teamMember.update({
                    where: { id: parseInt(id) },
                    data: { isActive: true, leftDate: null },
                    include: { team: true, member: true, role: true, subteam: true }
                });
                await tx.member.update({
                    where: { id: assignment.memberId },
                    data: { assignmentStatus: 'ASSIGNED' }
                });
                return { updatedAssignment: updated };
            } else {
                // Leave the club: record in history, create Alumni row, then remove from team (delete TeamMember)
                const leftDate = new Date();
                await tx.memberRoleHistory.updateMany({
                    where: {
                        memberId: assignment.memberId,
                        teamId: assignment.teamId,
                        isActive: true
                    },
                    data: { endDate: leftDate, isActive: false }
                });
                const validDeactivateTypes = ['Promotion', 'Demotion', 'Resignation', 'Expulsion', 'Expelled', 'Graduation', 'Graduated', 'Retirement'];
                const historyChangeType = changeType && validDeactivateTypes.includes(changeType) ? changeType : 'Resignation';
                await tx.memberRoleHistory.create({
                    data: {
                        memberId: assignment.memberId,
                        teamId: assignment.teamId,
                        roleId: assignment.roleId,
                        subteamId: assignment.subteamId,
                        changeType: historyChangeType,
                        changeReason: changeReason || 'Status change',
                        notes,
                        isActive: false,
                        endDate: leftDate
                    }
                });
                // Record in Alumni table (who left, from where, and why) so they appear on Alumni page and are no longer "assigned" to any team
                await tx.alumni.create({
                    data: {
                        memberId: assignment.memberId,
                        teamId: assignment.teamId,
                        roleId: assignment.roleId,
                        subteamId: assignment.subteamId,
                        leaveType: historyChangeType,
                        leftDate,
                        changeReason: changeReason || null,
                        notes: notes || null
                    }
                });
                // Remove the team assignment so the member is no longer in any team
                await tx.teamMember.delete({
                    where: { id: parseInt(id) }
                });
                // Explicit tag: member left the club (Alumni)
                await tx.member.update({
                    where: { id: assignment.memberId },
                    data: { assignmentStatus: 'ALUMNI' }
                });
                return { updatedAssignment: null, left: true };
            }
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update assignment status' });
    }
});

// PATCH /api/team-members/:id/remove - Remove member from team
router.patch('/:id/remove', async (req, res) => {
    try {
        const { id } = req.params;
        const { changeType, changeReason, notes } = req.body;

        // Validate changeType
        const validTypes = ['Resignation', 'Expelled', 'Graduated'];
        if (!validTypes.includes(changeType)) {
            return res.status(400).json({
                error: `changeType must be one of: ${validTypes.join(', ')}`
            });
        }

        const assignment = await prisma.teamMember.findUnique({
            where: { id: parseInt(id) }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Use transaction to deactivate and update history
        const result = await prisma.$transaction(async (tx) => {
            // Close current role history
            await tx.memberRoleHistory.updateMany({
                where: {
                    memberId: assignment.memberId,
                    teamId: assignment.teamId,
                    isActive: true
                },
                data: {
                    endDate: new Date(),
                    isActive: false
                }
            });

            // Update assignment to inactive
            const updatedAssignment = await tx.teamMember.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    leftDate: new Date()
                },
                include: {
                    team: true,
                    member: true,
                    role: true
                }
            });

            // Create history entry for removal
            const historyEntry = await tx.memberRoleHistory.create({
                data: {
                    memberId: assignment.memberId,
                    teamId: assignment.teamId,
                    roleId: assignment.roleId,
                    changeType,
                    changeReason,
                    notes,
                    isActive: false,
                    endDate: new Date()
                }
            });

            return { updatedAssignment, historyEntry };
        });

        // If member now has no active assignment and is not alumni, mark as UNASSIGNED
        const [hasActive, inAlumni] = await Promise.all([
            prisma.teamMember.count({ where: { memberId: assignment.memberId, isActive: true } }),
            prisma.alumni.count({ where: { memberId: assignment.memberId } })
        ]);
        if (hasActive === 0 && inAlumni === 0) {
            await prisma.member.update({
                where: { id: assignment.memberId },
                data: { assignmentStatus: 'UNASSIGNED' }
            });
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove member from team' });
    }
});

module.exports = router;