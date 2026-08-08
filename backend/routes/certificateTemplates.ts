import express, { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
    invalidateCachedCertificateBackground,
    loadCertificateBackground,
} from "../lib/certificateBackgroundCache";
import {
    optimizeCertificateBackground,
    templateBackgroundWebpPath,
} from "../lib/optimizeCertificateBackground";
import { deleteFile, downloadFile, uploadContent } from "../services/githubStorageService";
import type { RequestUser } from "../types/auth";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

type UploadRequest = Request & {
    file?: {
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
    };
};

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function canManageCertificates(user: RequestUser | undefined): boolean {
    return !!(user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership);
}

/** Normalize focus JSON: { scale >= 1, offsetX/Y in 0..1 }. Returns null to clear / default cover-center. */
function parseBackgroundFocus(value: unknown): { scale: number; offsetX: number; offsetY: number } | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error("backgroundFocus must be an object or null");
    }
    const raw = value as Record<string, unknown>;
    const scale = Number(raw.scale);
    const offsetX = Number(raw.offsetX);
    const offsetY = Number(raw.offsetY);
    if (![scale, offsetX, offsetY].every(Number.isFinite)) {
        throw new Error("backgroundFocus requires numeric scale, offsetX, offsetY");
    }
    return {
        scale: Math.max(1, scale),
        offsetX: Math.min(1, Math.max(0, offsetX)),
        offsetY: Math.min(1, Math.max(0, offsetY)),
    };
}

function toBackgroundFocusInput(
    value: { scale: number; offsetX: number; offsetY: number } | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.DbNull;
    return value;
}

function parseCanvasDim(value: unknown): number | null {
    const n = Number.parseInt(String(value), 10);
    if (!Number.isInteger(n) || n < 400 || n > 4000) {
        return null;
    }
    return n;
}

/** Only allow the canonical storage path produced by the upload-background flow. */
function isValidTemplateBackgroundPath(templateId: number, path: string): boolean {
    return path === templateBackgroundWebpPath(templateId);
}

const templateIssuedCountSelect = {
    _count: {
        select: {
            certificates: {
                where: { status: "ISSUED" as const },
            },
        },
    },
};

function mapTemplateWithIssuedCount<
    T extends { _count: { certificates: number } },
>(template: T) {
    const { _count, ...rest } = template;
    return {
        ...rest,
        issuedCertificateCount: _count.certificates,
        hasIssuedCertificates: _count.certificates > 0,
    };
}

type TemplateBackgroundRow = {
    id: number;
    canvasWidth: number;
    canvasHeight: number;
    backgroundImagePath: string | null;
    backgroundImageSha: string | null;
};

async function reoptimizeTemplateBackground(existing: TemplateBackgroundRow): Promise<{
    id: number;
    backgroundImagePath: string | null;
    backgroundImageSha: string | null;
    bytesBefore: number;
    bytesAfter: number;
}> {
    if (!existing.backgroundImagePath) {
        throw new Error("Template has no background image");
    }

    const ghResponse = await downloadFile(existing.backgroundImagePath);
    const input = Buffer.from(await ghResponse.arrayBuffer());
    const optimized = await optimizeCertificateBackground(input, {
        canvasWidth: existing.canvasWidth,
        canvasHeight: existing.canvasHeight,
    });

    const targetPath = templateBackgroundWebpPath(existing.id);
    const existingSha =
        existing.backgroundImagePath === targetPath && existing.backgroundImageSha
            ? existing.backgroundImageSha
            : undefined;

    const ghResult = await uploadContent(
        optimized.buffer,
        targetPath,
        `Reoptimize certificate template ${existing.id} background`,
        existingSha,
    );

    if (
        existing.backgroundImagePath !== targetPath &&
        existing.backgroundImageSha
    ) {
        try {
            await deleteFile(existing.backgroundImagePath, existing.backgroundImageSha);
        } catch (ghError) {
            console.warn(
                `reoptimize-background ${existing.id}: failed to remove old background`,
                ghError,
            );
        }
    }

    invalidateCachedCertificateBackground(
        existing.backgroundImagePath,
        existing.backgroundImageSha,
    );
    invalidateCachedCertificateBackground(targetPath, existingSha);

    const template = await prisma.certificateTemplate.update({
        where: { id: existing.id },
        data: {
            backgroundImagePath: ghResult.githubPath,
            backgroundImageSha: ghResult.githubSha,
        },
    });

    return {
        id: template.id,
        backgroundImagePath: template.backgroundImagePath,
        backgroundImageSha: template.backgroundImageSha,
        bytesBefore: input.length,
        bytesAfter: optimized.buffer.length,
    };
}

