import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRouteApp } from './testHarness';

const prismaMocks = vi.hoisted(() => ({
    documentFindMany: vi.fn(),
    documentFindUnique: vi.fn(),
    documentCreate: vi.fn(),
    documentUpdate: vi.fn(),
    documentDelete: vi.fn(),
    documentCategoryFindUnique: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
    canMemberGrantCategory: vi.fn(),
    canMemberGrantDocument: vi.fn(),
    canMemberViewDocument: vi.fn(),
    getMemberDocumentRank: vi.fn(),
    getMemberTeamIds: vi.fn(),
    resolveScopeTeamId: vi.fn(),
    requireDocumentAccess: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

const githubMocks = vi.hoisted(() => ({
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
    getCurrentFileSha: vi.fn(),
    uploadContent: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        document: {
            findMany: prismaMocks.documentFindMany,
            findUnique: prismaMocks.documentFindUnique,
            create: prismaMocks.documentCreate,
            update: prismaMocks.documentUpdate,
            delete: prismaMocks.documentDelete,
        },
        documentCategory: {
            findUnique: prismaMocks.documentCategoryFindUnique,
        },
        teamMember: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock('../../lib/documentPermissions', () => permissionMocks);
vi.mock('../../services/githubStorageService', () => githubMocks);

import documentsRouter from '../../routes/documents';

describe('documents list routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        permissionMocks.resolveScopeTeamId.mockResolvedValue({ scopeTeamId: null });
        githubMocks.uploadContent.mockResolvedValue(undefined);
        githubMocks.getCurrentFileSha.mockResolvedValue(null);
    });

    it('GET / returns 403 when rank is null', async () => {
        permissionMocks.getMemberDocumentRank.mockResolvedValue(null);
        const app = buildRouteApp(documentsRouter, { memberId: 1 });

        const res = await request(app).get('/');

        expect(res.status).toBe(403);
        expect(prismaMocks.documentFindMany).not.toHaveBeenCalled();
    });

    it('GET / lists when ranked with canManageAccess', async () => {
        permissionMocks.getMemberDocumentRank.mockResolvedValue('ORG_LEADERSHIP');
        prismaMocks.documentFindMany.mockResolvedValue([
            { id: 1, title: 'Doc', categoryId: null },
        ]);
        permissionMocks.canMemberViewDocument.mockResolvedValue(true);
        permissionMocks.canMemberGrantDocument.mockResolvedValue(true);
        const app = buildRouteApp(documentsRouter, { memberId: 1 });

        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].canManageAccess).toBe(true);
    });

    it('GET / returns locked stub for cross-team Head and full doc for scope-team Head', async () => {
        const teamADoc = {
            id: 10,
            title: 'Team A secrets',
            categoryId: null,
            scopeTeamId: 1,
            fileUrl: 'https://example.com/a.pdf',
            fileType: 'application/pdf',
        };

        permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
        prismaMocks.documentFindMany.mockResolvedValue([teamADoc]);

        // Team B Head cannot view Team A–scoped doc → locked stub
        permissionMocks.canMemberViewDocument.mockResolvedValueOnce(false);
        const teamBApp = buildRouteApp(documentsRouter, { memberId: 200 });
        const teamBRes = await request(teamBApp).get('/');

        expect(teamBRes.status).toBe(200);
        expect(teamBRes.body).toEqual([
            {
                id: 10,
                title: 'Team A secrets',
                categoryId: null,
                locked: true,
            },
        ]);
        expect(teamBRes.body[0].fileUrl).toBeUndefined();
        expect(teamBRes.body[0].canManageAccess).toBeUndefined();

        // Team A Head can view → full payload with canManageAccess
        permissionMocks.canMemberViewDocument.mockResolvedValueOnce(true);
        permissionMocks.canMemberGrantDocument.mockResolvedValueOnce(true);
        const teamAApp = buildRouteApp(documentsRouter, { memberId: 100 });
        const teamARes = await request(teamAApp).get('/');

        expect(teamARes.status).toBe(200);
        expect(teamARes.body).toHaveLength(1);
        expect(teamARes.body[0]).toMatchObject({ ...teamADoc, canManageAccess: true });
        expect(teamARes.body[0].locked).not.toBe(true);
    });

    it('GET / sets canManageAccess false for grant-only viewers', async () => {
        permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
        prismaMocks.documentFindMany.mockResolvedValue([
            { id: 11, title: 'Granted', categoryId: null, scopeTeamId: 2 },
        ]);
        permissionMocks.canMemberViewDocument.mockResolvedValue(true);
        permissionMocks.canMemberGrantDocument.mockResolvedValue(false);
        const app = buildRouteApp(documentsRouter, { memberId: 200 });

        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.body[0]).toMatchObject({
            id: 11,
            canManageAccess: false,
        });
        expect(res.body[0].locked).not.toBe(true);
    });

    it('GET /?categoryId= omits non-viewable docs (file-grant partial listing)', async () => {
        const granted = {
            id: 21,
            title: 'Granted file',
            categoryId: 20,
            scopeTeamId: 5,
            fileUrl: 'documents/21/a.pdf',
        };
        const hidden = {
            id: 22,
            title: 'Other file',
            categoryId: 20,
            scopeTeamId: 5,
            fileUrl: 'documents/22/b.pdf',
        };

        permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
        prismaMocks.documentFindMany.mockResolvedValue([granted, hidden]);
        permissionMocks.canMemberViewDocument
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        permissionMocks.canMemberGrantDocument.mockResolvedValue(false);
        const app = buildRouteApp(documentsRouter, { memberId: 200 });

        const res = await request(app).get('/').query({ categoryId: 20 });

        expect(res.status).toBe(200);
        expect(prismaMocks.documentFindMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { categoryId: 20 } }),
        );
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({
            id: 21,
            title: 'Granted file',
            canManageAccess: false,
        });
        expect(res.body[0].locked).not.toBe(true);
        expect(res.body.find((d: { id: number }) => d.id === 22)).toBeUndefined();
    });

    it('GET /?categoryId= returns all docs view-only for folder-grant visitors', async () => {
        const docs = [
            { id: 31, title: 'A', categoryId: 20, scopeTeamId: 5 },
            { id: 32, title: 'B', categoryId: 20, scopeTeamId: 5 },
        ];
        permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
        prismaMocks.documentFindMany.mockResolvedValue(docs);
        permissionMocks.canMemberViewDocument.mockResolvedValue(true);
        permissionMocks.canMemberGrantDocument.mockResolvedValue(false);
        const app = buildRouteApp(documentsRouter, { memberId: 200 });

        const res = await request(app).get('/').query({ categoryId: 20 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.every((d: { canManageAccess: boolean }) => d.canManageAccess === false)).toBe(
            true,
        );
        expect(res.body.every((d: { locked?: boolean }) => d.locked !== true)).toBe(true);
    });
});

