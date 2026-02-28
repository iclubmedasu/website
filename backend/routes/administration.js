const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

const ADMINISTRATION_TEAM_NAME = 'Administration';
const ADMINISTRATION_ROLE_NAMES = ['Officer', 'President', 'Vice President']; // hierarchy: Officer first (highest), then President, then Vice President (lowest)

// Official @med.asu.edu.eg email regex
const OFFICIAL_EMAIL_REGEX = /^[^\s@]+@med\.asu\.edu\.eg$/i;

// Detect if a string looks like a phone number
function looksLikePhone(value) {
    if (!value || typeof value !== 'string') return false;
    const stripped = value.replace(/\s/g, '');
    return /^[+\d][\d\s\-().]{6,}$/.test(stripped) && !stripped.includes('@');
}

// Phone normalization (same as auth.js)
function normalizePhone(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
        cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
    } else {
        cleaned = cleaned.replace(/\+/g, '');
    }
    const digits = cleaned.replace(/\+/g, '');
    if (cleaned.startsWith('+20')) return cleaned;
    if (!cleaned.startsWith('+') && digits.startsWith('20') && digits.length === 12) return '+' + digits;
    if (digits.startsWith('0') && digits.length === 11) return '+20' + digits.slice(1);
    if (digits.startsWith('1') && digits.length === 10) return '+20' + digits;
    return cleaned.startsWith('+') ? cleaned : cleaned;
}

const PLACEHOLDER_FULLNAME = 'Pending';

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

// POST /api/administration/officer — Create a placeholder officer member (Task 1.2)
// Accepts { identifier } — either a @med.asu.edu.eg email or a phone number.
router.post('/officer', async (req, res) => {
    try {
        const identifier = (req.body.identifier ?? '').toString().trim();
        if (!identifier) {
            return res.status(400).json({ error: 'Identifier (email or phone) is required.' });
        }

        const isEmail = identifier.includes('@');
        const isPhone = looksLikePhone(identifier);

        if (!isEmail && !isPhone) {
            return res.status(400).json({ error: 'Please enter a valid @med.asu.edu.eg email or phone number.' });
        }

        if (isEmail && !OFFICIAL_EMAIL_REGEX.test(identifier)) {
            return res.status(400).json({ error: 'Email must be an official @med.asu.edu.eg address.' });
        }

        // Normalize phone if applicable
        const normalizedPhone = isPhone ? normalizePhone(identifier) : null;
        const officerEmail = isEmail ? identifier : `pending-officer-${Date.now()}@med.asu.edu.eg`;
        const officerPhone = isPhone ? normalizedPhone : `pending-${Date.now()}`;

        // Check for duplicates across all email and phone fields
        const duplicateConditions = [];
        if (isEmail) {
            duplicateConditions.push({ email: identifier }, { email2: identifier }, { email3: identifier });
        }
        if (isPhone) {
            duplicateConditions.push({ phoneNumber: normalizedPhone }, { phoneNumber2: normalizedPhone });
        }

        if (duplicateConditions.length > 0) {
            const existing = await prisma.member.findFirst({
                where: { OR: duplicateConditions }
            });
            if (existing) {
                return res.status(400).json({ error: 'A member with this email or phone number already exists.' });
            }
        }

        const newMember = await prisma.member.create({
            data: {
                fullName: PLACEHOLDER_FULLNAME,
                email: officerEmail,
                phoneNumber: officerPhone,
                studentId: null,
            }
        });

        res.status(201).json(newMember);
    } catch (error) {
        console.error('Create officer error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email or phone number already exists.' });
        }
        res.status(500).json({ error: 'Failed to create officer member' });
    }
});

module.exports = router;
