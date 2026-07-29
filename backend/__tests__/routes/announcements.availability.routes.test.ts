import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRouteApp } from './testHarness';

const prismaMocks = vi.hoisted(() => ({
    eventFindUnique: vi.fn(),
    projectFindUnique: vi.fn(),
    announcementFindFirst: vi.fn(),
    announcementResponseFindMany: vi.fn(),
}));

const eventPermissionMocks = vi.hoisted(() => ({
    canUserManageEventTasks: vi.fn(),
}));

const projectPermissionMocks = vi.hoisted(() => ({
    canUserViewProject: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        event: { findUnique: prismaMocks.eventFindUnique },
        project: { findUnique: prismaMocks.projectFindUnique },
        announcement: { findFirst: prismaMocks.announcementFindFirst },
        announcementResponse: { findMany: prismaMocks.announcementResponseFindMany },
    },
}));

vi.mock('../../lib/eventPermissions', () => eventPermissionMocks);
vi.mock('../../lib/projectPermissions', () => projectPermissionMocks);
vi.mock('../../lib/announcementPermissions', () => ({
    canManageAnnouncements: vi.fn(() => false),
}));

import announcementsRouter from '../../routes/announcements';

describe('GET /announcements/availability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        eventPermissionMocks.canUserManageEventTasks.mockReturnValue(true);
        projectPermissionMocks.canUserViewProject.mockResolvedValue(true);
    });

    it('returns 400 when neither eventId nor projectId is provided', async () => {
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isLeadership: true });

        const res = await request(app).get('/availability');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exactly one/i);
    });

    it('returns 400 when both eventId and projectId are provided', async () => {
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isLeadership: true });

        const res = await request(app).get('/availability?eventId=1&projectId=2');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exactly one/i);
    });

    it('returns 403 for event when caller cannot manage event tasks', async () => {
        eventPermissionMocks.canUserManageEventTasks.mockReturnValue(false);
        const app = buildRouteApp(announcementsRouter, { memberId: 1 });

        const res = await request(app).get('/availability?eventId=10');

        expect(res.status).toBe(403);
        expect(prismaMocks.eventFindUnique).not.toHaveBeenCalled();
    });

    it('returns empty payload when no active announcement exists for event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({ id: 10 });
        prismaMocks.announcementFindFirst.mockResolvedValue(null);
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isLeadership: true });

        const res = await request(app).get('/availability?eventId=10');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ announcement: null, responses: [] });
        expect(prismaMocks.announcementFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                    targetType: 'EVENT',
                    eventId: 10,
                }),
            }),
        );
    });

    it('returns latest announcement responses for project', async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({ id: 5, isArchived: false });
        prismaMocks.announcementFindFirst.mockResolvedValue({
            id: 99,
            title: 'Who is free?',
            targetType: 'PROJECT',
            eventId: null,
            projectId: 5,
        });
        prismaMocks.announcementResponseFindMany.mockResolvedValue([
            {
                memberId: 7,
                status: 'AVAILABLE',
                notes: null,
                member: { id: 7, fullName: 'Ada', profilePhotoUrl: null },
                periods: [
                    {
                        startDate: new Date('2026-07-01T00:00:00.000Z'),
                        endDate: new Date('2026-07-15T00:00:00.000Z'),
                    },
                ],
            },
            {
                memberId: 8,
                status: 'UNAVAILABLE',
                notes: 'Busy',
                member: { id: 8, fullName: 'Bob', profilePhotoUrl: null },
                periods: [],
            },
        ]);
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isLeadership: true });

        const res = await request(app).get('/availability?projectId=5');

        expect(res.status).toBe(200);
        expect(res.body.announcement).toEqual({
            id: 99,
            title: 'Who is free?',
            targetType: 'PROJECT',
            eventId: null,
            projectId: 5,
        });
        expect(res.body.responses).toEqual([
            {
                memberId: 7,
                status: 'AVAILABLE',
                notes: null,
                member: { id: 7, fullName: 'Ada', profilePhotoUrl: null },
                periods: [{ startDate: '2026-07-01', endDate: '2026-07-15' }],
            },
            {
                memberId: 8,
                status: 'UNAVAILABLE',
                notes: 'Busy',
                member: { id: 8, fullName: 'Bob', profilePhotoUrl: null },
                periods: [],
            },
        ]);
    });

    it('returns 200 for leadership even when canUserViewProject is false', async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({ id: 5, isArchived: false });
        projectPermissionMocks.canUserViewProject.mockResolvedValue(false);
        prismaMocks.announcementFindFirst.mockResolvedValue(null);
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isLeadership: true });

        const res = await request(app).get('/availability?projectId=5');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ announcement: null, responses: [] });
        expect(prismaMocks.announcementFindFirst).toHaveBeenCalled();
    });

    it('returns 403 for project when non-elevated viewer lacks access', async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({ id: 5, isArchived: false });
        projectPermissionMocks.canUserViewProject.mockResolvedValue(false);
        const app = buildRouteApp(announcementsRouter, { memberId: 1 });

        const res = await request(app).get('/availability?projectId=5');

        expect(res.status).toBe(403);
        expect(prismaMocks.announcementFindFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when event does not exist', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(null);
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isLeadership: true });

        const res = await request(app).get('/availability?eventId=404');

        expect(res.status).toBe(404);
    });
});
