import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    documentFindUnique: vi.fn(),
    documentCategoryFindUnique: vi.fn(),
    teamMemberFindMany: vi.fn(),
    teamFindUnique: vi.fn(),
    documentAccessGrantFindFirst: vi.fn(),
    documentCategoryAccessGrantFindFirst: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        document: {
            findUnique: prismaMocks.documentFindUnique,
        },
        documentCategory: {
            findUnique: prismaMocks.documentCategoryFindUnique,
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
        },
        team: {
            findUnique: prismaMocks.teamFindUnique,
        },
        documentAccessGrant: {
            findFirst: prismaMocks.documentAccessGrantFindFirst,
        },
        documentCategoryAccessGrant: {
            findFirst: prismaMocks.documentCategoryAccessGrantFindFirst,
        },
    },
}));

import {
    canMemberGrantCategory,
    canMemberGrantDocument,
    canMemberViewCategory,
    canMemberViewDocument,
    getMemberDocumentRank,
    getMemberTeamIds,
    resolveScopeTeamId,
} from '../../lib/documentPermissions';

const MEMBER_ID = 1;
const DOC_ID = 10;
const CATEGORY_ID = 20;
const TEAM_A = 5;
const TEAM_B = 6;

function adminOfficerMembership() {
    return {
        teamId: 1,
        team: { name: 'Administration' },
        role: { roleName: 'Officer', systemRoleKey: 10 },
    };
}

function adminPresidentMembership() {
    return {
        teamId: 1,
        team: { name: 'Administration' },
        role: { roleName: 'President', systemRoleKey: 11 },
    };
}

function teamLeadershipMembership(teamId: number) {
    return {
        teamId,
        team: { name: `Team ${teamId}` },
        role: { roleName: 'Head of Team', systemRoleKey: 1 },
    };
}

function plainMembership(teamId: number) {
    return {
        teamId,
        team: { name: `Team ${teamId}` },
        role: { roleName: 'Member', systemRoleKey: 3 },
    };
}

