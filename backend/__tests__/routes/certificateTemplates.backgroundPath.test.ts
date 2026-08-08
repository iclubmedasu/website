import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRouteApp } from "./testHarness";
import { templateBackgroundWebpPath } from "../../lib/optimizeCertificateBackground";

const prismaMocks = vi.hoisted(() => ({
    certificateTemplateFindUnique: vi.fn(),
    certificateTemplateUpdate: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        certificateTemplate: {
            findUnique: prismaMocks.certificateTemplateFindUnique,
            update: prismaMocks.certificateTemplateUpdate,
        },
    },
}));

vi.mock("../../lib/certificateBackgroundCache", () => ({
    invalidateCachedCertificateBackground: vi.fn(),
    loadCertificateBackground: vi.fn(),
}));

vi.mock("../../services/githubStorageService", () => ({
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
    uploadContent: vi.fn(),
}));

vi.mock("../../lib/optimizeCertificateBackground", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../lib/optimizeCertificateBackground")>();
    return {
        ...actual,
        optimizeCertificateBackground: vi.fn(),
    };
});

import certificateTemplatesRouter from "../../routes/certificateTemplates";

const manager = { isOfficer: true, memberId: 1 };
const existingTemplate = {
    id: 7,
    name: "Sample",
    layout: [],
    backgroundImagePath: null,
    backgroundImageSha: null,
};

describe("certificateTemplates backgroundImagePath validation (B5)", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("PATCH /:id/background", () => {
        it("rejects an arbitrary path with 400", async () => {
            prismaMocks.certificateTemplateFindUnique.mockResolvedValue(existingTemplate);

            const response = await request(buildRouteApp(certificateTemplatesRouter, manager))
                .patch("/7/background")
                .send({
                    backgroundImagePath: "certificates/evil/other.webp",
                    backgroundImageSha: "abc123",
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid backgroundImagePath");
            expect(prismaMocks.certificateTemplateUpdate).not.toHaveBeenCalled();
        });

        it("accepts the canonical path for that template id", async () => {
            const path = templateBackgroundWebpPath(7);
            prismaMocks.certificateTemplateFindUnique.mockResolvedValue(existingTemplate);
            prismaMocks.certificateTemplateUpdate.mockResolvedValue({
                ...existingTemplate,
                backgroundImagePath: path,
                backgroundImageSha: "sha-ok",
            });

            const response = await request(buildRouteApp(certificateTemplatesRouter, manager))
                .patch("/7/background")
                .send({
                    backgroundImagePath: path,
                    backgroundImageSha: "sha-ok",
                });

            expect(response.status).toBe(200);
            expect(prismaMocks.certificateTemplateUpdate).toHaveBeenCalledWith({
                where: { id: 7 },
                data: {
                    backgroundImagePath: path,
                    backgroundImageSha: "sha-ok",
                },
            });
        });
    });

    describe("PUT /:id", () => {
        it("rejects an arbitrary backgroundImagePath with 400", async () => {
            prismaMocks.certificateTemplateFindUnique.mockResolvedValue(existingTemplate);

            const response = await request(buildRouteApp(certificateTemplatesRouter, manager))
                .put("/7")
                .send({
                    backgroundImagePath: "https://evil.example/bg.png",
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid backgroundImagePath");
            expect(prismaMocks.certificateTemplateUpdate).not.toHaveBeenCalled();
        });

        it("allows clearing backgroundImagePath with null", async () => {
            prismaMocks.certificateTemplateFindUnique.mockResolvedValue(existingTemplate);
            prismaMocks.certificateTemplateUpdate.mockResolvedValue({
                ...existingTemplate,
                backgroundImagePath: null,
                backgroundImageSha: null,
            });

            const response = await request(buildRouteApp(certificateTemplatesRouter, manager))
                .put("/7")
                .send({ backgroundImagePath: null });

            expect(response.status).toBe(200);
            expect(prismaMocks.certificateTemplateUpdate).toHaveBeenCalledWith({
                where: { id: 7 },
                data: {
                    backgroundImagePath: null,
                    backgroundImageSha: null,
                },
            });
        });

        it("accepts the canonical path on PUT", async () => {
            const path = templateBackgroundWebpPath(7);
            prismaMocks.certificateTemplateFindUnique.mockResolvedValue(existingTemplate);
            prismaMocks.certificateTemplateUpdate.mockResolvedValue({
                ...existingTemplate,
                backgroundImagePath: path,
            });

            const response = await request(buildRouteApp(certificateTemplatesRouter, manager))
                .put("/7")
                .send({ backgroundImagePath: path });

            expect(response.status).toBe(200);
            expect(prismaMocks.certificateTemplateUpdate).toHaveBeenCalledWith({
                where: { id: 7 },
                data: { backgroundImagePath: path },
            });
        });
    });
});