router.get("/", async (req: Request, res: Response) => {
    try {
        const isActiveParam = String(req.query.isActive ?? "all").trim().toLowerCase();
        let where: { isActive?: boolean } = {};
        if (isActiveParam === "true") where = { isActive: true };
        else if (isActiveParam === "false") where = { isActive: false };
        // "all" or anything else → no isActive filter

        const templates = await prisma.certificateTemplate.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: templateIssuedCountSelect,
        });
        return res.json(templates.map(mapTemplateWithIssuedCount));
    } catch (error) {
        console.error("GET /certificate-templates error:", error);
        return res.status(500).json({ error: "Failed to load certificate templates" });
    }
});

/** Batch reoptimize all templates that have a background image. */
router.post("/reoptimize-backgrounds", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    try {
        const templates = await prisma.certificateTemplate.findMany({
            where: { backgroundImagePath: { not: null } },
            orderBy: { id: "asc" },
            select: {
                id: true,
                canvasWidth: true,
                canvasHeight: true,
                backgroundImagePath: true,
                backgroundImageSha: true,
            },
        });

        const results: Array<
            | {
                  id: number;
                  ok: true;
                  backgroundImagePath: string | null;
                  backgroundImageSha: string | null;
                  bytesBefore: number;
                  bytesAfter: number;
              }
            | { id: number; ok: false; error: string }
        > = [];

        for (const template of templates) {
            try {
                const result = await reoptimizeTemplateBackground(template);
                results.push({
                    id: result.id,
                    ok: true,
                    backgroundImagePath: result.backgroundImagePath,
                    backgroundImageSha: result.backgroundImageSha,
                    bytesBefore: result.bytesBefore,
                    bytesAfter: result.bytesAfter,
                });
            } catch (err) {
                results.push({
                    id: template.id,
                    ok: false,
                    error: err instanceof Error ? err.message : "Failed to reoptimize",
                });
            }
        }

        return res.json({
            total: templates.length,
            succeeded: results.filter((r) => r.ok).length,
            failed: results.filter((r) => !r.ok).length,
            results,
        });
    } catch (error) {
        console.error("POST /certificate-templates/reoptimize-backgrounds error:", error);
        return res.status(500).json({ error: "Failed to reoptimize template backgrounds" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const template = await prisma.certificateTemplate.findUnique({
            where: { id },
            include: templateIssuedCountSelect,
        });
        if (!template) return res.status(404).json({ error: "Template not found" });
        return res.json(mapTemplateWithIssuedCount(template));
    } catch (error) {
        console.error("GET /certificate-templates/:id error:", error);
        return res.status(500).json({ error: "Failed to load certificate template" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const name = String(req.body?.name ?? "").trim();
    const layout = req.body?.layout;

    if (!name) {
        return res.status(400).json({ error: "name is required" });
    }
    if (!Array.isArray(layout)) {
        return res.status(400).json({ error: "layout must be an array" });
    }

    let backgroundFocus: { scale: number; offsetX: number; offsetY: number } | null | undefined;
    try {
        backgroundFocus = parseBackgroundFocus(req.body?.backgroundFocus);
    } catch (err) {
        return res.status(400).json({
            error: err instanceof Error ? err.message : "Invalid backgroundFocus",
        });
    }

    const canvasWidth =
        req.body?.canvasWidth !== undefined ? parseCanvasDim(req.body.canvasWidth) : undefined;
    const canvasHeight =
        req.body?.canvasHeight !== undefined ? parseCanvasDim(req.body.canvasHeight) : undefined;
    if (req.body?.canvasWidth !== undefined && canvasWidth == null) {
        return res.status(400).json({ error: "canvasWidth must be an integer between 400 and 4000" });
    }
    if (req.body?.canvasHeight !== undefined && canvasHeight == null) {
        return res.status(400).json({ error: "canvasHeight must be an integer between 400 and 4000" });
    }

    try {
        const template = await prisma.certificateTemplate.create({
            data: {
                name,
                layout,
                canvasWidth: canvasWidth ?? undefined,
                canvasHeight: canvasHeight ?? undefined,
                backgroundImagePath: req.body?.backgroundImagePath ?? null,
                backgroundImageSha: req.body?.backgroundImageSha ?? null,
                backgroundFocus: toBackgroundFocusInput(backgroundFocus),
            },
        });
        return res.status(201).json(template);
    } catch (error) {
        console.error("POST /certificate-templates error:", error);
        return res.status(500).json({ error: "Failed to create certificate template" });
    }
});

router.put("/:id", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });

        const data: {
            name?: string;
            layout?: unknown;
            canvasWidth?: number;
            canvasHeight?: number;
            backgroundFocus?: Prisma.InputJsonValue | typeof Prisma.DbNull;
            backgroundImagePath?: string | null;
            backgroundImageSha?: string | null;
        } = {};

        if (req.body?.name !== undefined) {
            const name = String(req.body.name).trim();
            if (!name) return res.status(400).json({ error: "name cannot be empty" });
            data.name = name;
        }
        if (req.body?.layout !== undefined) {
            if (!Array.isArray(req.body.layout)) {
                return res.status(400).json({ error: "layout must be an array" });
            }
            data.layout = req.body.layout;
        }
        if (req.body?.canvasWidth !== undefined) {
            const canvasWidth = parseCanvasDim(req.body.canvasWidth);
            if (canvasWidth == null) {
                return res.status(400).json({ error: "canvasWidth must be an integer between 400 and 4000" });
            }
            data.canvasWidth = canvasWidth;
        }
        if (req.body?.canvasHeight !== undefined) {
            const canvasHeight = parseCanvasDim(req.body.canvasHeight);
            if (canvasHeight == null) {
                return res.status(400).json({ error: "canvasHeight must be an integer between 400 and 4000" });
            }
            data.canvasHeight = canvasHeight;
        }
        if (req.body?.backgroundFocus !== undefined) {
            try {
                data.backgroundFocus = toBackgroundFocusInput(parseBackgroundFocus(req.body.backgroundFocus));
            } catch (err) {
                return res.status(400).json({
                    error: err instanceof Error ? err.message : "Invalid backgroundFocus",
                });
            }
        }
        if (req.body?.backgroundImagePath !== undefined) {
            if (req.body.backgroundImagePath === null) {
                data.backgroundImagePath = null;
                data.backgroundImageSha = null;
            } else if (typeof req.body.backgroundImagePath === "string") {
                const trimmed = req.body.backgroundImagePath.trim();
                if (!trimmed) {
                    data.backgroundImagePath = null;
                    data.backgroundImageSha = null;
                } else if (!isValidTemplateBackgroundPath(id, trimmed)) {
                    return res.status(400).json({ error: "Invalid backgroundImagePath" });
                } else {
                    data.backgroundImagePath = trimmed;
                }
            } else {
                return res.status(400).json({ error: "Invalid backgroundImagePath" });
            }
        }
        if (req.body?.backgroundImageSha !== undefined && req.body?.backgroundImagePath === undefined) {
            if (req.body.backgroundImageSha === null) {
                data.backgroundImageSha = null;
            } else if (typeof req.body.backgroundImageSha === "string") {
                data.backgroundImageSha = req.body.backgroundImageSha.trim() || null;
            } else {
                return res.status(400).json({ error: "Invalid backgroundImageSha" });
            }
        }

        const template = await prisma.certificateTemplate.update({
            where: { id },
            data: data as never,
        });
        return res.json(template);
    } catch (error) {
        console.error("PUT /certificate-templates/:id error:", error);
        return res.status(500).json({ error: "Failed to update certificate template" });
    }
});

