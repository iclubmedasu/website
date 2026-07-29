import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db';
import {
    ADMINISTRATION_TEAM_NAME,
    ADMIN_SYSTEM_ROLE_KEY,
} from './authorityFlags';

export type DocumentRank = 'ORG_LEADERSHIP' | 'TEAM_LEADERSHIP';

export type DocumentAuthOptions = {
    isDeveloper?: boolean;
};

type MembershipRow = {
    teamId: number;
    team: { name: string } | null;
    role: { roleName: string; systemRoleKey: number | null } | null;
};

async function getActiveMemberships(memberId: number): Promise<MembershipRow[]> {
    return prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: {
            teamId: true,
            team: { select: { name: true } },
            role: { select: { roleName: true, systemRoleKey: true } },
        },
    });
}

function isOrgLeadershipMembership(tm: MembershipRow): boolean {
    const inAdmin = tm.team?.name === ADMINISTRATION_TEAM_NAME;
    if (!inAdmin) return false;
    const roleName = tm.role?.roleName;
    const keyNum = tm.role?.systemRoleKey != null ? Number(tm.role.systemRoleKey) : null;
    return (
        roleName === 'Officer'
        || roleName === 'President'
        || roleName === 'Vice President'
        || keyNum === ADMIN_SYSTEM_ROLE_KEY.OFFICER
        || keyNum === ADMIN_SYSTEM_ROLE_KEY.PRESIDENT
        || keyNum === ADMIN_SYSTEM_ROLE_KEY.VICE_PRESIDENT
    );
}

function isLeadershipMembership(tm: MembershipRow): boolean {
    const inAdmin = tm.team?.name === ADMINISTRATION_TEAM_NAME;
    const roleName = tm.role?.roleName;
    const keyNum = tm.role?.systemRoleKey != null ? Number(tm.role.systemRoleKey) : null;
    return (
        (!inAdmin && (keyNum === 1 || keyNum === 2))
        || (!inAdmin && (roleName === 'Head of Team' || roleName === 'Vice Head of Team'))
    );
}

function rankFromMemberships(
    memberships: MembershipRow[],
    options?: DocumentAuthOptions,
): DocumentRank | null {
    if (options?.isDeveloper) return 'ORG_LEADERSHIP';
    if (memberships.some(isOrgLeadershipMembership)) return 'ORG_LEADERSHIP';
    if (memberships.some(isLeadershipMembership)) return 'TEAM_LEADERSHIP';
    return null;
}

function leadershipTeamIdsFromMemberships(memberships: MembershipRow[]): number[] {
    const ids: number[] = [];
    for (const tm of memberships) {
        if (isLeadershipMembership(tm)) ids.push(tm.teamId);
    }
    return [...new Set(ids)];
}

/** Document rank from active memberships. ORG = developer / Officer / President / VP. */
export async function getMemberDocumentRank(
    memberId: number,
    options?: DocumentAuthOptions,
): Promise<DocumentRank | null> {
    if (options?.isDeveloper) return 'ORG_LEADERSHIP';
    return rankFromMemberships(await getActiveMemberships(memberId), options);
}

/** Team IDs where the member is active Head/Vice on a non-Administration team. */
export async function getMemberTeamIds(memberId: number): Promise<number[]> {
    return leadershipTeamIdsFromMemberships(await getActiveMemberships(memberId));
}

/**
 * Active TEAM grants matching the member's led teams (Head/Vice).
 * MEMBER grants are ignored (legacy rows only).
 */
async function hasActiveDocumentGrant(
    documentId: number,
    ledTeamIds: number[],
): Promise<boolean> {
    if (ledTeamIds.length === 0) return false;
    const grant = await prisma.documentAccessGrant.findFirst({
        where: {
            documentId,
            revokedAt: null,
            grantedToType: 'TEAM',
            teamId: { in: ledTeamIds },
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
        select: { id: true },
    });
    return grant != null;
}

async function hasActiveCategoryGrant(
    categoryId: number,
    ledTeamIds: number[],
): Promise<boolean> {
    if (ledTeamIds.length === 0) return false;
    const grant = await prisma.documentCategoryAccessGrant.findFirst({
        where: {
            categoryId,
            revokedAt: null,
            grantedToType: 'TEAM',
            teamId: { in: ledTeamIds },
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
        select: { id: true },
    });
    return grant != null;
}

/** Any active TEAM document grant for a file inside this category (unlocks parent folder for viewing). */
async function hasActiveDocumentGrantInCategory(
    categoryId: number,
    ledTeamIds: number[],
): Promise<boolean> {
    if (ledTeamIds.length === 0) return false;
    const grant = await prisma.documentAccessGrant.findFirst({
        where: {
            revokedAt: null,
            grantedToType: 'TEAM',
            teamId: { in: ledTeamIds },
            document: { categoryId },
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
        select: { id: true },
    });
    return grant != null;
}

function hasNaturalDocumentAccess(args: {
    rank: DocumentRank | null;
    ledTeamIds: number[];
    scopeTeamId: number | null;
}): boolean {
    if (args.rank === 'ORG_LEADERSHIP') return true;
    if (
        args.rank === 'TEAM_LEADERSHIP'
        && args.scopeTeamId != null
        && args.ledTeamIds.includes(args.scopeTeamId)
    ) {
        return true;
    }
    return false;
}

/**
 * Document view access (two-tier):
 * - Org leadership → all documents
 * - Team leadership → docs scoped to their led team(s)
 * - Else folder (category) grant
 * - Else document grant
 */
export async function canMemberViewDocument(
    memberId: number,
    documentId: number,
    options?: DocumentAuthOptions,
): Promise<boolean> {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, categoryId: true, scopeTeamId: true },
    });
    if (!document) return false;

    const memberships = await getActiveMemberships(memberId);
    const rank = rankFromMemberships(memberships, options);
    const ledTeamIds = leadershipTeamIdsFromMemberships(memberships);

    if (hasNaturalDocumentAccess({
        rank,
        ledTeamIds,
        scopeTeamId: document.scopeTeamId,
    })) {
        return true;
    }

    if (
        document.categoryId != null
        && (await hasActiveCategoryGrant(document.categoryId, ledTeamIds))
    ) {
        return true;
    }

    return hasActiveDocumentGrant(documentId, ledTeamIds);
}

