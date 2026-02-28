const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// Title-case utility for names
function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str;
    const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it']);
    const words = str.trim().split(/\s+/);
    return words.map((word, i) => {
        if (word.includes('-')) {
            return word.split('-').map(p => {
                if (p.length > 1 && p === p.toUpperCase()) return p;
                return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
            }).join('-');
        }
        if (word.length > 1 && word === word.toUpperCase()) return word;
        const lower = word.toLowerCase();
        if (i !== 0 && i !== words.length - 1 && SMALL.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
}

// Developer backdoor email
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'dev@iclub.com';
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'dev123456';

// Official email: studentId@med.asu.edu.eg (same as members.js)
const OFFICIAL_EMAIL_DOMAIN = '@med.asu.edu.eg';
const officialEmail = (studentId) => `${studentId}${OFFICIAL_EMAIL_DOMAIN}`;

// Placeholder member (added with only student ID) - can complete profile via Student ID flow
const PLACEHOLDER_FULLNAME = 'Pending';
const isPlaceholderMember = (member) => member.fullName === PLACEHOLDER_FULLNAME;
// Placeholder phone when member created with only studentId (members.js uses pending-{studentId})
const isPlaceholderPhone = (value) => typeof value === 'string' && value.startsWith('pending-');

// Password: at least 8 chars, one upper, one lower, one number, one symbol
function validatePassword(password) {
    if (!password || typeof password !== 'string') return { valid: false, error: 'Password is required' };
    if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter' };
    if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain at least one lowercase letter' };
    if (!/\d/.test(password)) return { valid: false, error: 'Password must contain at least one number' };
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return { valid: false, error: 'Password must contain at least one symbol (e.g. !@#$%^&*)' };
    return { valid: true };
}

// Standard email format: local@domain.tld
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value) {
    return value && typeof value === 'string' && EMAIL_REGEX.test(value.trim());
}

// Official @med.asu.edu.eg email regex
const OFFICIAL_EMAIL_REGEX = /^[^\s@]+@med\.asu\.edu\.eg$/i;

// Detect if a string looks like a phone number (after stripping spaces)
function looksLikePhone(value) {
    if (!value || typeof value !== 'string') return false;
    const stripped = value.replace(/\s/g, '');
    return /^[+\d][\d\s\-().]{6,}$/.test(stripped) && !stripped.includes('@');
}

// Phone normalization utility (Task 3.2)
function normalizePhone(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    let cleaned = raw.replace(/[^\d+]/g, '');
    // Ensure only one leading +
    if (cleaned.startsWith('+')) {
        cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
    } else {
        cleaned = cleaned.replace(/\+/g, '');
    }
    const digits = cleaned.replace(/\+/g, '');
    // Egyptian number handling
    if (cleaned.startsWith('+20')) {
        // Already correct format
        return cleaned;
    }
    if (!cleaned.startsWith('+') && digits.startsWith('20') && digits.length === 12) {
        // e.g. 201012345678 → +201012345678
        return '+' + digits;
    }
    if (digits.startsWith('0') && digits.length === 11) {
        // e.g. 01012345678 → +201012345678
        return '+20' + digits.slice(1);
    }
    if (digits.startsWith('1') && digits.length === 10) {
        // e.g. 1012345678 → +201012345678
        return '+20' + digits;
    }
    // International or other format — return with digits only (or with + if it was there)
    return cleaned.startsWith('+') ? cleaned : cleaned;
}

// Find member by phone number (normalized). Searches phoneNumber and phoneNumber2.
async function findMemberByPhone(phone) {
    if (!phone) return null;
    const normalized = normalizePhone(phone);
    return prisma.member.findFirst({
        where: {
            OR: [
                { phoneNumber: normalized },
                { phoneNumber2: normalized }
            ]
        },
        include: { user: true }
    });
}

// Authority levels: 1=Officer/Developer, 2=President/Vice, 3=Heads/Vice heads, 4=Special roles, 5=Regular
// Compute flags from team memberships (each with team: { name }, role: { roleName, systemRoleKey }).
function computeAuthorityFlags(teamMemberships, isDeveloper = false) {
    const list = teamMemberships || [];
    let isOfficer = isDeveloper;
    let isAdmin = false;
    let isLeadership = false;
    let isSpecial = false;
    for (const tm of list) {
        const teamName = tm.team?.name;
        const roleName = tm.role?.roleName;
        const systemRoleKey = tm.role?.systemRoleKey ?? null;
        const inAdmin = teamName === 'Administration';
        if (inAdmin && roleName === 'Officer') isOfficer = true;
        if (inAdmin && (roleName === 'President' || roleName === 'Vice President')) isAdmin = true;
        // Head (systemRoleKey 1) or Vice Head (2); use Number() so string values from JSON still match
        const keyNum = systemRoleKey != null ? Number(systemRoleKey) : null;
        if (!inAdmin && (keyNum === 1 || keyNum === 2)) isLeadership = true;
        // Fallback: role name indicates leadership even if systemRoleKey missing (e.g. legacy data)
        if (!inAdmin && (roleName === 'Head of Team' || roleName === 'Vice Head of Team')) isLeadership = true;
        if (systemRoleKey === null) isSpecial = true; // Custom/special role (not default Head/Vice/Member)
    }
    return { isOfficer, isAdmin, isLeadership, isSpecial };
}

// Team IDs where the user is Head or Vice Head (non-Administration). Used so leadership can edit their own team.
function getLeadershipTeamIds(teamMemberships) {
    const list = teamMemberships || [];
    const ids = [];
    for (const tm of list) {
        const teamName = tm.team?.name;
        const roleName = tm.role?.roleName;
        const systemRoleKey = tm.role?.systemRoleKey ?? null;
        const inAdmin = teamName === 'Administration';
        const keyNum = systemRoleKey != null ? Number(systemRoleKey) : null;
        const isHeadOrVice = !inAdmin && (keyNum === 1 || keyNum === 2) ||
            !inAdmin && (roleName === 'Head of Team' || roleName === 'Vice Head of Team');
        if (isHeadOrVice) ids.push(tm.teamId);
    }
    return [...new Set(ids)];
}

// Find member by primary email or email2 or email3 (for login / check-email / setup-password)
async function findMemberByEmail(email) {
    if (!email || !email.trim()) return null;
    const trimmed = email.trim();
    return prisma.member.findFirst({
        where: {
            OR: [
                { email: trimmed },
                { email2: trimmed },
                { email3: trimmed }
            ]
        },
        include: { user: true }
    });
}

// Setup password - Member completes registration (email can be primary, email2, or email3)
router.post('/setup-password', async (req, res) => {
    try {
        const { email, password } = req.body;

        const member = await findMemberByEmail(email);

        if (!member) {
            return res.status(404).json({ error: 'Member not found. Please contact admin.' });
        }

        // Check if user already has password set
        if (member.user) {
            return res.status(400).json({ error: 'Password already set. Please login instead.' });
        }

        const pwdCheck = validatePassword(password);
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user account
        const user = await prisma.user.create({
            data: {
                memberId: member.id,
                passwordHash,
                isVerified: true,
                isActive: true
            }
        });

        // Generate token
        const token = jwt.sign(
            { userId: user.id, memberId: member.id, email: member.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, systemRoleKey: true } }
            }
        });
        const teamIds = teamMemberships.map((tm) => tm.teamId);
        const { isOfficer, isAdmin, isLeadership, isSpecial } = computeAuthorityFlags(teamMemberships, false);
        const leadershipTeamIds = getLeadershipTeamIds(teamMemberships);

        res.status(201).json({
            token,
            user: {
                id: member.id,
                email: member.email,
                email2: member.email2 ?? null,
                email3: member.email3 ?? null,
                fullName: member.fullName,
                phoneNumber: member.phoneNumber ?? null,
                phoneNumber2: member.phoneNumber2 ?? null,
                studentId: member.studentId ?? null,
                profilePhotoUrl: member.profilePhotoUrl ?? null,
                linkedInUrl: member.linkedInUrl ?? null,
                teamIds,
                leadershipTeamIds,
                isOfficer: !!isOfficer,
                isAdmin: !!isAdmin,
                isLeadership: !!isLeadership,
                isSpecial: !!isSpecial
            }
        });
    } catch (error) {
        console.error('Setup password error:', error);
        res.status(500).json({ error: 'Failed to setup password' });
    }
});

