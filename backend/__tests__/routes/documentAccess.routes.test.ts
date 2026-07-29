import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRouteApp } from './testHarness';

const prismaMocks = vi.hoisted(() => ({
    teamFindUnique: vi.fn(),
    documentFindUnique: vi.fn(),
    documentAccessGrantCreate: vi.fn(),
    documentAccessGrantFindFirst: vi.fn(),
    documentAccessGrantUpdate: vi.fn(),
    documentAccessRequestFindUnique: vi.fn(),
    documentAccessRequestFindFirst: vi.fn(),
    documentAccessRequestCreate: vi.fn(),
    documentAccessRequestUpdate: vi.fn(),
    documentAccessRequestFindMany: vi.fn(),
    documentAccessLogFindMany: vi.fn(),
    memberFindUnique: vi.fn(),
    teamMemberFindMany: vi.fn(),
    teamMemberFindFirst: vi.fn(),
    transaction: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
    canMemberGrantDocument: vi.fn(),
    canMemberViewDocument: vi.fn(),
    getMemberDocumentRank: vi.fn(),
    getMemberTeamIds: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({
    emitNotificationEvent: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        team: { findUnique: prismaMocks.teamFindUnique },
        document: { findUnique: prismaMocks.documentFindUnique },
        documentAccessGrant: {
            create: prismaMocks.documentAccessGrantCreate,
            findFirst: prismaMocks.documentAccessGrantFindFirst,
            update: prismaMocks.documentAccessGrantUpdate,
        },
        documentAccessRequest: {
            findUnique: prismaMocks.documentAccessRequestFindUnique,
            findFirst: prismaMocks.documentAccessRequestFindFirst,
            create: prismaMocks.documentAccessRequestCreate,
            update: prismaMocks.documentAccessRequestUpdate,
            findMany: prismaMocks.documentAccessRequestFindMany,
        },
        documentAccessLog: {
            findMany: prismaMocks.documentAccessLogFindMany,
        },
        member: { findUnique: prismaMocks.memberFindUnique },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
            findFirst: prismaMocks.teamMemberFindFirst,
        },
        $transaction: prismaMocks.transaction,
    },
}));

vi.mock('../../lib/documentPermissions', () => permissionMocks);
vi.mock('../../services/notificationService', () => notificationMocks);

import documentAccessRouter from '../../routes/documentAccess';