router.post("/:id/upload-background", upload.single("background"), async (req: UploadRequest, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    if (!req.file) {
        return res.status(400).json({ error: "background file is required" });
    }
    if (!req.file.mimetype?.startsWith("image/")) {
        return res.status(400).json({ error: "File must be an image" });
    }

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });

        const optimized = await optimizeCertificateBackground(req.file.buffer, {
            canvasWidth: existing.canvasWidth,
            canvasHeight: existing.canvasHeight,
        });

        const targetPath = templateBackgroundWebpPath(id);
        const existingSha =
            existing.backgroundImagePath === targetPath && existing.backgroundImageSha
                ? existing.backgroundImageSha
                : undefined;

        const ghResult = await uploadContent(
            optimized.buffer,
            targetPath,
            `Upload certificate template ${id} background`,
            existingSha,
        );

        if (
            existing.backgroundImagePath &&
            existing.backgroundImagePath !== targetPath &&
            existing.backgroundImageSha
        ) {
            try {
                await deleteFile(existing.backgroundImagePath, existing.backgroundImageSha);
            } catch (ghError) {
                console.warn(
                    `POST /certificate-templates/${id}/upload-background: failed to remove old background`,
                    ghError,
                );
            }
        }

        invalidateCachedCertificateBackground(
            existing.backgroundImagePath,
            existing.backgroundImageSha,
        );
        invalidateCachedCertificateBackground(targetPath, existingSha);

        const template = await prisma.certificateTemplate.update({
            where: { id },
            data: {
                backgroundImagePath: ghResult.githubPath,
                backgroundImageSha: ghResult.githubSha,
            },
        });

        return res.status(201).json({
            backgroundImagePath: template.backgroundImagePath,
            backgroundImageSha: template.backgroundImageSha,
            bytes: optimized.buffer.length,
        });
    } catch (error) {
        console.error("POST /certificate-templates/:id/upload-background error:", error);
        return res.status(500).json({ error: "Failed to upload template background" });
    }
});