// Check if email or student ID exists and needs password setup
// Accepts either official email (e.g. 213256@med.asu.edu.eg) or student ID (e.g. 213256) – both identify the same member
router.post('/check-email', async (req, res) => {
    try {
        const input = (req.body.email ?? '').toString().trim();

        // Developer backdoor check
        if (input === DEVELOPER_EMAIL) {
            return res.json({
                exists: true,
                needsSetup: false,
                isDeveloper: true,
                email: DEVELOPER_EMAIL,
                message: 'Developer access. Please enter password.'
            });
        }

        let member = null;

        // If input looks like a student ID (numeric and short), find member by studentId
        if (/^\d+$/.test(input) && input.length <= 8) {
            const sid = parseInt(input, 10);
            if (!Number.isNaN(sid)) {
                member = await prisma.member.findUnique({
                    where: { studentId: sid },
                    include: { user: true }
                });
            }
        }

        // If input contains @, try email lookup
        if (!member && input.includes('@')) {
            member = await findMemberByEmail(input);
        }

        // If input looks like a phone number, try phone lookup
        if (!member && looksLikePhone(input)) {
            member = await findMemberByPhone(input);
        }

        // Fallback: try email lookup for anything not yet matched
        if (!member) {
            member = await findMemberByEmail(input);
        }

        if (!member) {
            return res.json({
                exists: false,
                needsSetup: false,
                message: 'Email or Student ID not found. Please contact admin.'
            });
        }

        const canonicalEmail = member.email;

        if (member.user) {
            return res.json({
                exists: true,
                needsSetup: false,
                email: canonicalEmail,
                studentId: member.studentId ?? null,
                message: 'Account exists. Please login.'
            });
        }

        // Don't pre-fill placeholder values so the form shows empty fields for the user to fill
        const fullName = member.fullName === PLACEHOLDER_FULLNAME ? '' : (member.fullName ?? '');
        const phoneNumber = isPlaceholderPhone(member.phoneNumber) ? '' : (member.phoneNumber ?? '');
        const phoneNumber2 = isPlaceholderPhone(member.phoneNumber2) ? '' : (member.phoneNumber2 ?? '');
        return res.json({
            exists: true,
            needsSetup: true,
            email: canonicalEmail,
            fullName,
            phoneNumber,
            phoneNumber2,
            email2: member.email2 ?? '',
            email3: member.email3 ?? '',
            studentId: member.studentId ?? null,
            memberId: member.id,
            message: 'Please set your password to sign in for the first time.'
        });
    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({ error: 'Failed to check email' });
    }
});

