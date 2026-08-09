import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { computeIsSupportFormsEditor } from '../lib/supportPermissions';
import { computeIsFinanceViewer } from '../lib/financePermissions';
import { JWT_SECRET, authenticateToken } from '../middleware/auth';
import {
    credentialPostLimiter,
    identityCheckLimiter,
    passwordResetLimiter,
} from '../middleware/rateLimit';
import { resolveDeveloperCredentials } from '../lib/securityEnv';
import type { RequestUser } from '../types/auth';
import {
    looksLikePhone,
    phoneLookupCandidates,
    sanitizePhoneForStorage,
    sanitizeOptionalPhoneForStorage,
    validateStoredPhone,
} from '../lib/phoneUtils';
import { computeAuthorityFlags } from '../lib/authorityFlags';
import { sendPasswordResetEmail } from '../services/passwordResetEmailService';
import { recordUsageEvent, USAGE_ACTION_TYPES } from '../services/usageEventService';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const FORGOT_PASSWORD_SUCCESS_MESSAGE =
    'If an account exists for that email, we sent password reset instructions.';

function hashResetToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

const router: any = express.Router();

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

// Optional developer backdoor — resolved per request (no hardcoded fallbacks).
function getDeveloperCredentials() {
    return resolveDeveloperCredentials();
}

// Official email: studentId@med.asu.edu.eg (same as members.js)
const OFFICIAL_EMAIL_DOMAIN = '@med.asu.edu.eg';
const officialEmail = (studentId) => `${studentId}${OFFICIAL_EMAIL_DOMAIN}`;

const AUTH_COOKIE_NAME = 'token';
const WEB_SESSION_TTL = '7d';
const PWA_SESSION_TTL = '30d';
/** Short-lived JWT for WebSocket upgrades when portal cookies are not sent cross-host. */
const WS_TICKET_TTL = '2m';
const WEB_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PWA_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Re-issue a 30d PWA token when remaining JWT life is under this threshold. */
const PWA_REISSUE_REMAINING_MS = WEB_COOKIE_MAX_AGE_MS;

function isPwaClient(req: { body?: { clientSurface?: unknown }; headers?: Record<string, unknown> }): boolean {
    const bodySurface = req.body?.clientSurface;
    if (bodySurface === 'pwa') return true;
    if (bodySurface === 'web') return false;

    const raw = req.headers?.['x-client-surface'];
    const header = Array.isArray(raw) ? raw[0] : raw;
    return typeof header === 'string' && header.trim().toLowerCase() === 'pwa';
}

function issueAuthToken(payload: object, longLived: boolean): string {
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: longLived ? PWA_SESSION_TTL : WEB_SESSION_TTL,
    });
}

/**
 * Auth cookie flags are environment-aware:
 * - Production (HTTPS, cross-origin portal ↔ API): Secure + SameSite=None
 * - Dev/test/LAN (plain HTTP, same host different ports): non-Secure + SameSite=Lax
 */
function getAuthCookieBaseOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    };
}

function setAuthCookie(res, token: string, longLived: boolean) {
    res.cookie(AUTH_COOKIE_NAME, token, {
        ...getAuthCookieBaseOptions(),
        maxAge: longLived ? PWA_COOKIE_MAX_AGE_MS : WEB_COOKIE_MAX_AGE_MS,
    });
}

function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieBaseOptions());
}

/**
 * Strip JWT standard claims before re-signing so `expiresIn` is applied cleanly.
 */
function sessionPayloadFromDecoded(decoded: RequestUser & { iat?: number; exp?: number; [key: string]: unknown }) {
    const { iat: _iat, exp: _exp, ...payload } = decoded;
    return payload;
}

function shouldReissuePwaToken(decoded: { exp?: number }, longLived: boolean): boolean {
    if (!longLived) return false;
    if (typeof decoded.exp !== 'number') return true;
    const remainingMs = decoded.exp * 1000 - Date.now();
    return remainingMs < PWA_REISSUE_REMAINING_MS;
}

// Placeholder member (added with only student ID) - can complete profile via Student ID flow
const PLACEHOLDER_FULLNAME = 'Pending';
const isPlaceholderMember = (member) => member.fullName === PLACEHOLDER_FULLNAME;
// Placeholder phone when member created with only studentId (members.js uses pending-{studentId})
const isPlaceholderPhone = (value) => typeof value === 'string' && value.startsWith('pending-');