describe('documentAccess routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        permissionMocks.canMemberGrantDocument.mockResolvedValue(true);
        permissionMocks.canMemberViewDocument.mockResolvedValue(false);
        permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
        permissionMocks.getMemberTeamIds.mockResolvedValue([7]);
        notificationMocks.emitNotificationEvent.mockResolvedValue(undefined);
        prismaMocks.teamMemberFindMany.mockResolvedValue([]);
    });

    describe('POST /:id/grants', () => {
        it('rejects MEMBER grants with 400', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app)
                .post('/10/grants')
                .send({
                    grantedToType: 'MEMBER',
                    memberId: 12,
                    durationPreset: 'WEEK',
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/TEAM/i);
            expect(prismaMocks.documentAccessGrantCreate).not.toHaveBeenCalled();
        });

        it('creates TEAM grants', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            prismaMocks.teamFindUnique.mockResolvedValue({ id: 3 });
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue(null);
            prismaMocks.documentAccessGrantCreate.mockResolvedValue({
                id: 1,
                grantedToType: 'TEAM',
                teamId: 3,
                memberId: null,
            });
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app)
                .post('/10/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 3,
                    durationPreset: 'WEEK',
                });

            expect(res.status).toBe(201);
            expect(prismaMocks.documentAccessGrantCreate).toHaveBeenCalledWith(
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
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            prismaMocks.teamFindUnique.mockResolvedValue({ id: 3 });
            prismaMocks.documentAccessGrantFindFirst.mockResolvedValue({
                id: 42,
                documentId: 10,
                teamId: 3,
                revokedAt: null,
                expiresAt: null,
            });
            prismaMocks.documentAccessGrantUpdate.mockResolvedValue({
                id: 42,
                documentId: 10,
                grantedToType: 'TEAM',
                teamId: 3,
                grantedById: 1,
                expiresAt: expect.any(Date),
            });
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app)
                .post('/10/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 3,
                    durationPreset: 'MONTH',
                });

            expect(res.status).toBe(200);
            expect(prismaMocks.documentAccessGrantCreate).not.toHaveBeenCalled();
            expect(prismaMocks.documentAccessGrantUpdate).toHaveBeenCalledWith(
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
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            prismaMocks.teamFindUnique.mockResolvedValue({ id: 7 });
            permissionMocks.getMemberTeamIds.mockResolvedValue([7, 8]);
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app)
                .post('/10/grants')
                .send({
                    grantedToType: 'TEAM',
                    teamId: 7,
                    durationPreset: 'WEEK',
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/own team/i);
            expect(prismaMocks.documentAccessGrantCreate).not.toHaveBeenCalled();
        });
    });

    describe('POST /:id/access-requests', () => {
        it('requires TEAM_LEADERSHIP rank', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: 10,
                title: 'Doc',
                scopeTeamId: null,
            });
            permissionMocks.getMemberDocumentRank.mockResolvedValue(null);
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app).post('/10/access-requests').send({});

            expect(res.status).toBe(403);
            expect(prismaMocks.documentAccessRequestCreate).not.toHaveBeenCalled();
        });

        it('allows TEAM_LEADERSHIP to request', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({
                id: 10,
                title: 'Doc',
                scopeTeamId: null,
            });
            prismaMocks.documentAccessRequestFindFirst.mockResolvedValue(null);
            prismaMocks.documentAccessRequestCreate.mockResolvedValue({
                id: 5,
                documentId: 10,
                memberId: 1,
                status: 'PENDING',
            });
            prismaMocks.memberFindUnique.mockResolvedValue({ fullName: 'Head' });
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app).post('/10/access-requests').send({});

            expect(res.status).toBe(201);
            expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.stringContaining('team leadership access'),
                }),
            );
        });
    });

    describe('GET /access-requests', () => {
        it('returns 403 when rank is null', async () => {
            permissionMocks.getMemberDocumentRank.mockResolvedValue(null);
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app).get('/access-requests');

            expect(res.status).toBe(403);
            expect(prismaMocks.documentAccessRequestFindMany).not.toHaveBeenCalled();
        });
    });

    describe('PATCH /access-requests/:id/approve', () => {
        it('creates TEAM grants for each led team of the requester', async () => {
            prismaMocks.documentAccessRequestFindUnique.mockResolvedValue({
                id: 9,
                documentId: 10,
                memberId: 2,
                status: 'PENDING',
            });
            permissionMocks.getMemberTeamIds.mockResolvedValue([7, 8]);
            const grant7 = { id: 1, teamId: 7, grantedToType: 'TEAM' };
            const grant8 = { id: 2, teamId: 8, grantedToType: 'TEAM' };
            prismaMocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
                const tx = {
                    documentAccessGrant: {
                        findFirst: vi.fn().mockResolvedValue(null),
                        create: vi
                            .fn()
                            .mockResolvedValueOnce(grant7)
                            .mockResolvedValueOnce(grant8),
                        update: vi.fn(),
                    },
                    documentAccessRequest: {
                        update: vi.fn().mockResolvedValue({
                            id: 9,
                            status: 'APPROVED',
                        }),
                    },
                };
                return fn(tx);
            });
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app)
                .patch('/access-requests/9/approve')
                .send({ durationPreset: 'WEEK' });

            expect(res.status).toBe(200);
            expect(res.body.grants).toHaveLength(2);
            expect(res.body.grants[0]).toMatchObject({ grantedToType: 'TEAM', teamId: 7 });
            expect(res.body.request.status).toBe('APPROVED');
        });

        it('returns 400 when requester leads no teams', async () => {
            prismaMocks.documentAccessRequestFindUnique.mockResolvedValue({
                id: 9,
                documentId: 10,
                memberId: 2,
                status: 'PENDING',
            });
            permissionMocks.getMemberTeamIds.mockResolvedValue([]);
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app)
                .patch('/access-requests/9/approve')
                .send({ durationPreset: 'WEEK' });

            expect(res.status).toBe(400);
            expect(prismaMocks.transaction).not.toHaveBeenCalled();
        });
    });

    describe('GET /:id/access-log', () => {
        it('returns 403 for grant-only viewers', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            permissionMocks.canMemberGrantDocument.mockResolvedValue(false);
            const app = buildRouteApp(documentAccessRouter, { memberId: 200 });

            const res = await request(app).get('/10/access-log');

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/access denied/i);
            expect(prismaMocks.documentAccessLogFindMany).not.toHaveBeenCalled();
        });

        it('returns access log for document owner', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            permissionMocks.canMemberGrantDocument.mockResolvedValue(true);
            prismaMocks.documentAccessLogFindMany.mockResolvedValue([
                {
                    id: 1,
                    documentId: 10,
                    action: 'VIEW',
                    member: { id: 3, fullName: 'Viewer' },
                },
            ]);
            const app = buildRouteApp(documentAccessRouter, { memberId: 100 });

            const res = await request(app).get('/10/access-log');

            expect(res.status).toBe(200);
            expect(res.body.accessLogs).toHaveLength(1);
            expect(res.body.accessLogs[0].member.fullName).toBe('Viewer');
            expect(res.body.nextCursor).toBeNull();
        });

        it('returns access log for org leadership', async () => {
            prismaMocks.documentFindUnique.mockResolvedValue({ id: 10 });
            permissionMocks.canMemberGrantDocument.mockResolvedValue(true);
            permissionMocks.getMemberDocumentRank.mockResolvedValue('ORG_LEADERSHIP');
            prismaMocks.documentAccessLogFindMany.mockResolvedValue([]);
            const app = buildRouteApp(documentAccessRouter, { memberId: 1 });

            const res = await request(app).get('/10/access-log');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ accessLogs: [], nextCursor: null });
        });
    });
});