// Update profile for invited member (no password yet): name, phone, optional phone2, email2/email3
router.post('/update-invited-profile', async (req, res) => {
    try {
        const { email, fullName, phoneNumber, phoneNumber2, email2, email3 } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const member = await findMemberByEmail(email.trim());
        if (!member) {
            return res.status(404).json({ error: 'Member not found.' });
        }
        if (member.user) {
            return res.status(400).json({ error: 'Account already set up. Please sign in.' });
        }
        if (!fullName || !fullName.trim()) {
            return res.status(400).json({ error: 'Full name is required' });
        }
        if (!phoneNumber || !phoneNumber.trim()) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        const trimmedEmail2 = email2?.trim() || null;
        const trimmedEmail3 = email3?.trim() || null;
        if (trimmedEmail2 && !isValidEmail(trimmedEmail2)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 2 (e.g. name@domain.com).' });
        }
        if (trimmedEmail3 && !isValidEmail(trimmedEmail3)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 3 (e.g. name@domain.com).' });
        }
        const trimmedPhone2 = phoneNumber2?.trim() || null;
        const existingPhone = await prisma.member.findFirst({
            where: { phoneNumber: phoneNumber.trim(), id: { not: member.id } }
        });
        if (existingPhone) {
            return res.status(400).json({ error: 'This phone number is already in use.' });
        }
        if (trimmedPhone2) {
            const exPhone2 = await prisma.member.findFirst({
                where: { OR: [{ phoneNumber: trimmedPhone2 }, { phoneNumber2: trimmedPhone2 }], id: { not: member.id } }
            });
            if (exPhone2) return res.status(400).json({ error: 'Second phone number is already in use.' });
        }
        if (trimmedEmail2) {
            const ex = await prisma.member.findFirst({
                where: { OR: [{ email: trimmedEmail2 }, { email2: trimmedEmail2 }, { email3: trimmedEmail2 }], id: { not: member.id } }
            });
            if (ex) return res.status(400).json({ error: 'Additional email 2 is already in use.' });
        }
        if (trimmedEmail3) {
            const ex = await prisma.member.findFirst({
                where: { OR: [{ email: trimmedEmail3 }, { email2: trimmedEmail3 }, { email3: trimmedEmail3 }], id: { not: member.id } }
            });
            if (ex) return res.status(400).json({ error: 'Additional email 3 is already in use.' });
        }
        await prisma.member.update({
            where: { id: member.id },
            data: {
                fullName: fullName.trim(),
                phoneNumber: phoneNumber.trim(),
                phoneNumber2: trimmedPhone2,
                email2: trimmedEmail2,
                email3: trimmedEmail3
            }
        });
        return res.status(200).json({ success: true, message: 'Profile updated. Set your password next.' });
    } catch (error) {
        console.error('Update invited profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Check if student ID can set up account (member exists, no user yet, has placeholder data)
router.post('/check-student-id', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (studentId === undefined || studentId === null || studentId === '') {
            return res.status(400).json({ error: 'Student ID is required' });
        }
        const sid = parseInt(studentId, 10);
        if (Number.isNaN(sid)) {
            return res.status(400).json({ error: 'Student ID must be a number' });
        }

        const member = await prisma.member.findUnique({
            where: { studentId: sid },
            include: { user: true }
        });

        if (!member) {
            return res.status(404).json({ error: 'Student ID not found. Contact your administrator.' });
        }

        if (member.user) {
            return res.status(400).json({
                error: 'An account already exists for this Student ID. Sign in with your email instead.'
            });
        }

        if (!isPlaceholderMember(member)) {
            return res.json({
                canSetup: false,
                message: 'Use "Enter your email" to set up your password for this account.'
            });
        }

        return res.json({
            canSetup: true,
            studentId: member.studentId,
            message: 'Complete your profile to create your account.'
        });
    } catch (error) {
        console.error('Check student ID error:', error);
        res.status(500).json({ error: 'Failed to check student ID' });
    }
});

// Complete profile and create account (for placeholder members: fullName, phone, optional phone2, email2/email3, password)
// Primary email stays official (studentId@med.asu.edu.eg)
router.post('/complete-profile', async (req, res) => {
    try {
        const { studentId, fullName, phoneNumber, phoneNumber2, password, email2, email3 } = req.body;

        if (studentId === undefined || studentId === null || studentId === '') {
            return res.status(400).json({ error: 'Student ID is required' });
        }
        const sid = parseInt(studentId, 10);
        if (Number.isNaN(sid)) {
            return res.status(400).json({ error: 'Student ID must be a number' });
        }
        if (!fullName || !fullName.trim()) {
            return res.status(400).json({ error: 'Full name is required' });
        }
        if (!phoneNumber || !phoneNumber.trim()) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        const pwdCheck = validatePassword(password);
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }

        const member = await prisma.member.findUnique({
            where: { studentId: sid },
            include: { user: true }
        });

        if (!member) {
            return res.status(404).json({ error: 'Student ID not found.' });
        }

        if (member.user) {
            return res.status(400).json({ error: 'An account already exists. Sign in with your email.' });
        }

        if (!isPlaceholderMember(member)) {
            return res.status(400).json({ error: 'Use the email flow to set your password.' });
        }

        const trimmedPhone = phoneNumber.trim();
        const trimmedName = toTitleCase(fullName.trim());
        const trimmedEmail2 = email2?.trim() || null;
        const trimmedEmail3 = email3?.trim() || null;

        if (trimmedEmail2 && !isValidEmail(trimmedEmail2)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 2 (e.g. name@domain.com).' });
        }
        if (trimmedEmail3 && !isValidEmail(trimmedEmail3)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 3 (e.g. name@domain.com).' });
        }

        const trimmedPhone2 = phoneNumber2?.trim() || null;
        const existingPhone = await prisma.member.findFirst({
            where: { phoneNumber: trimmedPhone, id: { not: member.id } }
        });
        if (existingPhone) {
            return res.status(400).json({ error: 'This phone number is already in use.' });
        }
        if (trimmedPhone2) {
            const exPhone2 = await prisma.member.findFirst({
                where: { OR: [{ phoneNumber: trimmedPhone2 }, { phoneNumber2: trimmedPhone2 }], id: { not: member.id } }
            });
            if (exPhone2) return res.status(400).json({ error: 'Second phone number is already in use.' });
        }
        if (trimmedEmail2) {
            const ex = await prisma.member.findFirst({
                where: { OR: [{ email: trimmedEmail2 }, { email2: trimmedEmail2 }, { email3: trimmedEmail2 }], id: { not: member.id } }
            });
            if (ex) return res.status(400).json({ error: 'Secondary email is already in use.' });
        }
        if (trimmedEmail3) {
            const ex = await prisma.member.findFirst({
                where: { OR: [{ email: trimmedEmail3 }, { email2: trimmedEmail3 }, { email3: trimmedEmail3 }], id: { not: member.id } }
            });
            if (ex) return res.status(400).json({ error: 'Tertiary email is already in use.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const primaryEmail = officialEmail(sid);

        const [, userRecord] = await prisma.$transaction([
            prisma.member.update({
                where: { id: member.id },
                data: {
                    fullName: trimmedName,
                    phoneNumber: trimmedPhone,
                    phoneNumber2: trimmedPhone2,
                    email2: trimmedEmail2,
                    email3: trimmedEmail3
                }
            }),
            prisma.user.create({
                data: {
                    memberId: member.id,
                    passwordHash,
                    isVerified: true,
                    isActive: true
                }
            })
        ]);

        const token = jwt.sign(
            { userId: userRecord.id, memberId: member.id, email: primaryEmail },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, systemRoleKey: true } }
            }
        });
        const teamIds = teamMemberships.map((tm) => tm.teamId);
        const { isOfficer, isAdmin, isLeadership, isSpecial } = computeAuthorityFlags(teamMemberships, false);
        const leadershipTeamIds = getLeadershipTeamIds(teamMemberships);

        res.status(200).json({
            token,
            user: {
                id: member.id,
                email: primaryEmail,
                email2: trimmedEmail2,
                email3: trimmedEmail3,
                fullName: trimmedName,
                phoneNumber: trimmedPhone,
                phoneNumber2: trimmedPhone2 ?? null,
                studentId: member.studentId ?? null,
                profilePhotoUrl: member.profilePhotoUrl ?? null,
                linkedInUrl: member.linkedInUrl ?? null,
                teamIds,
                leadershipTeamIds,
                isOfficer: !!isOfficer,
                isAdmin: !!isAdmin,
                isLeadership: !!isLeadership,
                isSpecial: !!isSpecial
            }
        });
    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({ error: 'Failed to complete profile' });
    }
});

