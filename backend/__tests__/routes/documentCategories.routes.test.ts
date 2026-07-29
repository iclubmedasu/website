import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRouteApp } from './testHarness';

const prismaMocks = vi.hoisted(() => ({
    documentCategoryFindMany: vi.fn(),
    documentCategoryFindUnique: vi.fn(),
    documentCategoryCreate: vi.fn(),
    documentCategoryUpdate: vi.fn(),
    documentCategoryDelete: vi.fn(),
    documentCount: vi.fn(),
    documentCategoryAccessGrantCreate: vi.fn(),
    documentCategoryAccessGrantFindFirst: vi.fn(),
    documentCategoryAccessGrantUpdate: vi.fn(),
    documentCategoryAccessRequestFindMany: vi.fn(),
    documentCategoryAccessRequestFindUnique: vi.fn(),
    documentCategoryAccessRequestFindFirst: vi.fn(),
    documentCategoryAccessRequestCreate: vi.fn(),
    documentCategoryAccessRequestUpdate: vi.fn(),
    teamFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
    teamMemberFindMany: vi.fn(),
    transaction: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
    canMemberGrantCategory: vi.fn(),
    canMemberViewCategory: vi.fn(),
    getMemberDocumentRank: vi.fn(),
    getMemberTeamIds: vi.fn(),
    resolveScopeTeamId: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({
    emitNotificationEvent: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        documentCategory: {
            findMany: prismaMocks.documentCategoryFindMany,
            findUnique: prismaMocks.documentCategoryFindUnique,
            create: prismaMocks.documentCategoryCreate,
            update: prismaMocks.documentCategoryUpdate,
            delete: prismaMocks.documentCategoryDelete,
        },
        document: {
            count: prismaMocks.documentCount,
        },
        documentCategoryAccessGrant: {
            create: prismaMocks.documentCategoryAccessGrantCreate,
            findFirst: prismaMocks.documentCategoryAccessGrantFindFirst,
            update: prismaMocks.documentCategoryAccessGrantUpdate,
        },
        documentCategoryAccessRequest: {
            findMany: prismaMocks.documentCategoryAccessRequestFindMany,
            findUnique: prismaMocks.documentCategoryAccessRequestFindUnique,
            findFirst: prismaMocks.documentCategoryAccessRequestFindFirst,
            create: prismaMocks.documentCategoryAccessRequestCreate,
            update: prismaMocks.documentCategoryAccessRequestUpdate,
        },
        team: { findUnique: prismaMocks.teamFindUnique },
        member: { findUnique: prismaMocks.memberFindUnique },
        teamMember: { findMany: prismaMocks.teamMemberFindMany },
        $transaction: prismaMocks.transaction,
    },
}));

vi.mock('../../lib/documentPermissions', () => permissionMocks);
vi.mock('../../services/notificationService', () => notificationMocks);

import documentCategoriesRouter from '../../routes/documentCategories';

describe('documentCategories routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        permissionMocks.getMemberDocumentRank.mockResolvedValue('ORG_LEADERSHIP');
        permissionMocks.canMemberGrantCategory.mockResolvedValue(true);
        permissionMocks.canMemberViewCategory.mockResolvedValue(true);
        permissionMocks.getMemberTeamIds.mockResolvedValue([]);
        permissionMocks.resolveScopeTeamId.mockResolvedValue({ scopeTeamId: null });
        notificationMocks.emitNotificationEvent.mockResolvedValue(undefined);
        prismaMocks.teamMemberFindMany.mockResolvedValue([]);
    });

    describe('GET /', () => {
        it('returns 403 when rank is null', async () => {
            permissionMocks.getMemberDocumentRank.mockResolvedValue(null);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app).get('/');

            expect(res.status).toBe(403);
            expect(prismaMocks.documentCategoryFindMany).not.toHaveBeenCalled();
        });

        it('returns locked stub for inaccessible folders and canManageAccess for owned ones', async () => {
            const teamAFolder = {
                id: 1,
                name: 'Team A folder',
                order: 0,
                scopeTeamId: 5,
            };
            const teamBFolder = {
                id: 2,
                name: 'Team B folder',
                order: 1,
                scopeTeamId: 6,
            };
            prismaMocks.documentCategoryFindMany.mockResolvedValue([teamAFolder, teamBFolder]);

            // Team A Head: can view+manage own folder; locked stub for Team B
            permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
            permissionMocks.canMemberViewCategory
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);
            permissionMocks.canMemberGrantCategory.mockResolvedValueOnce(true);

            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });
            const res = await request(app).get('/');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([
                { ...teamAFolder, canManageAccess: true },
                { id: 2, name: 'Team B folder', locked: true },
            ]);
            expect(res.body[1].scopeTeamId).toBeUndefined();
            expect(res.body[1].canManageAccess).toBeUndefined();
        });

        it('includes canManageAccess false for grant-only viewers', async () => {
            const folder = {
                id: 3,
                name: 'Granted folder',
                order: 0,
                scopeTeamId: 6,
            };
            prismaMocks.documentCategoryFindMany.mockResolvedValue([folder]);
            permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
            permissionMocks.canMemberViewCategory.mockResolvedValue(true);
            permissionMocks.canMemberGrantCategory.mockResolvedValue(false);

            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });
            const res = await request(app).get('/');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ ...folder, canManageAccess: false }]);
        });

        it('org leadership sees full folders with canManageAccess true', async () => {
            const folder = {
                id: 4,
                name: 'Any team folder',
                order: 0,
                scopeTeamId: 99,
            };
            prismaMocks.documentCategoryFindMany.mockResolvedValue([folder]);
            permissionMocks.canMemberViewCategory.mockResolvedValue(true);
            permissionMocks.canMemberGrantCategory.mockResolvedValue(true);

            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });
            const res = await request(app).get('/');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ ...folder, canManageAccess: true }]);
        });
    });

    describe('POST /', () => {
        it('creates a category with resolved scopeTeamId', async () => {
            permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
            permissionMocks.resolveScopeTeamId.mockResolvedValue({ scopeTeamId: 5 });
            prismaMocks.documentCategoryCreate.mockResolvedValue({
                id: 1,
                name: 'Policies',
                order: 0,
                scopeTeamId: 5,
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .post('/')
                .send({ name: 'Policies', scopeTeamId: 5 });

            expect(res.status).toBe(201);
            expect(permissionMocks.resolveScopeTeamId).toHaveBeenCalledWith(
                1,
                'TEAM_LEADERSHIP',
                5,
            );
            expect(prismaMocks.documentCategoryCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: 'Policies',
                        scopeTeamId: 5,
                    }),
                }),
            );
        });

        it('propagates resolveScopeTeamId errors', async () => {
            permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
            permissionMocks.resolveScopeTeamId.mockResolvedValue({
                scopeTeamId: null,
                error: 'scopeTeamId must be one of your leadership teams',
                status: 403,
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .post('/')
                .send({ name: 'Nope', scopeTeamId: 99 });

            expect(res.status).toBe(403);
            expect(prismaMocks.documentCategoryCreate).not.toHaveBeenCalled();
        });
    });

    describe('PUT /:id', () => {
        it('allows owner to rename', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Old',
                scopeTeamId: 5,
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(true);
            prismaMocks.documentCategoryUpdate.mockResolvedValue({
                id: 5,
                name: 'New',
                scopeTeamId: 5,
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app).put('/5').send({ name: 'New' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New');
        });

        it('returns 403 when caller lacks ownership', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Team B folder',
                scopeTeamId: 6,
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(false);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });

            const res = await request(app).put('/5').send({ name: 'Hijack' });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/ownership/i);
            expect(prismaMocks.documentCategoryUpdate).not.toHaveBeenCalled();
        });
    });

    describe('DELETE /:id', () => {
        it('allows owner to delete empty folder', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Empty',
                scopeTeamId: 5,
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(true);
            prismaMocks.documentCount.mockResolvedValue(0);
            prismaMocks.documentCategoryDelete.mockResolvedValue({});
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app).delete('/5');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true });
        });

        it('returns 403 when caller lacks ownership', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Team B folder',
                scopeTeamId: 6,
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(false);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });

            const res = await request(app).delete('/5');

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/ownership/i);
            expect(prismaMocks.documentCategoryDelete).not.toHaveBeenCalled();
        });
    });

    describe('POST /:id/grants', () => {
        it('rejects MEMBER grants with 400', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({ id: 5 });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .post('/5/grants')
                .send({
                    grantedToType: 'MEMBER',
                    memberId: 12,
                    durationPreset: 'WEEK',
                });

            expect(res.status).toBe(400);
            expect(prismaMocks.documentCategoryAccessGrantCreate).not.toHaveBeenCalled();
        });

        it('creates TEAM category grants', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({ id: 5 });
            prismaMocks.teamFindUnique.mockResolvedValue({ id: 3 });
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue(null);
            prismaMocks.documentCategoryAccessGrantCreate.mockResolvedValue({
                id: 1,
                grantedToType: 'TEAM',
                teamId: 3,
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .post('/5/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 3,
                    durationPreset: 'INDEFINITE',
                });

            expect(res.status).toBe(201);
            expect(prismaMocks.documentCategoryAccessGrantCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        grantedToType: 'TEAM',
                        teamId: 3,
                        memberId: null,
                    }),
                }),
            );
        });

        it('updates existing active TEAM grant instead of creating a duplicate', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({ id: 5 });
            prismaMocks.teamFindUnique.mockResolvedValue({ id: 3 });
            prismaMocks.documentCategoryAccessGrantFindFirst.mockResolvedValue({
                id: 42,
                categoryId: 5,
                teamId: 3,
                revokedAt: null,
                expiresAt: null,
            });
            prismaMocks.documentCategoryAccessGrantUpdate.mockResolvedValue({
                id: 42,
                categoryId: 5,
                grantedToType: 'TEAM',
                teamId: 3,
                grantedById: 1,
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .post('/5/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 3,
                    durationPreset: 'MONTH',
                });

            expect(res.status).toBe(200);
            expect(prismaMocks.documentCategoryAccessGrantCreate).not.toHaveBeenCalled();
            expect(prismaMocks.documentCategoryAccessGrantUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 42 },
                    data: expect.objectContaining({
                        grantedById: 1,
                        expiresAt: expect.any(Date),
                    }),
                }),
            );
            expect(res.body).toMatchObject({ id: 42, teamId: 3 });
        });

        it('rejects grants to the granter\'s own led team', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({ id: 5 });
            prismaMocks.teamFindUnique.mockResolvedValue({ id: 7 });
            permissionMocks.getMemberTeamIds.mockResolvedValue([7]);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .post('/5/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 7,
                    durationPreset: 'WEEK',
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/own team/i);
            expect(prismaMocks.documentCategoryAccessGrantCreate).not.toHaveBeenCalled();
        });

        it('returns 403 when grant-only recipient tries to grant', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({ id: 5 });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(false);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });

            const res = await request(app)
                .post('/5/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 3,
                    durationPreset: 'WEEK',
                });

            expect(res.status).toBe(403);
            expect(prismaMocks.documentCategoryAccessGrantCreate).not.toHaveBeenCalled();
        });
    });

    describe('POST /:id/access-requests', () => {
        it('requires TEAM_LEADERSHIP rank', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Folder',
                scopeTeamId: null,
            });
            permissionMocks.getMemberDocumentRank.mockResolvedValue('ORG_LEADERSHIP');
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app).post('/5/access-requests').send({});

            expect(res.status).toBe(403);
            expect(prismaMocks.documentCategoryAccessRequestCreate).not.toHaveBeenCalled();
        });

        it('allows TEAM_LEADERSHIP to request when locked', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Team B folder',
                scopeTeamId: 6,
            });
            permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
            permissionMocks.canMemberViewCategory.mockResolvedValue(false);
            prismaMocks.documentCategoryAccessRequestFindFirst.mockResolvedValue(null);
            prismaMocks.documentCategoryAccessRequestCreate.mockResolvedValue({
                id: 9,
                categoryId: 5,
                memberId: 100,
                status: 'PENDING',
            });
            prismaMocks.memberFindUnique.mockResolvedValue({ fullName: 'Head A' });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });

            const res = await request(app).post('/5/access-requests').send({ note: 'Need it' });

            expect(res.status).toBe(201);
            expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'DOCUMENT_ACCESS_REQUESTED',
                    body: expect.stringContaining('folder'),
                }),
            );
        });

        it('rejects when caller already has access', async () => {
            prismaMocks.documentCategoryFindUnique.mockResolvedValue({
                id: 5,
                name: 'Own folder',
                scopeTeamId: 5,
            });
            permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
            permissionMocks.canMemberViewCategory.mockResolvedValue(true);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });

            const res = await request(app).post('/5/access-requests').send({});

            expect(res.status).toBe(400);
            expect(prismaMocks.documentCategoryAccessRequestCreate).not.toHaveBeenCalled();
        });
    });

    describe('GET /access-requests', () => {
        it('returns 403 when rank is null', async () => {
            permissionMocks.getMemberDocumentRank.mockResolvedValue(null);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app).get('/access-requests');

            expect(res.status).toBe(403);
            expect(prismaMocks.documentCategoryAccessRequestFindMany).not.toHaveBeenCalled();
        });

        it('filters to requests the viewer can grant', async () => {
            prismaMocks.documentCategoryAccessRequestFindMany.mockResolvedValue([
                { id: 1, categoryId: 10, status: 'PENDING' },
                { id: 2, categoryId: 20, status: 'PENDING' },
            ]);
            permissionMocks.canMemberGrantCategory
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });
            const res = await request(app).get('/access-requests');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].id).toBe(1);
        });
    });

    describe('PATCH /access-requests/:id/approve', () => {
        it('creates TEAM grants for each led team of the requester', async () => {
            prismaMocks.documentCategoryAccessRequestFindUnique.mockResolvedValue({
                id: 9,
                categoryId: 5,
                memberId: 2,
                status: 'PENDING',
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(true);
            permissionMocks.getMemberTeamIds.mockResolvedValue([7, 8]);
            const grant7 = { id: 1, teamId: 7, grantedToType: 'TEAM' };
            const grant8 = { id: 2, teamId: 8, grantedToType: 'TEAM' };
            prismaMocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
                const tx = {
                    documentCategoryAccessGrant: {
                        findFirst: vi.fn().mockResolvedValue(null),
                        create: vi
                            .fn()
                            .mockResolvedValueOnce(grant7)
                            .mockResolvedValueOnce(grant8),
                        update: vi.fn(),
                    },
                    documentCategoryAccessRequest: {
                        update: vi.fn().mockResolvedValue({
                            id: 9,
                            status: 'APPROVED',
                        }),
                    },
                };
                return fn(tx);
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .patch('/access-requests/9/approve')
                .send({ durationPreset: 'WEEK' });

            expect(res.status).toBe(200);
            expect(res.body.grants).toHaveLength(2);
            expect(res.body.grants[0]).toMatchObject({ grantedToType: 'TEAM', teamId: 7 });
            expect(res.body.request.status).toBe('APPROVED');
        });

        it('returns 403 when reviewer cannot manage the folder', async () => {
            prismaMocks.documentCategoryAccessRequestFindUnique.mockResolvedValue({
                id: 9,
                categoryId: 5,
                memberId: 2,
                status: 'PENDING',
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(false);
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 100 });

            const res = await request(app)
                .patch('/access-requests/9/approve')
                .send({ durationPreset: 'WEEK' });

            expect(res.status).toBe(403);
            expect(prismaMocks.transaction).not.toHaveBeenCalled();
        });
    });

    describe('PATCH /access-requests/:id/deny', () => {
        it('denies a pending request', async () => {
            prismaMocks.documentCategoryAccessRequestFindUnique.mockResolvedValue({
                id: 9,
                categoryId: 5,
                memberId: 2,
                status: 'PENDING',
            });
            permissionMocks.canMemberGrantCategory.mockResolvedValue(true);
            prismaMocks.documentCategoryAccessRequestUpdate.mockResolvedValue({
                id: 9,
                status: 'DENIED',
                reviewNote: 'Not now',
            });
            const app = buildRouteApp(documentCategoriesRouter, { memberId: 1 });

            const res = await request(app)
                .patch('/access-requests/9/deny')
                .send({ reviewNote: 'Not now' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('DENIED');
            expect(prismaMocks.documentCategoryAccessRequestUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'DENIED',
                        reviewNote: 'Not now',
                    }),
                }),
            );
        });
    });
});
