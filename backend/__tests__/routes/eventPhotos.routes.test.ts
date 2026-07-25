import express from "express";
import request from "supertest";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    eventFindUnique: vi.fn(),
    eventPhotoCreate: vi.fn(),
}));

const githubStorageMocks = vi.hoisted(() => ({
    uploadContent: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    restoreDeletedFile: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
    canUserViewEvent: vi.fn(),
    canUserAccessEventOperations: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        event: {
            findUnique: prismaMocks.eventFindUnique,
        },
        eventPhoto: {
            create: prismaMocks.eventPhotoCreate,
        },
    },
}));

vi.mock("../../services/githubStorageService", () => githubStorageMocks);

vi.mock("../../lib/eventPermissions", () => permissionMocks);

vi.mock("../../middleware/auth", () => ({
    extractAuthToken: vi.fn(),
    JWT_SECRET: "test-secret",
}));

import eventPhotosRouter from "../../routes/eventPhotos";

function createApp() {
    const app = express();
    app.use((req, _res, next) => {
        (req as express.Request & { user?: object }).user = {
            memberId: 1,
            isDeveloper: true,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
        };
        next();
    });
    app.use("/", eventPhotosRouter);
    return app;
}

describe("event photos upload preview", () => {
    beforeEach(() => {
        prismaMocks.eventFindUnique.mockResolvedValue({ id: 1, isArchived: false });
        permissionMocks.canUserViewEvent.mockResolvedValue(true);
        githubStorageMocks.uploadContent.mockImplementation(
            async (_buffer: Buffer, githubPath: string) => ({
                githubPath,
                githubSha: `sha-${githubPath.includes("preview") ? "preview" : "original"}`,
            }),
        );
        prismaMocks.eventPhotoCreate.mockImplementation(async ({ data, include }: any) => ({
            id: 42,
            ...data,
            uploadedBy: include?.uploadedBy
                ? { id: data.uploadedByMemberId, fullName: "Ada", profilePhotoUrl: null }
                : undefined,
        }));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("POST /upload stores preview fields when optimize succeeds", async () => {
        const image = await sharp({
            create: {
                width: 800,
                height: 600,
                channels: 3,
                background: { r: 90, g: 40, b: 10 },
            },
        })
            .jpeg()
            .toBuffer();

        const response = await request(createApp())
            .post("/upload")
            .field("eventId", "1")
            .field("uploadedByMemberId", "7")
            .attach("photo", image, { filename: "crowd.jpg", contentType: "image/jpeg" });

        expect(response.status).toBe(201);
        expect(githubStorageMocks.uploadContent).toHaveBeenCalledTimes(2);
        expect(prismaMocks.eventPhotoCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    eventId: 1,
                    uploadedByMemberId: 7,
                    fileName: "crowd.jpg",
                    mimeType: "image/jpeg",
                    githubPath: expect.stringMatching(/events\/1\/photos\//),
                    githubSha: "sha-original",
                    previewGithubPath: expect.stringMatching(/-preview\.webp$/),
                    previewGithubSha: "sha-preview",
                    previewFileSize: expect.any(Number),
                }),
            }),
        );
        expect(response.body.previewGithubPath).toMatch(/-preview\.webp$/);
        expect(response.body.previewFileSize).toBeGreaterThan(0);
    });

    it("POST /upload still saves photo when preview upload fails", async () => {
        githubStorageMocks.uploadContent
            .mockResolvedValueOnce({
                githubPath: "events/1/photos/undated/a1b2c3d4-e5f6-7890-abcd-ef1234567890-crowd.jpg",
                githubSha: "sha-original",
            })
            .mockRejectedValueOnce(new Error("preview upload failed"));

        const image = await sharp({
            create: {
                width: 200,
                height: 150,
                channels: 3,
                background: { r: 1, g: 1, b: 1 },
            },
        })
            .png()
            .toBuffer();

        const response = await request(createApp())
            .post("/upload")
            .field("eventId", "1")
            .field("uploadedByMemberId", "7")
            .attach("photo", image, { filename: "crowd.png", contentType: "image/png" });

        expect(response.status).toBe(201);
        expect(prismaMocks.eventPhotoCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    githubSha: "sha-original",
                }),
            }),
        );
        const createData = prismaMocks.eventPhotoCreate.mock.calls[0][0].data;
        expect(createData.previewGithubPath).toBeUndefined();
        expect(createData.previewGithubSha).toBeUndefined();
    });
});
