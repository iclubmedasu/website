const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

const ADMINISTRATION_TEAM_NAME = 'Administration';
const ADMINISTRATION_ROLE_NAMES = ['Officer', 'President', 'Vice President']; // hierarchy: Officer first (highest), then President, then Vice President (lowest)

/** Get or create the Administration team with 3 roles: Officer, President, Vice President. */
async function getOrCreateAdministrationTeam() {
    let team = await prisma.team.findFirst({
        where: { name: ADMINISTRATION_TEAM_NAME },
        include: {
            roles: { where: { isActive: true } },
            members: {
                where: { isActive: true },
                include: { member: true, role: true }
            }
        }
    });

    if (!team) {
        team = await prisma.$transaction(async (tx) => {
            const t = await tx.team.create({
                data: { name: ADMINISTRATION_TEAM_NAME }
            });
            for (const name of ADMINISTRATION_ROLE_NAMES) {
                await tx.teamRole.create({
                    data: { teamId: t.id, roleName: name, roleType: 'Leadership' }
                });
            }
            return tx.team.findUnique({
                where: { id: t.id },
                include: {
                    roles: { where: { isActive: true } },
                    members: {
                        where: { isActive: true },
                        include: { member: true, role: true }
                    }
                }
            });
        });
    } else {
        // Ensure all 3 roles exist (team may have been created with different roles)
        for (const name of ADMINISTRATION_ROLE_NAMES) {
            const existing = await prisma.teamRole.findFirst({
                where: { teamId: team.id, roleName: name }
            });
            if (!existing) {
                await prisma.teamRole.create({
                    data: { teamId: team.id, roleName: name, roleType: 'Leadership' }
                });
            }
        }
        // Refetch with roles and members
        team = await prisma.team.findUnique({
            where: { id: team.id },
            include: {
                roles: { where: { isActive: true } },
                members: {
                    where: { isActive: true },
                    include: { member: true, role: true }
                }
            }
        });
    }

    return team;
}

// GET /api/administration/team - Get the Administration team with roles and members (get-or-create with Officer, President, Vice President roles)
router.get('/team', async (req, res) => {
    try {
        const team = await getOrCreateAdministrationTeam();
        if (!team) {
            return res.status(500).json({ error: 'Failed to load Administration team' });
        }
        res.json(team);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch Administration team' });
    }
});

module.exports = router;