// Password: at least 8 chars, one upper, one lower, one number, one symbol;
// must not contain any related email (full address or local-part length >= 3).
function validatePassword(password, emails: string[] = []) {
    if (!password || typeof password !== 'string') return { valid: false, error: 'Password is required' };
    if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter' };
    if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain at least one lowercase letter' };
    if (!/\d/.test(password)) return { valid: false, error: 'Password must contain at least one number' };
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return { valid: false, error: 'Password must contain at least one symbol (e.g. !@#$%^&*)' };

    const pwdLower = password.toLowerCase();
    const related = [
        ...new Set(
            (Array.isArray(emails) ? emails : [])
                .filter((e) => typeof e === 'string' && e.trim())
                .map((e) => e.trim().toLowerCase())
        ),
    ];
    for (const email of related) {
        if (pwdLower.includes(email)) {
            return { valid: false, error: 'Password must not contain your email address' };
        }
        const localPart = email.split('@')[0];
        if (localPart && localPart.length >= 3 && pwdLower.includes(localPart)) {
            return { valid: false, error: 'Password must not contain your email address' };
        }
    }
    return { valid: true };
}

function collectMemberEmails(...values: Array<string | null | undefined>): string[] {
    return [
        ...new Set(
            values
                .filter((e): e is string => typeof e === 'string' && Boolean(e.trim()))
                .map((e) => e.trim())
        ),
    ];
}

// Standard email format: local@domain.tld
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value) {
    return value && typeof value === 'string' && EMAIL_REGEX.test(value.trim());
}

// Official @med.asu.edu.eg email regex
const OFFICIAL_EMAIL_REGEX = /^[^\s@]+@med\.asu\.edu\.eg$/i;

// Find member by phone number. Matches canonical and legacy stored forms.
async function findMemberByPhone(phone) {
    if (!phone) return null;
    const candidates = phoneLookupCandidates(phone);
    if (candidates.length === 0) return null;
    return prisma.member.findFirst({
        where: {
            OR: [
                { phoneNumber: { in: candidates } },
                { phoneNumber2: { in: candidates } },
            ],
        },
        include: { user: true },
    });
}

function buildSessionAuthority(teamMemberships, isDeveloper = false) {
    const teamIds = (teamMemberships || []).map((tm) => tm.teamId);
    const { isOfficer, isAdmin, isLeadership, isSpecial } = computeAuthorityFlags(teamMemberships, isDeveloper);
    const leadershipTeamIds = getLeadershipTeamIds(teamMemberships);
    const isSupportFormsEditor = computeIsSupportFormsEditor(teamMemberships, {
        isDeveloper,
        isOfficer,
        isAdmin,
    });
    const isFinanceViewer = computeIsFinanceViewer(teamMemberships, {
        isDeveloper,
        isOfficer,
        isAdmin,
    });

    return {
        teamIds,
        leadershipTeamIds,
        isOfficer: !!isOfficer,
        isAdmin: !!isAdmin,
        isLeadership: !!isLeadership,
        isSpecial: !!isSpecial,
        isSupportFormsEditor: !!isSupportFormsEditor,
        isFinanceViewer: !!isFinanceViewer,
    };
}

// Team IDs where the user is Head or Vice Head (non-Administration). Used so leadership can edit their own team.
function getLeadershipTeamIds(teamMemberships) {
    const list = teamMemberships || [];
    const ids: number[] = [];
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
router.post('/setup-password', credentialPostLimiter, async (req, res) => {
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

        const pwdCheck = validatePassword(
            password,
            collectMemberEmails(email, member.email, member.email2, member.email3),
        );
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

        // Compute authority flags before generating token
        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, roleType: true, systemRoleKey: true } }
            }
        });
        const authority = buildSessionAuthority(teamMemberships, false);

        // Generate token with authority flags
        const longLived = isPwaClient(req);
        const token = issueAuthToken(
            { userId: user.id, memberId: member.id, email: member.email, ...authority },
            longLived,
        );

        setAuthCookie(res, token, longLived);

        res.status(201).json({
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
                ...authority,
            },
            token,
        });
    } catch (error) {
        console.error('Setup password error:', error);
        res.status(500).json({ error: 'Failed to setup password' });
    }
});

