import express from "express";
import request from "supertest";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    projectFindUnique: vi.fn(),
    projectPhotoCreate: vi.fn(),
}));

const githubStorageMocks = vi.hoisted(() => ({
    uploadContent: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    restoreDeletedFile: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
    canUserViewProject: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        project: {
            findUnique: prismaMocks.projectFindUnique,
        },
        projectPhoto: {
            create: prismaMocks.projectPhotoCreate,
        },
    },
}));

vi.mock("../../services/githubStorageService", () => githubStorageMocks);

vi.mock("../../lib/projectPermissions", () => permissionMocks);

vi.mock("../../middleware/auth", () => ({
    extractAuthToken: vi.fn(),
    JWT_SECRET: "test-secret",
}));

import projectPhotosRouter from "../../routes/projectPhotos";

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
    app.use("/", projectPhotosRouter);
    return app;
}

describe("project photos upload preview", () => {
    beforeEach(() => {
        prismaMocks.projectFindUnique.mockResolvedValue({ id: 1, isArchived: false });
        permissionMocks.canUserViewProject.mockResolvedValue(true);
        githubStorageMocks.uploadContent.mockImplementation(
            async (_buffer: Buffer, githubPath: string) => ({
                githubPath,
                githubSha: `sha-${githubPath.includes("preview") ? "preview" : "original"}`,
            }),
        );
        prismaMocks.projectPhotoCreate.mockImplementation(async ({ data, include }: any) => ({
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
            .field("projectId", "1")
            .field("uploadedByMemberId", "7")
            .attach("photo", image, { filename: "demo.jpg", contentType: "image/jpeg" });

        expect(response.status).toBe(201);
        expect(githubStorageMocks.uploadContent).toHaveBeenCalledTimes(2);
        expect(prismaMocks.projectPhotoCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    projectId: 1,
                    uploadedByMemberId: 7,
                    fileName: "demo.jpg",
                    mimeType: "image/jpeg",
                    githubPath: expect.stringMatching(/projects\/1\/photos\//),
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
                githubPath: "projects/1/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890-demo.jpg",
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
            .field("projectId", "1")
            .field("uploadedByMemberId", "7")
            .attach("photo", image, { filename: "demo.png", contentType: "image/png" });

        expect(response.status).toBe(201);
        expect(prismaMocks.projectPhotoCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    githubSha: "sha-original",
                }),
            }),
        );
        const createData = prismaMocks.projectPhotoCreate.mock.calls[0][0].data;
        expect(createData.previewGithubPath).toBeUndefined();
        expect(createData.previewGithubSha).toBeUndefined();
    });

    it("POST /upload rejects when viewer lacks project access", async () => {
        permissionMocks.canUserViewProject.mockResolvedValue(false);

        const image = await sharp({
            create: {
                width: 100,
                height: 80,
                channels: 3,
                background: { r: 10, g: 10, b: 10 },
            },
        })
            .jpeg()
            .toBuffer();

        const response = await request(createApp())
            .post("/upload")
            .field("projectId", "1")
            .field("uploadedByMemberId", "7")
            .attach("photo", image, { filename: "demo.jpg", contentType: "image/jpeg" });

        expect(response.status).toBe(403);
        expect(prismaMocks.projectPhotoCreate).not.toHaveBeenCalled();
    });
});
