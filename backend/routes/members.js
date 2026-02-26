const express = require('express');
const router = express.Router();
const { prisma } = require('../db'); // Change from '../server' to '../prisma'

// ============================================
// MEMBER ENDPOINTS
// ============================================

// GET /api/members - Get all members (optionally only "unassigned": in club but no active team and not alumni)
router.get('/', async (req, res) => {
    try {
        const { isActive, unassignedOnly } = req.query;
        const wantUnassignedOnly = unassignedOnly === 'true' || unassignedOnly === true || String(unassignedOnly).toLowerCase() === 'true';

        const where = {};
        if (isActive !== undefined) where.isActive = isActive === 'true';

        if (wantUnassignedOnly) {
            // Use explicit tag: only members with assignmentStatus = 'UNASSIGNED'
            where.assignmentStatus = 'UNASSIGNED';
        }

        const members = await prisma.member.findMany({
            where,
            include: {
                teamMemberships: {
                    where: { isActive: true },
                    include: {
                        team: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(members);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// GET /api/members/:id - Get single member with full details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const member = await prisma.member.findUnique({
            where: { id: parseInt(id) },
            include: {
                teamMemberships: {
                    include: {
                        team: true,
                        role: true
                    }
                },
                roleHistory: {
                    include: {
                        team: true,
                        role: true
                    },
                    orderBy: { startDate: 'desc' }
                }
            }
        });

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        res.json(member);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch member' });
    }
});

// Official email: studentId@med.asu.edu.eg (auto-generated, not editable by user)
const OFFICIAL_EMAIL_DOMAIN = '@med.asu.edu.eg';
const officialEmail = (studentId) => `${studentId}${OFFICIAL_EMAIL_DOMAIN}`;

// Placeholder values for members added with only student ID (to be completed when they sign in)
const PLACEHOLDER_FULLNAME = 'Pending';
const placeholderPhone = (studentId) => `pending-${studentId}`;

// POST /api/members - Create new member. Only studentId is required. Primary email = studentId@med.asu.edu.eg (auto).
router.post('/', async (req, res) => {
    try {
        const {
            fullName,
            phoneNumber,
            phoneNumber2,
            studentId,
            profilePhotoUrl,
            linkedInUrl,
            joinDate,
            email2,
            email3
        } = req.body;

        if (studentId === undefined || studentId === null || studentId === '') {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        const sid = parseInt(studentId, 10);
        if (Number.isNaN(sid)) {
            return res.status(400).json({ error: 'Student ID must be a number' });
        }

        const usePlaceholders = !fullName?.trim() || !phoneNumber?.trim();
        const finalFullName = usePlaceholders ? PLACEHOLDER_FULLNAME : fullName.trim();
        const finalPhone = usePlaceholders ? placeholderPhone(sid) : phoneNumber.trim();
        const primaryEmail = officialEmail(sid);

        const data = {
            fullName: finalFullName,
            email: primaryEmail,
            phoneNumber: finalPhone,
            studentId: sid,
            profilePhotoUrl: profilePhotoUrl?.trim() || null,
            linkedInUrl: linkedInUrl?.trim() || null,
            joinDate: joinDate ? new Date(joinDate) : undefined
        };
        if (email2?.trim()) data.email2 = email2.trim();
        if (email3?.trim()) data.email3 = email3.trim();
        if (phoneNumber2?.trim()) data.phoneNumber2 = phoneNumber2.trim();

        const newMember = await prisma.member.create({ data });

        res.status(201).json(newMember);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Email, phone number, or student ID already exists'
            });
        }

        res.status(500).json({ error: 'Failed to create member' });
    }
});

// Helper: check if requester is admin (developer or in Administration team)
async function isAdminRequester(req) {
    if (req.user.isDeveloper) return true;
    if (!req.user.memberId) return false;
    const adminMembership = await prisma.teamMember.findFirst({
        where: {
            memberId: req.user.memberId,
            isActive: true,
            team: { name: 'Administration' }
        }
    });
    return !!adminMembership;
}

// PUT /api/members/:id - Update member information
// Self-update (req.user.memberId === id): only fullName, email, phoneNumber, profilePhotoUrl, linkedInUrl; studentId cannot be changed
// Admin update: same allowed fields; email/phone must be unique (excluding this member)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const memberId = parseInt(id, 10);
        if (Number.isNaN(memberId)) {
            return res.status(400).json({ error: 'Invalid member ID' });
        }

        const isSelf = req.user.memberId === memberId;
        const isAdmin = await isAdminRequester(req);

        if (!isSelf && !isAdmin) {
            return res.status(403).json({ error: 'You can only update your own profile' });
        }

        const updateData = { ...req.body };

        // Never allow updating studentId via this endpoint
        delete updateData.studentId;
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.updatedAt;
        delete updateData.teamMemberships;
        delete updateData.roleHistory;
        delete updateData.joinDate;
        delete updateData.assignmentStatus;

        if (isSelf) {
            // Self-update: primary email is NOT editable (official = studentId@med.asu.edu.eg)
            const allowed = ['fullName', 'phoneNumber', 'phoneNumber2', 'profilePhotoUrl', 'linkedInUrl', 'email2', 'email3'];
            Object.keys(updateData).forEach((key) => {
                if (!allowed.includes(key)) delete updateData[key];
            });
            delete updateData.email;
        }

        if (Object.keys(updateData).length === 0) {
            const member = await prisma.member.findUnique({ where: { id: memberId } });
            if (!member) return res.status(404).json({ error: 'Member not found' });
            return res.json(member);
        }

        // Validate email2 uniqueness (excluding this member; allow null/empty to clear)
        if (updateData.email2 !== undefined) {
            const val = typeof updateData.email2 === 'string' ? updateData.email2.trim() : '';
            updateData.email2 = val || null;
            if (val) {
                const existing = await prisma.member.findFirst({
                    where: { email2: val, id: { not: memberId } }
                });
                if (existing) {
                    return res.status(400).json({ error: 'Email 2 is already taken' });
                }
            }
        }

        // Validate email3 uniqueness (excluding this member; allow null/empty to clear)
        if (updateData.email3 !== undefined) {
            const val = typeof updateData.email3 === 'string' ? updateData.email3.trim() : '';
            updateData.email3 = val || null;
            if (val) {
                const existing = await prisma.member.findFirst({
                    where: { email3: val, id: { not: memberId } }
                });
                if (existing) {
                    return res.status(400).json({ error: 'Email 3 is already taken' });
                }
            }
        }

        // Validate phone number uniqueness (excluding this member)
        if (updateData.phoneNumber !== undefined) {
            const phone = typeof updateData.phoneNumber === 'string' ? updateData.phoneNumber.trim() : '';
            if (!phone) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const existingPhone = await prisma.member.findFirst({
                where: { phoneNumber: phone, id: { not: memberId } }
            });
            if (existingPhone) {
                return res.status(400).json({ error: 'Phone number is already taken' });
            }
            updateData.phoneNumber = phone;
        }

        // Validate phoneNumber2 uniqueness (excluding this member; allow null/empty to clear)
        if (updateData.phoneNumber2 !== undefined) {
            const phone2 = typeof updateData.phoneNumber2 === 'string' ? updateData.phoneNumber2.trim() : '';
            updateData.phoneNumber2 = phone2 || null;
            if (phone2) {
                const existingPhone2 = await prisma.member.findFirst({
                    where: { OR: [{ phoneNumber: phone2 }, { phoneNumber2: phone2 }], id: { not: memberId } }
                });
                if (existingPhone2) {
                    return res.status(400).json({ error: 'Second phone number is already in use' });
                }
            }
        }

        if (updateData.fullName !== undefined) {
            updateData.fullName = typeof updateData.fullName === 'string' ? updateData.fullName.trim() : '';
            if (updateData.fullName.length < 2) {
                return res.status(400).json({ error: 'Full name must be at least 2 characters' });
            }
        }

        if (updateData.profilePhotoUrl !== undefined) {
            updateData.profilePhotoUrl = updateData.profilePhotoUrl?.trim() || null;
        }
        if (updateData.linkedInUrl !== undefined) {
            updateData.linkedInUrl = updateData.linkedInUrl?.trim() || null;
        }

        const updatedMember = await prisma.member.update({
            where: { id: memberId },
            data: updateData
        });

        res.json(updatedMember);
    } catch (error) {
        console.error(error);

        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({
                error: 'Email or phone number is already in use by another member'
            });
        }

        res.status(500).json({ error: 'Failed to update member' });
    }
});

// PATCH /api/members/:id/deactivate - Soft delete member
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const { id } = req.params;

        const deactivatedMember = await prisma.member.update({
            where: { id: parseInt(id) },
            data: { isActive: false }
        });

        res.json({
            message: 'Member deactivated successfully',
            member: deactivatedMember
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to deactivate member' });
    }
});

// PATCH /api/members/:id/activate - Reactivate member
router.patch('/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;

        const activatedMember = await prisma.member.update({
            where: { id: parseInt(id) },
            data: { isActive: true }
        });

        res.json({
            message: 'Member activated successfully',
            member: activatedMember
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to activate member' });
    }
});

// No DELETE - members are only deactivated via PATCH /:id/deactivate

module.exports = router;