// Check if email or student ID exists and needs password setup
// Accepts either official email (e.g. 213256@med.asu.edu.eg) or student ID (e.g. 213256) – both identify the same member
router.post('/check-email', identityCheckLimiter, async (req, res) => {
    try {
        const input = (req.body.email ?? '').toString().trim();

        // Developer backdoor check (only when credentials are configured via env)
        const developer = getDeveloperCredentials();
        if (developer && input === developer.email) {
            return res.json({
                exists: true,
                needsSetup: false,
                isDeveloper: true,
                email: developer.email,
                message: 'Developer access. Please enter password.'
            });
        }

        let member: any = null;

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
router.post('/update-invited-profile', credentialPostLimiter, async (req, res) => {
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
        const trimmedPhone = sanitizePhoneForStorage(phoneNumber);
        const phoneValidation = validateStoredPhone(trimmedPhone);
        if (!phoneValidation.valid) {
            return res.status(400).json({ error: phoneValidation.error });
        }
        const trimmedPhone2 = sanitizeOptionalPhoneForStorage(phoneNumber2);
        if (trimmedPhone2) {
            const phone2Validation = validateStoredPhone(trimmedPhone2);
            if (!phone2Validation.valid) {
                return res.status(400).json({ error: 'Second phone number is invalid' });
            }
        }
        const trimmedEmail2 = email2?.trim() || null;
        const trimmedEmail3 = email3?.trim() || null;
        if (trimmedEmail2 && !isValidEmail(trimmedEmail2)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 2 (e.g. name@domain.com).' });
        }
        if (trimmedEmail3 && !isValidEmail(trimmedEmail3)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 3 (e.g. name@domain.com).' });
        }
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
        await prisma.member.update({
            where: { id: member.id },
            data: {
                fullName: fullName.trim(),
                phoneNumber: trimmedPhone,
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
router.post('/check-student-id', identityCheckLimiter, async (req, res) => {
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
router.post('/complete-profile', credentialPostLimiter, async (req, res) => {
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

        const primaryEmail = officialEmail(sid);
        const pwdCheck = validatePassword(
            password,
            collectMemberEmails(
                primaryEmail,
                member.email,
                email2,
                email3,
                member.email2,
                member.email3,
            ),
        );
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }

        const trimmedPhone = sanitizePhoneForStorage(phoneNumber);
        const phoneValidation = validateStoredPhone(trimmedPhone);
        if (!phoneValidation.valid) {
            return res.status(400).json({ error: phoneValidation.error });
        }
        const trimmedName = toTitleCase(fullName.trim());
        const trimmedEmail2 = email2?.trim() || null;
        const trimmedEmail3 = email3?.trim() || null;

        if (trimmedEmail2 && !isValidEmail(trimmedEmail2)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 2 (e.g. name@domain.com).' });
        }
        if (trimmedEmail3 && !isValidEmail(trimmedEmail3)) {
            return res.status(400).json({ error: 'Please enter a valid email for additional email 3 (e.g. name@domain.com).' });
        }

        const trimmedPhone2 = sanitizeOptionalPhoneForStorage(phoneNumber2);
        if (trimmedPhone2) {
            const phone2Validation = validateStoredPhone(trimmedPhone2);
            if (!phone2Validation.valid) {
                return res.status(400).json({ error: 'Second phone number is invalid' });
            }
        }
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

        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, roleType: true, systemRoleKey: true } }
            }
        });
        const authority = buildSessionAuthority(teamMemberships, false);

        const longLived = isPwaClient(req);
        const token = issueAuthToken(
            { userId: userRecord.id, memberId: member.id, email: primaryEmail, ...authority },
            longLived,
        );

        setAuthCookie(res, token, longLived);

        res.status(200).json({
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
                ...authority,
            },
            token
        });
    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({ error: 'Failed to complete profile' });
    }
});

// Check officer identifier (email or phone) — Task 1.1 step 3
router.post('/check-officer-identifier', identityCheckLimiter, async (req, res) => {
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

        let member: any = null;
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
router.post('/complete-officer-profile', credentialPostLimiter, async (req, res) => {
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

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const trimmedIdentifier = identifier.trim();
        const isEmail = trimmedIdentifier.includes('@');

        let member: any = null;
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

        const pwdCheck = validatePassword(
            password,
            collectMemberEmails(
                officerEmail,
                email2,
                email3,
                member.email,
                member.email2,
                member.email3,
            ),
        );
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }

        const trimmedName = toTitleCase(fullName.trim());
        const trimmedPhone = sanitizePhoneForStorage(phoneNumber);
        const phoneValidation = validateStoredPhone(trimmedPhone);
        if (!phoneValidation.valid) {
            return res.status(400).json({ error: phoneValidation.error });
        }
        const trimmedPhone2 = sanitizeOptionalPhoneForStorage(phoneNumber2);
        if (trimmedPhone2) {
            const phone2Validation = validateStoredPhone(trimmedPhone2);
            if (!phone2Validation.valid) {
                return res.status(400).json({ error: 'Second phone number is invalid' });
            }
        }
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
        const memberUpdateData: any = {
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

        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, roleType: true, systemRoleKey: true } }
            }
        });
        const authority = buildSessionAuthority(teamMemberships, false);

        const longLived = isPwaClient(req);
        const token = issueAuthToken(
            { userId: userRecord.id, memberId: member.id, email: updatedMember.email, ...authority },
            longLived,
        );

        setAuthCookie(res, token, longLived);

        res.status(200).json({
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
                ...authority,
            },
            token
        });
    } catch (error) {
        console.error('Complete officer profile error:', error);
        res.status(500).json({ error: 'Failed to complete officer profile' });
    }
});