/**
 * Natural access only — org tier, team leadership for scope, or ranked uploader.
 * Grant-only recipients cannot grant further.
 */
export async function canMemberGrantDocument(
    granterId: number,
    documentId: number,
    options?: DocumentAuthOptions,
): Promise<boolean> {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, scopeTeamId: true },
    });
    if (!document) return false;

    const memberships = await getActiveMemberships(granterId);
    const rank = rankFromMemberships(memberships, options);
    const ledTeamIds = leadershipTeamIdsFromMemberships(memberships);

    return hasNaturalDocumentAccess({
        rank,
        ledTeamIds,
        scopeTeamId: document.scopeTeamId,
    });
}

/**
 * Folder view: natural ownership (scope-based), category grant, or any file grant inside.
 * Grant recipients are view-only (manage still uses canMemberGrantCategory).
 */
export async function canMemberViewCategory(
    memberId: number,
    categoryId: number,
    options?: DocumentAuthOptions,
): Promise<boolean> {
    const category = await prisma.documentCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, scopeTeamId: true },
    });
    if (!category) return false;

    const memberships = await getActiveMemberships(memberId);
    const rank = rankFromMemberships(memberships, options);
    const ledTeamIds = leadershipTeamIdsFromMemberships(memberships);

    if (hasNaturalDocumentAccess({
        rank,
        ledTeamIds,
        scopeTeamId: category.scopeTeamId,
    })) {
        return true;
    }

    if (await hasActiveCategoryGrant(categoryId, ledTeamIds)) {
        return true;
    }

    return hasActiveDocumentGrantInCategory(categoryId, ledTeamIds);
}

/**
 * Natural access only for folder ACL management (scope owners / org leadership).
 * Grant-only recipients cannot grant further.
 */
export async function canMemberGrantCategory(
    granterId: number,
    categoryId: number,
    options?: DocumentAuthOptions,
): Promise<boolean> {
    const category = await prisma.documentCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, scopeTeamId: true },
    });
    if (!category) return false;

    const memberships = await getActiveMemberships(granterId);
    const rank = rankFromMemberships(memberships, options);
    const ledTeamIds = leadershipTeamIdsFromMemberships(memberships);

    return hasNaturalDocumentAccess({
        rank,
        ledTeamIds,
        scopeTeamId: category.scopeTeamId,
    });
}

/**
 * Resolve document/folder creation scope from rank + optional scopeTeamId body value.
 * TEAM_LEADERSHIP: required (auto-picks sole led team when omitted).
 * ORG_LEADERSHIP: optional (null = org-owned).
 */
export async function resolveScopeTeamId(
    memberId: number,
    rank: DocumentRank,
    scopeRaw: unknown,
): Promise<{ scopeTeamId: number | null; error?: string; status?: number }> {
    const parseScopeId = (value: unknown): number | null => {
        const parsed = Number.parseInt(String(value), 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    };

    if (rank === 'TEAM_LEADERSHIP') {
        const teamIds = await getMemberTeamIds(memberId);
        if (teamIds.length === 0) {
            return { scopeTeamId: null, error: 'No leadership team scope available', status: 403 };
        }

        if (scopeRaw === undefined || scopeRaw === null || scopeRaw === '') {
            return { scopeTeamId: teamIds[0] };
        }

        const parsed = parseScopeId(scopeRaw);
        if (!parsed || !teamIds.includes(parsed)) {
            return {
                scopeTeamId: null,
                error: 'scopeTeamId must be one of your leadership teams',
                status: 403,
            };
        }
        return { scopeTeamId: parsed };
    }

    if (scopeRaw !== undefined && scopeRaw !== null && scopeRaw !== '') {
        const parsed = parseScopeId(scopeRaw);
        if (!parsed) {
            return { scopeTeamId: null, error: 'Invalid scopeTeamId', status: 400 };
        }
        const team = await prisma.team.findUnique({ where: { id: parsed }, select: { id: true } });
        if (!team) {
            return { scopeTeamId: null, error: 'scopeTeamId team not found', status: 400 };
        }
        return { scopeTeamId: parsed };
    }

    return { scopeTeamId: null };
}

export async function requireDocumentAccess(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<Response | void> {
    const documentId = Number(req.params.id);
    const memberId = req.user?.memberId;

    if (!memberId || !Number.isFinite(documentId) || documentId <= 0) {
        return res.status(403).json({ error: 'Document access denied' });
    }

    if (!(await canMemberViewDocument(memberId, documentId, { isDeveloper: req.user?.isDeveloper }))) {
        return res.status(403).json({ error: 'Document access denied' });
    }

    return next();
}

export async function requireCategoryAccess(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<Response | void> {
    const categoryId = Number(req.params.id);
    const memberId = req.user?.memberId;

    if (!memberId || !Number.isFinite(categoryId) || categoryId <= 0) {
        return res.status(403).json({ error: 'Category access denied' });
    }

    if (!(await canMemberViewCategory(memberId, categoryId, { isDeveloper: req.user?.isDeveloper }))) {
        return res.status(403).json({ error: 'Category access denied' });
    }

    return next();
}