// Check officer identifier (email or phone) — Task 1.1 step 3
router.post('/check-officer-identifier', async (req, res) => {
    try {
        const identifier = (req.body.identifier ?? '').toString().trim();
        if (!identifier) {
            return res.status(400).json({ valid: false, error: 'Identifier is required' });
        }

        const isEmail = identifier.includes('@');
        const isPhone = looksLikePhone(identifier);

        if (isEmail && !OFFICIAL_EMAIL_REGEX.test(identifier)) {
            return res.json({ valid: false, error: 'Must be an official @med.asu.edu.eg email' });
        }

        if (!isEmail && !isPhone) {
            return res.status(400).json({ valid: false, error: 'Please enter a valid @med.asu.edu.eg email or phone number.' });
        }

        let member = null;
        if (isEmail) {
            member = await findMemberByEmail(identifier);
        } else {
            member = await findMemberByPhone(identifier);
        }

        if (!member) {
            return res.json({ exists: false });
        }

        if (isPlaceholderMember(member) && !member.user) {
            return res.json({
                exists: true,
                needsSetup: true,
                memberId: member.id,
                email: member.email,
                phoneNumber: isPlaceholderPhone(member.phoneNumber) ? '' : member.phoneNumber,
            });
        }

        if (member.user) {
            return res.json({
                exists: true,
                needsSetup: false,
                message: 'Officer already has an account.'
            });
        }

        // Member exists with full profile but no User yet — treat as needs setup
        return res.json({
            exists: true,
            needsSetup: true,
            memberId: member.id,
            email: member.email,
            phoneNumber: isPlaceholderPhone(member.phoneNumber) ? '' : member.phoneNumber,
        });
    } catch (error) {
        console.error('Check officer identifier error:', error);
        res.status(500).json({ error: 'Failed to check officer identifier' });
    }
});