// Login endpoint
router.post('/login', credentialPostLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Developer backdoor (only when credentials are configured via env)
        const developer = getDeveloperCredentials();
        if (developer && email === developer.email) {
            if (password === developer.password) {
                const longLived = isPwaClient(req);
                const token = issueAuthToken(
                    {
                        userId: 0,
                        memberId: 0,
                        email: developer.email,
                        isDeveloper: true,
                        isSupportFormsEditor: true,
                        isFinanceViewer: true,
                    },
                    longLived,
                );

                setAuthCookie(res, token, longLived);

                return res.json({
                    user: {
                        id: 0,
                        email: developer.email,
                        fullName: 'Developer 🔧',
                        isDeveloper: true,
                        isOfficer: true,
                        isAdmin: false,
                        isLeadership: false,
                        isSpecial: false,
                        isSupportFormsEditor: true,
                        isFinanceViewer: true,
                        teamIds: []
                    },
                    token,
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

        await recordUsageEvent({
            memberId: member.id,
            actionType: USAGE_ACTION_TYPES.LOGIN,
            entityType: 'User',
            entityId: member.user.id,
        });

        // Compute authority flags before generating token
        const teamMemberships = await prisma.teamMember.findMany({
            where: { memberId: member.id, isActive: true },
            select: {
                teamId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, roleType: true, systemRoleKey: true } }
            }
        });
        const authority = buildSessionAuthority(teamMemberships, false);

        // Generate token with authority flags
        const longLived = isPwaClient(req);
        const token = issueAuthToken(
            { userId: member.user.id, memberId: member.id, email: member.email, ...authority },
            longLived,
        );

        setAuthCookie(res, token, longLived);

        res.json({
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
                ...authority,
            },
            token
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
        const bearerToken = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : undefined;
        const token = req.cookies?.token || bearerToken;

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as RequestUser & { iat?: number; exp?: number };
        const longLived = isPwaClient(req);
        const reissue = shouldReissuePwaToken(decoded, longLived);

        // Developer backdoor (authority level 1)
        if (decoded.isDeveloper) {
            const developer = getDeveloperCredentials();
            const userPayload = {
                id: 0,
                email: decoded.email || developer?.email || 'developer',
                fullName: 'Developer 🔧',
                isDeveloper: true,
                isOfficer: true,
                isAdmin: false,
                isLeadership: false,
                isSpecial: false,
                isSupportFormsEditor: true,
                isFinanceViewer: true,
                teamIds: [],
                leadershipTeamIds: []
            };

            if (reissue) {
                const newToken = issueAuthToken(sessionPayloadFromDecoded(decoded), true);
                setAuthCookie(res, newToken, true);
                return res.json({ user: userPayload, token: newToken });
            }

            return res.json({ user: userPayload });
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
                showPhoneNumber: true,
                showPhoneNumber2: true,
                showEmail2: true,
                showEmail3: true,
                showStudentId: true,
                createdAt: true,
                teamMemberships: {
                    where: { isActive: true },
                    select: {
                        teamId: true,
                        team: { select: { name: true } },
                        role: { select: { roleName: true, roleType: true, systemRoleKey: true } }
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

        const authority = buildSessionAuthority(member.teamMemberships, false);

        const { teamMemberships, ...memberData } = member;
        void teamMemberships;
        // Don't expose placeholder phone/phone2 to the client so profile shows "—" until real values are set
        const userPayload = {
            ...memberData,
            phoneNumber: isPlaceholderPhone(memberData.phoneNumber) ? null : (memberData.phoneNumber ?? null),
            phoneNumber2: isPlaceholderPhone(memberData.phoneNumber2) ? null : (memberData.phoneNumber2 ?? null),
            assignmentStatus: memberData.assignmentStatus ?? 'UNASSIGNED',
            ...authority,
        };

        if (reissue) {
            // Prefer current authority flags on the re-issued token
            const newToken = issueAuthToken(
                {
                    userId: decoded.userId,
                    memberId: member.id,
                    email: member.email,
                    ...authority,
                },
                true,
            );
            setAuthCookie(res, newToken, true);
            return res.json({ user: userPayload, token: newToken });
        }

        res.json({ user: userPayload });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
        }
        console.error('Get user error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

/**
 * Mint a short-lived JWT for WebSocket connect to the backend host.
 * Used when the browser auth cookie is same-origin on the members portal (BFF proxy)
 * and cannot be sent on the cross-host WS upgrade.
 */
router.get('/ws-ticket', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const bearerToken = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : undefined;
        const sessionToken = req.cookies?.token || bearerToken;

        if (!sessionToken) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(sessionToken, JWT_SECRET, { algorithms: ['HS256'] }) as RequestUser & {
            iat?: number;
            exp?: number;
        };

        if (decoded.isDeveloper) {
            const ticket = jwt.sign(sessionPayloadFromDecoded(decoded), JWT_SECRET, {
                algorithm: 'HS256',
                expiresIn: WS_TICKET_TTL,
            });
            return res.json({ token: ticket });
        }

        if (!decoded.memberId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const member = await prisma.member.findUnique({
            where: { id: decoded.memberId },
            select: {
                id: true,
                email: true,
                isActive: true,
                assignmentStatus: true,
                teamMemberships: {
                    where: { isActive: true },
                    select: {
                        teamId: true,
                        role: { select: { roleName: true, roleType: true, systemRoleKey: true } },
                    },
                },
            },
        });

        if (!member || !member.isActive) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (member.assignmentStatus === 'ALUMNI') {
            return res.status(403).json({
                error: 'Your account has been moved to alumni status.',
                code: 'ALUMNI_ACCESS',
            });
        }

        const authority = buildSessionAuthority(member.teamMemberships, false);
        const ticket = jwt.sign(
            {
                userId: decoded.userId,
                memberId: member.id,
                email: member.email,
                ...authority,
            },
            JWT_SECRET,
            { algorithm: 'HS256', expiresIn: WS_TICKET_TTL },
        );

        return res.json({ token: ticket });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
        }
        console.error('WS ticket error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
});

// ============================================
// FORGOT / RESET PASSWORD
// ============================================
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
        const email = (req.body.email ?? '').toString().trim();
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: 'A valid email is required.' });
        }

        const member = await findMemberByEmail(email);
        const user = member?.user ?? null;
        const canReset =
            !!member &&
            !!user &&
            user.isActive !== false &&
            member.isActive !== false;

        if (!canReset) {
            return res.json({
                success: true,
                message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
            });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const resetToken = hashResetToken(rawToken);
        const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry },
        });

        try {
            await sendPasswordResetEmail({
                to: email,
                recipientName: member.fullName || 'Member',
                rawToken,
            });
        } catch (emailError) {
            console.error('Forgot password email error:', emailError);
            // Same generic success as unknown email to avoid account enumeration
            return res.json({
                success: true,
                message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
            });
        }

        return res.json({
            success: true,
            message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request.' });
    }
});

router.post('/reset-password', passwordResetLimiter, async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        if (!token || typeof token !== 'string' || !token.trim()) {
            return res.status(400).json({ error: 'Reset token is required.' });
        }
        if (!password || !confirmPassword) {
            return res.status(400).json({ error: 'Password and confirmation are required.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Password and confirmation do not match.' });
        }

        const hashedToken = hashResetToken(token.trim());
        const userRecord = await prisma.user.findFirst({
            where: {
                resetToken: hashedToken,
                resetTokenExpiry: { gt: new Date() },
                isActive: true,
            },
            include: {
                member: {
                    select: {
                        isActive: true,
                        email: true,
                        email2: true,
                        email3: true,
                    },
                },
            },
        });

        if (!userRecord || userRecord.member?.isActive === false) {
            return res.status(400).json({
                error: 'This reset link is invalid or has expired. Please request a new one.',
            });
        }

        const pwdCheck = validatePassword(
            password,
            collectMemberEmails(
                userRecord.member?.email,
                userRecord.member?.email2,
                userRecord.member?.email3,
            ),
        );
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: userRecord.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        return res.json({
            success: true,
            message: 'Password updated. You can sign in with your new password.',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
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

        const userRecord = await prisma.user.findFirst({
            where: { memberId: req.user.memberId },
            include: {
                member: {
                    select: { email: true, email2: true, email3: true },
                },
            },
        });

        if (!userRecord) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        const pwdCheck = validatePassword(
            newPassword,
            collectMemberEmails(
                userRecord.member?.email,
                userRecord.member?.email2,
                userRecord.member?.email3,
            ),
        );
        if (!pwdCheck.valid) {
            return res.status(400).json({ error: pwdCheck.error });
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

export default router;
