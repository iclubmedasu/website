import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Readable } from "stream";

const prismaMocks = vi.hoisted(() => ({
    eventFindMany: vi.fn(),
    eventFindUnique: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventRegistrationGroupBy: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventRegistrationSessionFindMany: vi.fn(),
    eventSessionFindMany: vi.fn(),
    eventTierFindMany: vi.fn(),
    eventCustomFieldFindMany: vi.fn(),
    eventPhotoFindMany: vi.fn(),
    eventPhotoFindUnique: vi.fn(),
    eventPhotoUpdate: vi.fn(),
    projectFindMany: vi.fn(),
    projectFindUnique: vi.fn(),
    projectPhotoFindMany: vi.fn(),
    projectPhotoFindUnique: vi.fn(),
    projectPhotoUpdate: vi.fn(),
    sitePageFindUnique: vi.fn(),
    aboutSectionFindMany: vi.fn(),
    contactMethodFindMany: vi.fn(),
    socialLinkFindMany: vi.fn(),
    supportNoticeBlockFindMany: vi.fn(),
    incidentReportTypeFindMany: vi.fn(),
    incidentReportTypeFindFirst: vi.fn(),
    incidentReportCreate: vi.fn(),
}));

const sessionTokenMocks = vi.hoisted(() => ({
    generateTokensForRegistration: vi.fn(),
    getSessionTokensForRegistration: vi.fn(),
}));

const emailMocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
}));

const githubStorageMocks = vi.hoisted(() => ({
    downloadFile: vi.fn(),
    uploadContent: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        event: {
            findMany: prismaMocks.eventFindMany,
            findUnique: prismaMocks.eventFindUnique,
        },
        eventRegistration: {
            count: prismaMocks.eventRegistrationCount,
            groupBy: prismaMocks.eventRegistrationGroupBy,
            findFirst: prismaMocks.eventRegistrationFindFirst,
        },
        eventSession: {
            findMany: prismaMocks.eventSessionFindMany,
        },
        eventRegistrationSession: {
            findMany: prismaMocks.eventRegistrationSessionFindMany,
        },
        eventTier: {
            findMany: prismaMocks.eventTierFindMany,
        },
        eventCustomField: {
            findMany: prismaMocks.eventCustomFieldFindMany,
        },
        eventPhoto: {
            findMany: prismaMocks.eventPhotoFindMany,
            findUnique: prismaMocks.eventPhotoFindUnique,
            update: prismaMocks.eventPhotoUpdate,
        },
        project: {
            findMany: prismaMocks.projectFindMany,
            findUnique: prismaMocks.projectFindUnique,
        },
        projectPhoto: {
            findMany: prismaMocks.projectPhotoFindMany,
            findUnique: prismaMocks.projectPhotoFindUnique,
            update: prismaMocks.projectPhotoUpdate,
        },
        sitePage: {
            findUnique: prismaMocks.sitePageFindUnique,
        },
        aboutSection: {
            findMany: prismaMocks.aboutSectionFindMany,
        },
        contactMethod: {
            findMany: prismaMocks.contactMethodFindMany,
        },
        socialLink: {
            findMany: prismaMocks.socialLinkFindMany,
        },
        supportNoticeBlock: {
            findMany: prismaMocks.supportNoticeBlockFindMany,
        },
        incidentReportType: {
            findMany: prismaMocks.incidentReportTypeFindMany,
            findFirst: prismaMocks.incidentReportTypeFindFirst,
        },
        incidentReport: {
            create: prismaMocks.incidentReportCreate,
        },
    },
}));

vi.mock("../../services/emailService", () => emailMocks);

vi.mock("../../services/sessionTokenService", () => sessionTokenMocks);

vi.mock("../../services/eventTicketEmailService", () => ({
    buildRegistrationJoinUrl: (eventSlugOrId: string | number, token: string) =>
        `https://public.example/events/${eventSlugOrId}/join?token=${token}`,
}));

vi.mock("../../services/githubStorageService", () => githubStorageMocks);

import publicRouter from "../../routes/public";