describe('documents upload / mutate ownership gates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        permissionMocks.getMemberDocumentRank.mockResolvedValue('TEAM_LEADERSHIP');
        permissionMocks.resolveScopeTeamId.mockResolvedValue({ scopeTeamId: 7 });
        permissionMocks.canMemberGrantCategory.mockResolvedValue(true);
        permissionMocks.canMemberGrantDocument.mockResolvedValue(true);
        prismaMocks.documentCategoryFindUnique.mockResolvedValue({ id: 20, name: 'Folder' });
        githubMocks.uploadContent.mockResolvedValue(undefined);
        githubMocks.getCurrentFileSha.mockResolvedValue(null);
    });

    it('POST / into foreign folder returns 403', async () => {
        permissionMocks.canMemberGrantCategory.mockResolvedValue(false);
        const app = buildRouteApp(documentsRouter, { memberId: 200 });

        const res = await request(app)
            .post('/')
            .send({
                title: 'New doc',
                categoryId: 20,
                fileBase64: Buffer.from('hello').toString('base64'),
                fileName: 'hello.txt',
                mimeType: 'text/plain',
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/upload into this folder/i);
        expect(prismaMocks.documentCreate).not.toHaveBeenCalled();
    });

    it('POST / into owned folder returns 201 for owner', async () => {
        prismaMocks.documentCreate.mockResolvedValue({
            id: 50,
            title: 'New doc',
            categoryId: 20,
            fileUrl: 'pending',
        });
        prismaMocks.documentUpdate.mockResolvedValue({
            id: 50,
            title: 'New doc',
            categoryId: 20,
            fileUrl: 'documents/50/hello.txt',
            fileType: 'text/plain',
            fileSizeBytes: 5,
        });
        const app = buildRouteApp(documentsRouter, { memberId: 100 });

        const res = await request(app)
            .post('/')
            .send({
                title: 'New doc',
                categoryId: 20,
                fileBase64: Buffer.from('hello').toString('base64'),
                fileName: 'hello.txt',
                mimeType: 'text/plain',
            });

        expect(res.status).toBe(201);
        expect(permissionMocks.canMemberGrantCategory).toHaveBeenCalledWith(
            100,
            20,
            expect.anything(),
        );
        expect(res.body).toMatchObject({ id: 50, title: 'New doc' });
    });

    it('POST / into folder returns 201 for org leadership', async () => {
        permissionMocks.getMemberDocumentRank.mockResolvedValue('ORG_LEADERSHIP');
        permissionMocks.resolveScopeTeamId.mockResolvedValue({ scopeTeamId: null });
        prismaMocks.documentCreate.mockResolvedValue({
            id: 51,
            title: 'Org upload',
            categoryId: 20,
            fileUrl: 'pending',
        });
        prismaMocks.documentUpdate.mockResolvedValue({
            id: 51,
            title: 'Org upload',
            categoryId: 20,
            fileUrl: 'documents/51/org.txt',
        });
        const app = buildRouteApp(documentsRouter, { memberId: 1 });

        const res = await request(app)
            .post('/')
            .send({
                title: 'Org upload',
                categoryId: 20,
                fileBase64: Buffer.from('org').toString('base64'),
                fileName: 'org.txt',
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(51);
    });

    it('PATCH /:id returns 403 for grant-only viewers', async () => {
        prismaMocks.documentFindUnique.mockResolvedValue({
            id: 10,
            title: 'Doc',
            categoryId: 20,
        });
        permissionMocks.canMemberGrantDocument.mockResolvedValue(false);
        const app = buildRouteApp(documentsRouter, { memberId: 200 });

        const res = await request(app).patch('/10').send({ title: 'Renamed' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/update this document/i);
        expect(prismaMocks.documentUpdate).not.toHaveBeenCalled();
    });

    it('PATCH /:id succeeds for owner', async () => {
        prismaMocks.documentFindUnique.mockResolvedValue({
            id: 10,
            title: 'Doc',
            categoryId: 20,
        });
        prismaMocks.documentUpdate.mockResolvedValue({
            id: 10,
            title: 'Renamed',
            categoryId: 20,
        });
        const app = buildRouteApp(documentsRouter, { memberId: 100 });

        const res = await request(app).patch('/10').send({ title: 'Renamed' });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Renamed');
    });

    it('DELETE /:id returns 403 for grant-only viewers', async () => {
        prismaMocks.documentFindUnique.mockResolvedValue({
            id: 10,
            title: 'Doc',
            fileUrl: 'pending',
        });
        permissionMocks.canMemberGrantDocument.mockResolvedValue(false);
        const app = buildRouteApp(documentsRouter, { memberId: 200 });

        const res = await request(app).delete('/10');

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/delete this document/i);
        expect(prismaMocks.documentDelete).not.toHaveBeenCalled();
    });

    it('DELETE /:id succeeds for org leadership', async () => {
        permissionMocks.getMemberDocumentRank.mockResolvedValue('ORG_LEADERSHIP');
        prismaMocks.documentFindUnique.mockResolvedValue({
            id: 10,
            title: 'Doc',
            fileUrl: 'pending',
        });
        prismaMocks.documentDelete.mockResolvedValue({ id: 10 });
        const app = buildRouteApp(documentsRouter, { memberId: 1 });

        const res = await request(app).delete('/10');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(prismaMocks.documentDelete).toHaveBeenCalled();
    });
});