// Complete officer profile — Task 1.1 step 4
router.post('/complete-officer-profile', async (req, res) => {
    try {
        const { identifier, fullName, phoneNumber, phoneNumber2, email2, email3, officerEmail, password, confirmPassword } = req.body;

        if (!identifier || !identifier.trim()) {
            return res.status(400).json({ error: 'Identifier is required' });
        }
        if (!fullName || !fullName.trim()) {
            return res.status(400).json({ error: 'Full name is required' });
        }
        if (!phoneNumber || !phoneNumber.trim()) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const pwdCheck = validatePassword(password);
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const trimmedIdentifier = identifier.trim();
        const isEmail = trimmedIdentifier.includes('@');

        let member = null;
        if (isEmail) {
            member = await findMemberByEmail(trimmedIdentifier);
        } else if (looksLikePhone(trimmedIdentifier)) {
            member = await findMemberByPhone(trimmedIdentifier);
        }

        if (!member) {
            return res.status(404).json({ error: 'Officer not found. Please contact admin.' });
        }

        if (member.user) {
            return res.status(400).json({ error: 'Account already exists. Please sign in.' });
        }

        if (!isPlaceholderMember(member)) {
            return res.status(400).json({ error: 'Profile already completed. Use the email flow to set your password.' });
        }

        const trimmedName = toTitleCase(fullName.trim());
        const trimmedPhone = phoneNumber.trim();
        const trimmedPhone2 = phoneNumber2?.trim() || null;
        const trimmedEmail2 = email2?.trim() || null;
        const trimmedEmail3 = email3?.trim() || null;

        if (trimmedEmail2 && !isValidEmail(trimmedEmail2)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 2.' });
        }
        if (trimmedEmail3 && !isValidEmail(trimmedEmail3)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 3.' });
        }

        // Uniqueness checks
        const existingPhone = await prisma.member.findFirst({
            where: { phoneNumber: trimmedPhone, id: { not: member.id } }
        });
        if (existingPhone) {
            return res.status(400).json({ error: 'This phone number is already in use.' });
        }
        if (trimmedPhone2) {
            const exPhone2 = await prisma.member.findFirst({
                where: { OR: [{ phoneNumber: trimmedPhone2 }, { phoneNumber2: trimmedPhone2 }], id: { not: member.id } }
            });
            if (exPhone2) return res.status(400).json({ error: 'Second phone number is already in use.' });
        }
        if (trimmedEmail2) {
            const ex = await prisma.member.findFirst({
                where: { OR: [{ email: trimmedEmail2 }, { email2: trimmedEmail2 }, { email3: trimmedEmail2 }], id: { not: member.id } }
            });
            if (ex) return res.status(400).json({ error: 'Additional email 2 is already in use.' });
        }
        if (trimmedEmail3) {
            const ex = await prisma.member.findFirst({
                where: { OR: [{ email: trimmedEmail3 }, { email2: trimmedEmail3 }, { email3: trimmedEmail3 }], id: { not: member.id } }
            });
            if (ex) return res.status(400).json({ error: 'Additional email 3 is already in use.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Update member data: also update primary email if officer was created with placeholder email
        const memberUpdateData = {
            fullName: trimmedName,
            phoneNumber: trimmedPhone,
            phoneNumber2: trimmedPhone2,
            email2: trimmedEmail2,
            email3: trimmedEmail3
        };

        // If current email is a placeholder (pending-officer-*), update it with the provided officerEmail
        const currentEmail = member.email || '';
        if (currentEmail.startsWith('pending-officer-') && officerEmail && officerEmail.trim()) {
            const trimmedOfficerEmail = officerEmail.trim().toLowerCase();
            if (!isValidEmail(trimmedOfficerEmail)) {
                return res.status(400).json({ error: 'Please enter a valid email address.' });
            }
            // Check uniqueness of the new email
            const existingWithEmail = await prisma.member.findFirst({
                where: { email: trimmedOfficerEmail, id: { not: member.id } }
            });
            if (existingWithEmail) {
                return res.status(400).json({ error: 'This email is already in use by another member.' });
            }
            memberUpdateData.email = trimmedOfficerEmail;
        }

        const [updatedMember, userRecord] = await prisma.$transaction([
            prisma.member.update({
                where: { id: member.id },
                data: memberUpdateData
            }),
            prisma.user.create({
                data: {
                    memberId: member.id,
                    passwordHash,
                    isVerified: true,
                    isActive: true
                }
            })
        ]);

        const token = jwt.sign(
            { userId: userRecord.id, memberId: member.id, email: updatedMember.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, systemRoleKey: true } }
            }
        });
        const teamIds = teamMemberships.map((tm) => tm.teamId);
        const { isOfficer, isAdmin, isLeadership, isSpecial } = computeAuthorityFlags(teamMemberships, false);
        const leadershipTeamIds = getLeadershipTeamIds(teamMemberships);

        res.status(200).json({
            token,
            user: {
                id: member.id,
                email: updatedMember.email,
                email2: trimmedEmail2,
                email3: trimmedEmail3,
                fullName: trimmedName,
                phoneNumber: trimmedPhone,
                phoneNumber2: trimmedPhone2 ?? null,
                studentId: member.studentId ?? null,
                profilePhotoUrl: member.profilePhotoUrl ?? null,
                linkedInUrl: member.linkedInUrl ?? null,
                teamIds,
                leadershipTeamIds,
                isOfficer: !!isOfficer,
                isAdmin: !!isAdmin,
                isLeadership: !!isLeadership,
                isSpecial: !!isSpecial
            }
        });
    } catch (error) {
        console.error('Complete officer profile error:', error);
        res.status(500).json({ error: 'Failed to complete officer profile' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Developer backdoor
        if (email === DEVELOPER_EMAIL) {
            if (password === DEVELOPER_PASSWORD) {
                const token = jwt.sign(
                    {
                        userId: 0,
                        memberId: 0,
                        email: DEVELOPER_EMAIL,
                        isDeveloper: true
                    },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                return res.json({
                    token,
                    user: {
                        id: 0,
                        email: DEVELOPER_EMAIL,
                        fullName: 'Developer 🔧',
                        isDeveloper: true,
                        isOfficer: true,
                        isAdmin: false,
                        isLeadership: false,
                        isSpecial: false,
                        teamIds: []
                    }
                });
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        // Look up member by email or phone
        let member;
        if (looksLikePhone(email)) {
            member = await findMemberByPhone(email);
        } else {
            member = await findMemberByEmail(email);
        }

        if (!member) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!member.user) {
            return res.status(401).json({
                error: 'Password not set. Please setup your password first.',
                needsSetup: true
            });
        }

        // Check if user is active
        if (!member.user.isActive || !member.isActive) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }

        // Block alumni from logging in
        if (member.assignmentStatus === 'ALUMNI') {
            return res.status(403).json({
                error: 'Your account has been moved to alumni status. You no longer have access to the members portal.',
                code: 'ALUMNI_ACCESS'
            });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, member.user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await prisma.user.update({
            where: { id: member.user.id },
            data: { lastLogin: new Date() }
        });

        // Generate token
        const token = jwt.sign(
            { userId: member.user.id, memberId: member.id, email: member.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, systemRoleKey: true } }
            }
        });
        const teamIds = teamMemberships.map((tm) => tm.teamId);
        const { isOfficer, isAdmin, isLeadership, isSpecial } = computeAuthorityFlags(teamMemberships, false);
        const leadershipTeamIds = getLeadershipTeamIds(teamMemberships);

        res.json({
            token,
            user: {
                id: member.id,
                email: member.email,
                email2: member.email2 ?? null,
                email3: member.email3 ?? null,
                fullName: member.fullName,
                phoneNumber: member.phoneNumber ?? null,
                phoneNumber2: member.phoneNumber2 ?? null,
                studentId: member.studentId ?? null,
                profilePhotoUrl: member.profilePhotoUrl ?? null,
                linkedInUrl: member.linkedInUrl ?? null,
                assignmentStatus: member.assignmentStatus ?? 'UNASSIGNED',
                isActive: member.isActive,
                teamIds,
                leadershipTeamIds,
                isOfficer: !!isOfficer,
                isAdmin: !!isAdmin,
                isLeadership: !!isLeadership,
                isSpecial: !!isSpecial
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Developer backdoor (authority level 1)
        if (decoded.isDeveloper) {
            return res.json({
                user: {
                    id: 0,
                    email: DEVELOPER_EMAIL,
                    fullName: 'Developer 🔧',
                    isDeveloper: true,
                    isOfficer: true,
                    isAdmin: false,
                    isLeadership: false,
                    isSpecial: false,
                    teamIds: [],
                    leadershipTeamIds: []
                }
            });
        }

        const member = await prisma.member.findUnique({
            where: { id: decoded.memberId },
            select: {
                id: true,
                email: true,
                email2: true,
                email3: true,
                fullName: true,
                phoneNumber: true,
                phoneNumber2: true,
                studentId: true,
                profilePhotoUrl: true,
                linkedInUrl: true,
                isActive: true,
                assignmentStatus: true,
                joinDate: true,
                createdAt: true,
                teamMemberships: {
                    where: { isActive: true },
                    select: {
                        teamId: true,
                        team: { select: { name: true } },
                        role: { select: { roleName: true, systemRoleKey: true } }
                    }
                }
            }
        });

        if (!member) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Block alumni from accessing /me (forces frontend to show alumni gate)
        if (member.assignmentStatus === 'ALUMNI') {
            return res.status(403).json({
                error: 'Your account has been moved to alumni status.',
                code: 'ALUMNI_ACCESS'
            });
        }

        const teamIds = (member.teamMemberships || []).map((tm) => tm.teamId);
        const { isOfficer, isAdmin, isLeadership, isSpecial } = computeAuthorityFlags(member.teamMemberships, false);
        const leadershipTeamIds = getLeadershipTeamIds(member.teamMemberships || []);

        const { teamMemberships, ...memberData } = member;
        // Don't expose placeholder phone/phone2 to the client so profile shows "—" until real values are set
        const userPayload = {
            ...memberData,
            phoneNumber: isPlaceholderPhone(memberData.phoneNumber) ? null : (memberData.phoneNumber ?? null),
            phoneNumber2: isPlaceholderPhone(memberData.phoneNumber2) ? null : (memberData.phoneNumber2 ?? null),
            assignmentStatus: memberData.assignmentStatus ?? 'UNASSIGNED',
            teamIds,
            leadershipTeamIds,
            isOfficer: !!isOfficer,
            isAdmin: !!isAdmin,
            isLeadership: !!isLeadership,
            isSpecial: !!isSpecial
        };
        res.json({ user: userPayload });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// ============================================
// CHANGE PASSWORD
// ============================================
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!req.user || !req.user.memberId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All password fields are required.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'New password and confirmation do not match.' });
        }

        const pwdCheck = validatePassword(newPassword);
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }

        const userRecord = await prisma.user.findFirst({
            where: { memberId: req.user.memberId },
        });

        if (!userRecord) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, userRecord.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userRecord.id },
            data: { passwordHash: newHash },
        });

        res.json({ success: true, message: 'Password updated.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

module.exports = router;