function mockGithubDownload(buffer: Buffer) {
    const nodeStream = Readable.from(buffer);
    return {
        body: Readable.toWeb(nodeStream),
        arrayBuffer: async () =>
            buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use("/public", publicRouter);
    return app;
}

const baseEvent = {
    id: 1,
    slug: "abcdefghjkmn",
    title: "Health Fair",
    description: "Community outreach",
    eventDate: new Date("2027-08-01T10:00:00.000Z"),
    eventEndDate: new Date("2027-08-01T18:00:00.000Z"),
    venue: "ASU Downtown",
    registrationDeadline: new Date("2027-07-28T23:59:59.000Z"),
    capacity: 100,
    status: "PUBLISHED",
    isActive: true,
    isArchived: false,
    isFinalized: false,
    isPublished: true,
    isDisclosed: false,
    projectType: { name: "Workshop" },
};

describe("public routes", () => {
    beforeEach(() => {
        prismaMocks.eventFindMany.mockResolvedValue([]);
        prismaMocks.eventFindUnique.mockResolvedValue(null);
        prismaMocks.eventRegistrationCount.mockResolvedValue(0);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([]);
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null);
        prismaMocks.eventRegistrationSessionFindMany.mockResolvedValue([]);
        prismaMocks.eventSessionFindMany.mockResolvedValue([]);
        prismaMocks.eventTierFindMany.mockResolvedValue([]);
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([]);
        prismaMocks.eventPhotoFindMany.mockResolvedValue([]);
        prismaMocks.projectFindMany.mockResolvedValue([]);
        prismaMocks.projectFindUnique.mockResolvedValue(null);
        prismaMocks.sitePageFindUnique.mockResolvedValue(null);
        prismaMocks.aboutSectionFindMany.mockResolvedValue([]);
        prismaMocks.contactMethodFindMany.mockResolvedValue([]);
        prismaMocks.socialLinkFindMany.mockResolvedValue([]);
        prismaMocks.supportNoticeBlockFindMany.mockResolvedValue([]);
        prismaMocks.incidentReportTypeFindMany.mockResolvedValue([]);
        emailMocks.sendEmail.mockResolvedValue({ id: "email-1" });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("GET /public/events returns published upcoming events with capacity fields", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([baseEvent]);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([
            { eventId: 1, _count: { _all: 25 } },
        ]);

        const response = await request(createApp()).get("/public/events?limit=3&upcoming=true");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
            id: 1,
            registeredCount: 25,
            spotsRemaining: 75,
            registrationOpen: true,
            projectType: { name: "Workshop" },
        });
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                isArchived: false,
                isFinalized: false,
                isPublished: true,
            }),
        }));
    });

    it("GET /public/events?registerable=true excludes full events", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([
            baseEvent,
            { ...baseEvent, id: 2, title: "Full Event", capacity: 10 },
        ]);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([
            { eventId: 1, _count: { _all: 25 } },
            { eventId: 2, _count: { _all: 10 } },
        ]);

        const response = await request(createApp()).get("/public/events?registerable=true&limit=10");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].id).toBe(1);
    });

    it("GET /public/events/:id returns event detail", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(baseEvent);
        prismaMocks.eventRegistrationCount.mockResolvedValue(12);

        const response = await request(createApp()).get("/public/events/1");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 1,
            slug: "abcdefghjkmn",
            description: "Community outreach",
            registeredCount: 12,
            spotsRemaining: 88,
        });
    });

    it("GET /public/events/:slug returns event detail by public slug", async () => {
        prismaMocks.eventFindUnique
            .mockResolvedValueOnce({ id: 1, slug: "abcdefghjkmn" })
            .mockResolvedValueOnce(baseEvent);
        prismaMocks.eventRegistrationCount.mockResolvedValue(12);

        const response = await request(createApp()).get("/public/events/abcdefghjkmn");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 1,
            slug: "abcdefghjkmn",
            registeredCount: 12,
        });
    });

    it("GET /public/events/:id returns disclosed archived past events", async () => {
        const pastEvent = {
            ...baseEvent,
            isArchived: true,
            isDisclosed: true,
            isPublished: true,
            isActive: false,
        };
        prismaMocks.eventFindUnique.mockResolvedValue(pastEvent);
        prismaMocks.eventRegistrationCount.mockResolvedValue(40);

        const response = await request(createApp()).get("/public/events/1");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 1,
            slug: "abcdefghjkmn",
            registrationOpen: false,
        });
    });

    it("GET /public/events/:id returns 404 for archived events that are not disclosed", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            ...baseEvent,
            isArchived: true,
            isDisclosed: false,
        });

        const response = await request(createApp()).get("/public/events/1");

        expect(response.status).toBe(404);
    });

    it("GET /public/events/:id returns disclosed finalized events", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            ...baseEvent,
            isFinalized: true,
            isDisclosed: true,
            isPublished: true,
        });
        prismaMocks.eventRegistrationCount.mockResolvedValue(40);

        const response = await request(createApp()).get("/public/events/1");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 1,
            slug: "abcdefghjkmn",
        });
    });

    it("GET /public/events/:id returns 404 for finalized events that are not disclosed", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            ...baseEvent,
            isFinalized: true,
            isDisclosed: false,
            isPublished: true,
        });

        const response = await request(createApp()).get("/public/events/1");

        expect(response.status).toBe(404);
    });

    it("GET /public/events/:id returns disclosed non-finalized events", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            ...baseEvent,
            isFinalized: false,
            isArchived: false,
            isDisclosed: true,
            isPublished: false,
            isActive: true,
        });
        prismaMocks.eventRegistrationCount.mockResolvedValue(8);

        const response = await request(createApp()).get("/public/events/1");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 1,
            slug: "abcdefghjkmn",
        });
    });

    it("GET /public/events/:id/photos returns photos for disclosed non-finalized events", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            id: 1,
            slug: "abcdefghjkmn",
            isPublished: false,
            isActive: true,
            isArchived: false,
            isDisclosed: true,
            isFinalized: false,
        });
        prismaMocks.eventPhotoFindMany.mockResolvedValue([
            {
                id: 9,
                fileName: "crowd.jpg",
                eventDay: 1,
                caption: "Opening",
            },
        ]);

        const response = await request(createApp()).get("/public/events/1/photos");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                id: 9,
                fileName: "crowd.jpg",
                eventDay: 1,
                caption: "Opening",
                downloadUrl: "/api/public/event-photos/9/download",
            },
        ]);
    });

    it("GET /public/highlights/photos prefers core then fills from public photos", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([
            {
                id: 1,
                title: "Health Fair",
                slug: "abcdefghjkmn",
                eventDate: new Date("2026-08-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-08-01T18:00:00.000Z"),
                photos: [
                    { id: 1, isCore: true, showOnPublic: true },
                    { id: 2, isCore: true, showOnPublic: false },
                    { id: 3, isCore: true, showOnPublic: true },
                    { id: 11, isCore: false, showOnPublic: true },
                    { id: 12, isCore: false, showOnPublic: true },
                    { id: 13, isCore: false, showOnPublic: true },
                    { id: 14, isCore: false, showOnPublic: true },
                    { id: 15, isCore: false, showOnPublic: true },
                    { id: 16, isCore: false, showOnPublic: true },
                    { id: 17, isCore: false, showOnPublic: true },
                    { id: 18, isCore: false, showOnPublic: true },
                ],
            },
        ]);
        prismaMocks.projectFindMany.mockResolvedValue([]);

        const response = await request(createApp()).get("/public/highlights/photos");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(10);
        const ids = response.body.map((photo: { id: number }) => photo.id);
        expect(ids).toEqual(expect.arrayContaining([1, 2, 3]));
        expect(ids.filter((id: number) => id === 1 || id === 2 || id === 3)).toHaveLength(3);
        expect(response.body.every((photo: { source: string }) => photo.source === "event")).toBe(
            true,
        );
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isDisclosed: true,
                    photos: {
                        some: {
                            isActive: true,
                            OR: [{ isCore: true }, { showOnPublic: true }],
                        },
                    },
                }),
                select: expect.objectContaining({
                    photos: expect.objectContaining({
                        where: {
                            isActive: true,
                            OR: [{ isCore: true }, { showOnPublic: true }],
                        },
                    }),
                }),
            }),
        );
        expect(prismaMocks.projectFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isDisclosed: true,
                    photos: {
                        some: {
                            isActive: true,
                            OR: [{ isCore: true }, { showOnPublic: true }],
                        },
                    },
                }),
            }),
        );
    });

    it("GET /public/highlights/photos uses random public photos when no core", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([
            {
                id: 1,
                title: "Health Fair",
                slug: "abcdefghjkmn",
                eventDate: new Date("2026-08-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-08-01T18:00:00.000Z"),
                photos: [
                    { id: 9, isCore: false, showOnPublic: true },
                    { id: 10, isCore: false, showOnPublic: true },
                ],
            },
        ]);
        prismaMocks.projectFindMany.mockResolvedValue([]);

        const response = await request(createApp()).get("/public/highlights/photos");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.arrayContaining([
                {
                    id: 9,
                    downloadUrl: "/api/public/event-photos/9/download",
                    source: "event",
                    title: "Health Fair",
                    slug: "abcdefghjkmn",
                },
                {
                    id: 10,
                    downloadUrl: "/api/public/event-photos/10/download",
                    source: "event",
                    title: "Health Fair",
                    slug: "abcdefghjkmn",
                },
            ]),
        );
        expect(response.body).toHaveLength(2);
    });

    it("GET /public/highlights/photos mixes latest disclosed events and projects by recency", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([
            {
                id: 1,
                title: "Older Event",
                slug: "olderevent123",
                eventDate: new Date("2026-01-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-01-02T18:00:00.000Z"),
                photos: [{ id: 101, isCore: true, showOnPublic: true }],
            },
            {
                id: 2,
                title: "Newer Event",
                slug: "newerevent123",
                eventDate: new Date("2026-06-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-06-03T18:00:00.000Z"),
                photos: [{ id: 102, isCore: false, showOnPublic: true }],
            },
            {
                id: 3,
                title: "Mid Event",
                slug: "midevent12345",
                eventDate: new Date("2026-03-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-03-02T18:00:00.000Z"),
                photos: [{ id: 103, isCore: true, showOnPublic: false }],
            },
            {
                id: 4,
                title: "Excluded Event",
                slug: "excludedevent",
                eventDate: new Date("2025-01-01T10:00:00.000Z"),
                eventEndDate: new Date("2025-01-02T18:00:00.000Z"),
                photos: [{ id: 104, isCore: true, showOnPublic: true }],
            },
        ]);
        prismaMocks.projectFindMany.mockResolvedValue([
            {
                id: 10,
                title: "Latest Project",
                slug: "latestproject",
                completedDate: new Date("2026-07-01T12:00:00.000Z"),
                updatedAt: new Date("2026-05-01T12:00:00.000Z"),
                photos: [{ id: 201, isCore: true, showOnPublic: true }],
            },
            {
                id: 11,
                title: "Updated Project",
                slug: "updatedproject",
                completedDate: null,
                updatedAt: new Date("2026-05-15T12:00:00.000Z"),
                photos: [{ id: 202, isCore: false, showOnPublic: true }],
            },
            {
                id: 12,
                title: "Too Old Project",
                slug: "toooldproject",
                completedDate: new Date("2024-12-01T12:00:00.000Z"),
                updatedAt: new Date("2024-12-02T12:00:00.000Z"),
                photos: [{ id: 203, isCore: true, showOnPublic: true }],
            },
        ]);

        const response = await request(createApp()).get("/public/highlights/photos");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                id: 201,
                downloadUrl: "/api/public/project-photos/201/download",
                source: "project",
                title: "Latest Project",
                slug: "latestproject",
            },
            {
                id: 102,
                downloadUrl: "/api/public/event-photos/102/download",
                source: "event",
                title: "Newer Event",
                slug: "newerevent123",
            },
            {
                id: 202,
                downloadUrl: "/api/public/project-photos/202/download",
                source: "project",
                title: "Updated Project",
                slug: "updatedproject",
            },
            {
                id: 103,
                downloadUrl: "/api/public/event-photos/103/download",
                source: "event",
                title: "Mid Event",
                slug: "midevent12345",
            },
            {
                id: 101,
                downloadUrl: "/api/public/event-photos/101/download",
                source: "event",
                title: "Older Event",
                slug: "olderevent123",
            },
        ]);
        expect(response.body).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 104 }),
                expect.objectContaining({ id: 203 }),
            ]),
        );
    });

    it("GET /public/highlights/photos returns empty when no eligible photos", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([]);
        prismaMocks.projectFindMany.mockResolvedValue([]);

        const response = await request(createApp()).get("/public/highlights/photos");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it("GET /public/event-photos/:id/download serves preview when present", async () => {
        const previewBytes = Buffer.from("webp-preview-bytes");
        prismaMocks.eventPhotoFindUnique.mockResolvedValue({
            id: 9,
            isActive: true,
            showOnPublic: true,
            isCore: false,
            fileName: "crowd.jpg",
            mimeType: "image/jpeg",
            fileSize: 5000,
            githubPath: "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-crowd.jpg",
            previewGithubPath:
                "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-preview.webp",
            previewFileSize: previewBytes.length,
            event: {
                isPublished: true,
                isActive: true,
                isArchived: false,
                isDisclosed: true,
                isFinalized: false,
            },
        });
        githubStorageMocks.downloadFile.mockResolvedValue(mockGithubDownload(previewBytes));

        const response = await request(createApp()).get("/public/event-photos/9/download");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/image\/webp/);
        expect(response.headers["cache-control"]).toBe(
            "public, max-age=86400, stale-while-revalidate=604800",
        );
        expect(Buffer.from(response.body)).toEqual(previewBytes);
        expect(githubStorageMocks.downloadFile).toHaveBeenCalledWith(
            "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-preview.webp",
        );
        expect(githubStorageMocks.uploadContent).not.toHaveBeenCalled();
    });

    it("GET /public/event-photos/:id/download lazy-backfills preview when missing", async () => {
        const originalBytes = await (await import("sharp"))
            .default({
                create: {
                    width: 1600,
                    height: 1200,
                    channels: 3,
                    background: { r: 1, g: 2, b: 3 },
                },
            })
            .jpeg()
            .toBuffer();

        prismaMocks.eventPhotoFindUnique.mockResolvedValue({
            id: 11,
            isActive: true,
            showOnPublic: true,
            isCore: true,
            fileName: "stage.jpg",
            mimeType: "image/jpeg",
            fileSize: originalBytes.length,
            githubPath: "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-stage.jpg",
            previewGithubPath: null,
            previewFileSize: null,
            event: {
                isPublished: true,
                isActive: true,
                isArchived: false,
                isDisclosed: true,
                isFinalized: false,
            },
        });
        githubStorageMocks.downloadFile.mockResolvedValue(mockGithubDownload(originalBytes));
        githubStorageMocks.uploadContent.mockResolvedValue({
            githubPath:
                "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-preview.webp",
            githubSha: "preview-sha",
        });
        prismaMocks.eventPhotoUpdate.mockResolvedValue({});

        const response = await request(createApp()).get("/public/event-photos/11/download");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/image\/webp/);
        expect(response.headers["cache-control"]).toBe(
            "public, max-age=86400, stale-while-revalidate=604800",
        );
        // Persist runs in the background after the response is sent.
        await vi.waitFor(() => {
            expect(githubStorageMocks.uploadContent).toHaveBeenCalledWith(
                expect.any(Buffer),
                "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-preview.webp",
                expect.stringContaining("Backfill"),
            );
            expect(prismaMocks.eventPhotoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 11 },
                    data: expect.objectContaining({
                        previewGithubPath:
                            "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-preview.webp",
                        previewGithubSha: "preview-sha",
                        previewFileSize: expect.any(Number),
                    }),
                }),
            );
        });
    });

    it("GET /public/events/:id/tiers returns active tiers with capacity", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            id: 1,
            isActive: true,
            isArchived: false,
            isFinalized: false,
            isPublished: true,
        });
        prismaMocks.eventTierFindMany.mockResolvedValue([
            {
                id: 5,
                name: "General",
                description: "Standard admission",
                price: null,
                currency: "USD",
                maxCapacity: 50,
                isActive: true,
            },
        ]);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([
            { tierId: 5, _count: { _all: 10 } },
        ]);

        const response = await request(createApp()).get("/public/events/1/tiers");

        expect(response.status).toBe(200);
        expect(response.body[0]).toMatchObject({
            id: 5,
            registeredCount: 10,
            spotsRemaining: 40,
        });
        expect(prismaMocks.eventTierFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                    showOnPublic: true,
                }),
            }),
        );
    });

    it("GET /public/events/:id/custom-fields returns public fields only", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            id: 1,
            isActive: true,
            isArchived: false,
            isFinalized: false,
            isPublished: true,
        });
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([
            { id: 9, label: "Dietary needs", type: "text", options: null, required: false, order: 0 },
        ]);

        const response = await request(createApp()).get("/public/events/1/custom-fields");

        expect(response.status).toBe(200);
        expect(response.body[0].label).toBe("Dietary needs");
        expect(prismaMocks.eventCustomFieldFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    showOnPublic: true,
                    isActive: true,
                }),
            }),
        );
    });

    it("GET /public/events/:id/confirmation returns registration summary", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({ id: 1, slug: "abcdefghjkmn" });
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 42,
            confirmationCode: "ABC123",
            fullName: "Ada Lovelace",
            email: "ada@example.com",
            status: "REGISTERED",
            event: {
                id: 1,
                slug: "abcdefghjkmn",
                title: "Health Fair",
                eventDate: new Date("2026-07-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-07-01T18:00:00.000Z"),
                venue: "ASU Downtown",
                isActive: true,
                isArchived: false,
                isFinalized: false,
                isPublished: true,
            },
            tier: { name: "General" },
        });
        sessionTokenMocks.generateTokensForRegistration.mockResolvedValue(1);
        sessionTokenMocks.getSessionTokensForRegistration.mockResolvedValue(new Map([[7, "tok-online-1"]]));
        prismaMocks.eventRegistrationSessionFindMany.mockResolvedValue([
            { sessionId: 6 },
            { sessionId: 7 },
        ]);
        prismaMocks.eventSessionFindMany.mockResolvedValue([
            {
                id: 6,
                label: "Morning onsite",
                sessionDate: new Date("2026-07-01T10:00:00.000Z"),
                startTime: "10:00",
                endTime: "12:00",
                mode: "ONSITE",
            },
            {
                id: 7,
                label: "Afternoon online",
                sessionDate: new Date("2026-07-01T14:00:00.000Z"),
                startTime: "14:00",
                endTime: "16:00",
                mode: "ONLINE",
            },
        ]);

        const response = await request(createApp()).get("/public/events/1/confirmation?code=abc123");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            confirmationCode: "ABC123",
            fullName: "Ada Lovelace",
            tier: { name: "General" },
            event: { id: 1, slug: "abcdefghjkmn" },
        });
        expect(sessionTokenMocks.generateTokensForRegistration).toHaveBeenCalledWith(42);
        expect(response.body.sessions).toHaveLength(2);
        expect(response.body.sessions[0]).toMatchObject({
            id: 6,
            label: "Morning onsite",
            mode: "ONSITE",
            joinUrl: null,
        });
        expect(response.body.sessions[1]).toMatchObject({
            id: 7,
            label: "Afternoon online",
            mode: "ONLINE",
            joinUrl: "https://public.example/events/abcdefghjkmn/join?token=tok-online-1",
        });
    });

    it("GET /public/projects returns disclosed projects", async () => {
        prismaMocks.projectFindMany.mockResolvedValue([
            {
                id: 2,
                slug: "projslug0001",
                title: "Telehealth Pilot",
                description: "Student-led pilot",
                completedDate: "2026-05-01T00:00:00.000Z",
                projectType: { name: "Technology", category: "Technology" },
                tags: [{ tagName: "innovation" }],
            },
        ]);

        const response = await request(createApp()).get("/public/projects?limit=2");

        expect(response.status).toBe(200);
        expect(response.body[0]).toMatchObject({
            title: "Telehealth Pilot",
            slug: "projslug0001",
        });
        expect(prismaMocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                isDisclosed: true,
            },
        }));
    });

    it("GET /public/events?past=true returns disclosed archived events", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([
            {
                ...baseEvent,
                id: 3,
                title: "Past Gala",
                isArchived: true,
                isPublished: false,
                isActive: false,
            },
        ]);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([]);

        const response = await request(createApp()).get("/public/events?past=true&limit=5");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe("Past Gala");
        expect(response.body[0].slug).toBe("abcdefghjkmn");
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                isDisclosed: true,
            },
            orderBy: { eventEndDate: "desc" },
        }));
    });

    it("GET /public/events?past=true returns disclosed non-finalized events", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([
            {
                ...baseEvent,
                id: 4,
                title: "Disclosed Active Fair",
                isArchived: false,
                isFinalized: false,
                isDisclosed: true,
                isPublished: true,
                isActive: true,
            },
        ]);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([]);

        const response = await request(createApp()).get("/public/events?past=true&limit=5");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe("Disclosed Active Fair");
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                isDisclosed: true,
            },
        }));
    });

    it("GET /public/projects/:id returns disclosed project detail", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 2,
            slug: "projslug0001",
            title: "Telehealth Pilot",
            description: "Student-led pilot",
            completedDate: "2026-05-01T00:00:00.000Z",
            projectType: { name: "Technology", category: "Technology" },
            tags: [{ tagName: "innovation" }],
            isDisclosed: true,
        });

        const response = await request(createApp()).get("/public/projects/2");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 2,
            slug: "projslug0001",
            title: "Telehealth Pilot",
            projectType: { name: "Technology", category: "Technology" },
        });
        expect(response.body.isDisclosed).toBeUndefined();
    });

    it("GET /public/projects/:id returns disclosed non-archived project detail", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 4,
            slug: "projslug0003",
            title: "Active Disclosed",
            description: null,
            completedDate: null,
            projectType: null,
            tags: [],
            isDisclosed: true,
        });

        const response = await request(createApp()).get("/public/projects/4");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 4,
            title: "Active Disclosed",
        });
    });

    it("GET /public/projects/:id returns 404 for undisclosed project", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 3,
            slug: "projslug0002",
            title: "Hidden Project",
            description: null,
            completedDate: null,
            projectType: null,
            tags: [],
            isDisclosed: false,
        });

        const response = await request(createApp()).get("/public/projects/3");

        expect(response.status).toBe(404);
    });

    it("GET /public/projects/:id/photos returns photos for disclosed projects", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 2,
            slug: "projslug0001",
            isDisclosed: true,
        });
        prismaMocks.projectPhotoFindMany.mockResolvedValue([
            {
                id: 11,
                fileName: "demo.jpg",
                caption: "Launch",
            },
        ]);

        const response = await request(createApp()).get("/public/projects/2/photos");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                id: 11,
                fileName: "demo.jpg",
                caption: "Launch",
                downloadUrl: "/api/public/project-photos/11/download",
            },
        ]);
    });

    it("GET /public/projects/:id/photos returns 404 for undisclosed projects", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 3,
            slug: "projslug0002",
            isDisclosed: false,
        });

        const response = await request(createApp()).get("/public/projects/3/photos");

        expect(response.status).toBe(404);
        expect(prismaMocks.projectPhotoFindMany).not.toHaveBeenCalled();
    });

    it("POST /public/contact validates required fields", async () => {
        const response = await request(createApp())
            .post("/public/contact")
            .send({ name: "Ada", email: "ada@example.com" });

        expect(response.status).toBe(400);
        expect(emailMocks.sendEmail).not.toHaveBeenCalled();
    });

    it("POST /public/contact sends email with reply-to", async () => {
        const response = await request(createApp())
            .post("/public/contact")
            .send({
                name: "Ada Lovelace",
                email: "ada@example.com",
                subject: "Partnership",
                message: "Hello from the public site.",
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(emailMocks.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                replyTo: "ada@example.com",
                subject: "[iClub Contact] Partnership",
            }),
        );
    });

    it("GET /public/site-config returns public website URL", async () => {
        const response = await request(createApp()).get("/public/site-config");
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.objectContaining({
                publicWebsiteUrl: expect.any(String),
            }),
        );
    });

    it("GET /public/site/about returns about page payload", async () => {
        prismaMocks.sitePageFindUnique.mockResolvedValue({
            id: "about",
            eyebrow: "About",
            title: "iClub",
            description: "About us",
        });
        prismaMocks.aboutSectionFindMany.mockResolvedValue([
            {
                id: 1,
                sortOrder: 0,
                type: "BULLET_LIST",
                title: "What We Do",
                leftLabel: null,
                leftText: null,
                rightLabel: null,
                rightText: null,
                bullets: ["Host events"],
                emptyMessage: null,
                sponsors: [],
            },
        ]);

        const response = await request(createApp()).get("/public/site/about");

        expect(response.status).toBe(200);
        expect(response.body.header.title).toBe("iClub");
        expect(response.body.sections[0].bullets).toEqual(["Host events"]);
    });

    it("GET /public/site/social-links returns active links", async () => {
        prismaMocks.socialLinkFindMany.mockResolvedValue([
            { id: 1, platform: "INSTAGRAM", url: "https://instagram.com/iclub", sortOrder: 0 },
        ]);

        const response = await request(createApp()).get("/public/site/social-links");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].platform).toBe("INSTAGRAM");
    });

    it("GET /public/site/support returns support page payload with nested forms", async () => {
        prismaMocks.sitePageFindUnique.mockResolvedValue({
            id: "support",
            eyebrow: "Support",
            title: "Help and Support",
            description: "Submit a report",
        });
        prismaMocks.supportNoticeBlockFindMany.mockResolvedValue([
            { id: 1, sortOrder: 0, locale: "EN", content: "Guidance" },
        ]);
        prismaMocks.incidentReportTypeFindMany.mockResolvedValue([
            {
                id: 1,
                label: "General Report",
                slug: "general",
                sortOrder: 0,
                isSystem: true,
                isActive: true,
                fields: [
                    {
                        id: 10,
                        formId: 1,
                        label: "Location",
                        type: "text",
                        options: null,
                        required: false,
                        order: 0,
                        isActive: true,
                    },
                ],
            },
        ]);

        const response = await request(createApp()).get("/public/site/support");

        expect(response.status).toBe(200);
        expect(response.body.header.title).toBe("Help and Support");
        expect(response.body.forms).toHaveLength(1);
        expect(response.body.forms[0].fields).toHaveLength(1);
    });

    it("GET /public/site/support excludes inactive forms", async () => {
        prismaMocks.sitePageFindUnique.mockResolvedValue({
            id: "support",
            eyebrow: "Support",
            title: "Help and Support",
            description: "Submit a report",
        });
        prismaMocks.supportNoticeBlockFindMany.mockResolvedValue([]);
        prismaMocks.incidentReportTypeFindMany.mockResolvedValue([
            {
                id: 1,
                label: "General Report",
                slug: "general",
                sortOrder: 0,
                isSystem: true,
                isActive: true,
                fields: [],
            },
        ]);

        const response = await request(createApp()).get("/public/site/support");

        expect(response.status).toBe(200);
        expect(prismaMocks.incidentReportTypeFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { isActive: true },
            }),
        );
    });

    it("POST /public/support/incident-reports stores a submission", async () => {
        prismaMocks.incidentReportTypeFindFirst.mockResolvedValue({
            id: 1,
            label: "General Report",
            slug: "general",
            sortOrder: 0,
            isSystem: true,
            isActive: true,
            fields: [],
        });
        prismaMocks.incidentReportCreate.mockResolvedValue({
            id: 12,
            answers: {
                form: { id: 1, label: "General Report", slug: "general" },
                reporter: { name: null, email: "reporter@example.com", phone: null, team: null },
                description: "Concern",
                extraAnswers: [],
            },
            source: "PUBLIC",
            submitterMemberId: null,
            createdAt: new Date("2026-06-24T12:00:00.000Z"),
        });

        const response = await request(createApp())
            .post("/public/support/incident-reports")
            .send({
                formId: 1,
                email: "reporter@example.com",
                description: "Concern",
            });

        expect(response.status).toBe(201);
        expect(prismaMocks.incidentReportCreate).toHaveBeenCalled();
    });
});