router.get("/:id/background", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const template = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!template) return res.status(404).json({ error: "Template not found" });
        if (!template.backgroundImagePath) {
            return res.status(404).json({ error: "Template has no background image" });
        }

        const { buffer, contentType } = await loadCertificateBackground(
            template.backgroundImagePath,
            template.backgroundImageSha,
        );

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=86400");
        return res.send(buffer);
    } catch (error) {
        console.error("GET /certificate-templates/:id/background error:", error);
        return res.status(500).json({ error: "Failed to load template background" });
    }
});

/** Re-download, WebP-optimize, and re-upload one template background. */
router.post("/:id/reoptimize-background", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });
        if (!existing.backgroundImagePath) {
            return res.status(404).json({ error: "Template has no background image" });
        }

        const result = await reoptimizeTemplateBackground(existing);
        return res.json(result);
    } catch (error) {
        console.error("POST /certificate-templates/:id/reoptimize-background error:", error);
        return res.status(500).json({ error: "Failed to reoptimize template background" });
    }
});

router.patch("/:id/background", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    const backgroundImagePath = req.body?.backgroundImagePath;
    const backgroundImageSha = req.body?.backgroundImageSha;

    if (typeof backgroundImagePath !== "string" || !backgroundImagePath.trim()) {
        return res.status(400).json({ error: "backgroundImagePath is required" });
    }
    if (typeof backgroundImageSha !== "string" || !backgroundImageSha.trim()) {
        return res.status(400).json({ error: "backgroundImageSha is required" });
    }

    const trimmedPath = backgroundImagePath.trim();
    if (!isValidTemplateBackgroundPath(id, trimmedPath)) {
        return res.status(400).json({ error: "Invalid backgroundImagePath" });
    }

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });

        const template = await prisma.certificateTemplate.update({
            where: { id },
            data: {
                backgroundImagePath: trimmedPath,
                backgroundImageSha: backgroundImageSha.trim(),
            },
        });
        return res.json(template);
    } catch (error) {
        console.error("PATCH /certificate-templates/:id/background error:", error);
        return res.status(500).json({ error: "Failed to update template background" });
    }
});

router.patch("/:id/reactivate", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });

        const template = await prisma.certificateTemplate.update({
            where: { id },
            data: { isActive: true },
            include: templateIssuedCountSelect,
        });
        return res.json(mapTemplateWithIssuedCount(template));
    } catch (error) {
        console.error("PATCH /certificate-templates/:id/reactivate error:", error);
        return res.status(500).json({ error: "Failed to reactivate certificate template" });
    }
});

/** Soft-deactivate — hides from new issuance; does not delete issued certificates. */
router.delete("/:id", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });

        await prisma.certificateTemplate.update({
            where: { id },
            data: { isActive: false },
        });
        return res.json({ success: true });
    } catch (error) {
        console.error("DELETE /certificate-templates/:id error:", error);
        return res.status(500).json({ error: "Failed to deactivate certificate template" });
    }
});

/** Hard delete — blocked while any ISSUED certificates reference the template. */
router.delete("/:id/hard", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid template id" });

    try {
        const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Template not found" });

        const issuedCount = await prisma.certificate.count({
            where: { templateId: id, status: "ISSUED" },
        });
        if (issuedCount > 0) {
            return res.status(400).json({
                error: "Cannot delete a template while issued certificates use it",
            });
        }

        if (existing.backgroundImagePath && existing.backgroundImageSha) {
            try {
                await deleteFile(existing.backgroundImagePath, existing.backgroundImageSha);
            } catch (ghError) {
                console.warn(
                    `DELETE /certificate-templates/${id}/hard: failed to remove background from storage`,
                    ghError,
                );
            }
            invalidateCachedCertificateBackground(
                existing.backgroundImagePath,
                existing.backgroundImageSha,
            );
        }

        await prisma.certificateTemplate.delete({ where: { id } });
        return res.json({ success: true });
    } catch (error) {
        console.error("DELETE /certificate-templates/:id/hard error:", error);
        return res.status(500).json({ error: "Failed to delete certificate template" });
    }
});

export default router;