describe('documentPermissions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMocks.documentAccessGrantFindFirst.mockResolvedValue(null);
        prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue(null);
    });

    describe('getMemberDocumentRank', () => {
        it('returns ORG_LEADERSHIP for Officer, President/VP, and developers', async () => {
            prismaMocks.teamMemberFindMany.mockResolvedValue([adminOfficerMembership()]);
            expect(await getMemberDocumentRank(MEMBER_ID)).toBe('ORG_LEADERSHIP');

            prismaMocks.teamMemberFindMany.mockResolvedValue([adminPresidentMembership()]);
            expect(await getMemberDocumentRank(MEMBER_ID)).toBe('ORG_LEADERSHIP');

            prismaMocks.teamMemberFindMany.mockResolvedValue([]);
            expect(await getMemberDocumentRank(MEMBER_ID, { isDeveloper: true })).toBe(
                'ORG_LEADERSHIP',
            );
        });

        it('returns TEAM_LEADERSHIP for non-Admin Head/Vice', async () => {
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            expect(await getMemberDocumentRank(MEMBER_ID)).toBe('TEAM_LEADERSHIP');
        });
    });

    describe('getMemberTeamIds', () => {
        it('returns distinct non-Admin Head/Vice team ids', async () => {
            prismaMocks.teamMemberFindMany.mockResolvedValue([
                teamLeadershipMembership(TEAM_A),
                {
                    teamId: TEAM_A,
                    team: { name: `Team ${TEAM_A}` },
                    role: { roleName: 'Vice Head of Team', systemRoleKey: 2 },
                },
                adminOfficerMembership(),
            ]);
            expect(await getMemberTeamIds(MEMBER_ID)).toEqual([TEAM_A]);
        });
    });

    describe('canMemberViewDocument', () => {
        it('allows org leadership to see everything', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: CATEGORY_ID,
                scopeTeamId: 99,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([adminPresidentMembership()]);

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(true);
            expect(prismaMocks.documentAccessGrantFindFirst).not.toHaveBeenCalled();
            expect(prismaMocks.documentCategoryAccessGrantFindFirst).not.toHaveBeenCalled();
        });

        it('allows team-scoped access for same-team leadership', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: CATEGORY_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(true);
        });

        it('denies team-scoped access for other-team leadership without ACL', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: CATEGORY_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_B)]);

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(false);
        });

        it('allows via folder grant when natural access is missing', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: CATEGORY_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_B)]);
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue({ id: 1 });

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(true);
            expect(prismaMocks.documentAccessGrantFindFirst).not.toHaveBeenCalled();
        });

        it('allows via document TEAM grant when folder ACL is missing', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: CATEGORY_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_B)]);
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue({ id: 1 });

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(true);
            expect(prismaMocks.documentAccessGrantFindFirst).toHaveBeenCalled();
            const where = prismaMocks.documentAccessGrantFindFirst.mock.calls[0]?.[0]?.where;
            expect(where).toMatchObject({
                documentId: DOC_ID,
                revokedAt: null,
                grantedToType: 'TEAM',
                teamId: { in: [TEAM_B] },
            });
            expect(where.AND).toBeUndefined();
        });

        it('allows via TEAM document grant for Head/Vice of the granted team', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: null,
                scopeTeamId: null,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(7)]);
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue({ id: 2 });

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(true);
            const where = prismaMocks.documentAccessGrantFindFirst.mock.calls[0]?.[0]?.where;
            expect(where).toMatchObject({
                documentId: DOC_ID,
                revokedAt: null,
                grantedToType: 'TEAM',
                teamId: { in: [7] },
            });
        });

        it('denies TEAM document grant for plain members (MEMBER grants ignored)', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: null,
                scopeTeamId: null,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([plainMembership(7)]);
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue({ id: 2 });

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(false);
            expect(prismaMocks.documentAccessGrantFindFirst).not.toHaveBeenCalled();
        });

        it('denies access when no active grant matches', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                categoryId: null,
                scopeTeamId: null,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue(null);

            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(false);
        });

        it('returns false when document is missing', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue(null);
            expect(await canMemberViewDocument(MEMBER_ID, DOC_ID)).toBe(false);
            expect(prismaMocks.teamMemberFindMany).not.toHaveBeenCalled();
        });
    });

    describe('canMemberGrantDocument', () => {
        it('allows natural access only (not grant-only viewers)', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: DOC_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            expect(await canMemberGrantDocument(MEMBER_ID, DOC_ID)).toBe(true);

            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_B)]);
            expect(await canMemberGrantDocument(MEMBER_ID, DOC_ID)).toBe(false);
            expect(prismaMocks.documentAccessGrantFindFirst).not.toHaveBeenCalled();
        });
    });

    describe('canMemberViewCategory / canMemberGrantCategory', () => {
        it('allows Head/Vice of Team A to view and manage Team A–scoped folder', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
        });

        it('denies Head/Vice of Team A view/manage of Team B–scoped folder without grant', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_B,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(prismaMocks.documentCategoryAccessGrantFindFirst).toHaveBeenCalled();
        });

        it('allows org leadership to view and manage every folder (admin override)', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_B,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([adminOfficerMembership()]);

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(prismaMocks.documentCategoryAccessGrantFindFirst).not.toHaveBeenCalled();
        });

        it('allows org leadership to view/manage org-owned folders (scopeTeamId null)', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: null,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([adminPresidentMembership()]);

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
        });

        it('denies team leadership natural access to org-owned folders', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: null,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
        });

        it('allows grant-only recipients to view but not manage', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_B,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue({ id: 1 });

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(prismaMocks.documentCategoryAccessGrantFindFirst).toHaveBeenCalled();
        });

        it('file grant unlocks parent folder for view but not manage', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_B,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue(null);
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue({ id: 99 });

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);

            const where = prismaMocks.documentAccessGrantFindFirst.mock.calls[0]?.[0]?.where;
            expect(where).toMatchObject({
                revokedAt: null,
                grantedToType: 'TEAM',
                teamId: { in: [TEAM_A] },
                document: { categoryId: CATEGORY_ID },
            });
        });

        it('folder grant allows view of category without manage', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_B,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue({ id: 5 });

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(true);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(prismaMocks.documentAccessGrantFindFirst).not.toHaveBeenCalled();
        });

        it('denies plain members / no-rank users even with legacy category grants', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: CATEGORY_ID,
                scopeTeamId: TEAM_A,
            });
            prismaMocks.teamMemberFindMany.mockResolvedValue([plainMembership(7)]);
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue({ id: 1 });

            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(prismaMocks.documentCategoryAccessGrantFindFirst).not.toHaveBeenCalled();
        });

        it('returns false when category is missing', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue(null);
            expect(await canMemberViewCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(await canMemberGrantCategory(MEMBER_ID, CATEGORY_ID)).toBe(false);
            expect(prismaMocks.teamMemberFindMany).not.toHaveBeenCalled();
        });
    });

    describe('resolveScopeTeamId', () => {
        it('auto-picks sole led team for TEAM_LEADERSHIP when scope omitted', async () => {
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            const result = await resolveScopeTeamId(MEMBER_ID, 'TEAM_LEADERSHIP', undefined);
            expect(result).toEqual({ scopeTeamId: TEAM_A });
        });

        it('rejects TEAM_LEADERSHIP scope outside led teams', async () => {
            prismaMocks.teamMemberFindMany.mockResolvedValue([teamLeadershipMembership(TEAM_A)]);
            const result = await resolveScopeTeamId(MEMBER_ID, 'TEAM_LEADERSHIP', TEAM_B);
            expect(result.error).toMatch(/leadership teams/i);
            expect(result.status).toBe(403);
        });

        it('allows ORG_LEADERSHIP to omit scope (org-owned)', async () => {
            const result = await resolveScopeTeamId(MEMBER_ID, 'ORG_LEADERSHIP', undefined);
            expect(result).toEqual({ scopeTeamId: null });
        });

        it('allows ORG_LEADERSHIP to set a valid team scope', async () => {
            prismaMocks.teamFindUnique.mockResolvedValue({ id: TEAM_A });
            const result = await resolveScopeTeamId(MEMBER_ID, 'ORG_LEADERSHIP', TEAM_A);
            expect(result).toEqual({ scopeTeamId: TEAM_A });
        });
    });
});
