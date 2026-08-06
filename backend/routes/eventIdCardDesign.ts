import express, { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { canUserAccessEventOperations } from "../lib/eventPermissions";
import { pipeGithubBodyToResponse } from "../lib/pipeGithubResponse";
import type { RequestUser } from "../types/auth";
import * as githubStorage from "../services/githubStorageService";

const { v4: uuidv4 } = require("uuid") as { v4: () => string };

const router: any = express.Router();

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
]);

const CANVAS_MIN = 150;
const CANVAS_MAX = 1500;
const LAYOUT_ELEMENT_TYPES = new Set(["qr", "field", "static"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) cb(null, true);
        else cb(new Error("Only JPEG, PNG, WebP, and HEIC images are allowed"));
    },
});

type UploadRequest = Request & {
    file?: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    };
};

const idCardDesignSelect = {
    id: true,
    idCardCanvasWidth: true,
    idCardCanvasHeight: true,
    idCardLayout: true,
    idCardBackgroundFocus: true,
    idCardBackgroundImageGithubPath: true,
    idCardBackgroundImageGithubSha: true,
    idCardBackgroundImageFileSize: true,
    idCardBackgroundImageMimeType: true,
} as const;

/** Normalize focus JSON: { scale >= 1, offsetX/Y in 0..1 }. Returns null to clear / default cover-center. */
function parseBackgroundFocus(
    value: unknown,
): { scale: number; offsetX: number; offsetY: number } | null | undefined {
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

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function clampCanvasDim(value: number): number {
    return Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.round(value)));
}

function buildBackgroundImagePath(eventId: number, originalFileName: string): string {
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `events/${eventId}/id-card-design/background-${uuidv4()}-${safeName}`;
}

async function ensureCanManageIdCardDesign(
    res: Response,
    user: RequestUser | null | undefined,
    eventId: number,
): Promise<boolean> {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });

    if (!event) {
        res.status(404).json({ error: "Event not found" });
        return false;
    }

    const allowed = await canUserAccessEventOperations(user, eventId, event.isArchived);
    if (!allowed) {
        res.status(403).json({ error: "Access denied" });
        return false;
    }

    return true;
}

async function bestEffortDeleteGithubFile(
    githubPath: string | null | undefined,
    githubSha: string | null | undefined,
): Promise<void> {
    if (!githubPath || !githubSha) return;
    try {
        await githubStorage.deleteFile(githubPath, githubSha);
    } catch (error: any) {
        console.error(
            "GitHub id-card-design background delete failed (continuing):",
            error?.message || error,
        );
    }
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function validateLayout(layout: unknown): { ok: true; layout: unknown[] } | { ok: false; error: string } {
    if (!Array.isArray(layout)) {
        return { ok: false, error: "layout must be an array" };
    }

    for (let i = 0; i < layout.length; i += 1) {
        const el = layout[i];
        if (!el || typeof el !== "object" || Array.isArray(el)) {
            return { ok: false, error: `layout[${i}] must be an object` };
        }
        const item = el as Record<string, unknown>;
        if (typeof item.type !== "string" || !LAYOUT_ELEMENT_TYPES.has(item.type)) {
            return { ok: false, error: `layout[${i}].type must be qr, field, or static` };
        }
        if (!isFiniteNumber(item.x) || !isFiniteNumber(item.y)
            || !isFiniteNumber(item.width) || !isFiniteNumber(item.height)) {
            return { ok: false, error: `layout[${i}] requires numeric x, y, width, and height` };
        }
        if (item.id != null && typeof item.id !== "string") {
            return { ok: false, error: `layout[${i}].id must be a string when provided` };
        }
    }

    return { ok: true, layout };
}

// ============================================
// PUT /api/events/:id/id-card-design
// ============================================
router.put("/:id/id-card-design", async (req: Request, res: Response) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageIdCardDesign(res, req.user, eventId))) return;

        const body = req.body ?? {};
        const data: Record<string, unknown> = {};

        if (Object.prototype.hasOwnProperty.call(body, "canvasWidth")) {
            const raw = body.canvasWidth;
            if (raw === null || raw === undefined || raw === "") {
                return res.status(400).json({ error: "canvasWidth must be a number" });
            }
            const num = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(num)) {
                return res.status(400).json({ error: "canvasWidth must be a number" });
            }
            data.idCardCanvasWidth = clampCanvasDim(num);
        }

        if (Object.prototype.hasOwnProperty.call(body, "canvasHeight")) {
            const raw = body.canvasHeight;
            if (raw === null || raw === undefined || raw === "") {
                return res.status(400).json({ error: "canvasHeight must be a number" });
            }
            const num = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(num)) {
                return res.status(400).json({ error: "canvasHeight must be a number" });
            }
            data.idCardCanvasHeight = clampCanvasDim(num);
        }

        if (Object.prototype.hasOwnProperty.call(body, "layout")) {
            if (body.layout === null) {
                data.idCardLayout = null;
            } else {
                const validated = validateLayout(body.layout);
                if (!validated.ok) {
                    return res.status(400).json({ error: validated.error });
                }
                data.idCardLayout = validated.layout;
            }
        }

        if (Object.prototype.hasOwnProperty.call(body, "backgroundFocus")) {
            try {
                data.idCardBackgroundFocus = toBackgroundFocusInput(
                    parseBackgroundFocus(body.backgroundFocus),
                );
            } catch (err) {
                return res.status(400).json({
                    error: err instanceof Error ? err.message : "Invalid backgroundFocus",
                });
            }
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                error: "Provide at least one of canvasWidth, canvasHeight, layout, backgroundFocus",
            });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data,
            select: idCardDesignSelect,
        });

        return res.json(updated);
    } catch (error) {
        console.error("PUT /events/:id/id-card-design", error);
        return res.status(500).json({ error: "Failed to update ID card design" });
    }
});

// ============================================
// POST /api/events/:id/id-card-design/background-image
// ============================================
router.post(
    "/:id/id-card-design/background-image",
    upload.single("image"),
    async (req: UploadRequest, res: Response) => {
        try {
            const eventId = parseId(req.params.id);
            if (!eventId) {
                return res.status(400).json({ error: "Invalid event ID" });
            }
            if (!(await ensureCanManageIdCardDesign(res, req.user, eventId))) return;

            if (!req.file) {
                return res.status(400).json({ error: "No file provided" });
            }
            if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
                return res.status(400).json({
                    error: "Only JPEG, PNG, WebP, and HEIC images are allowed",
                });
            }

            const existing = await prisma.event.findUnique({
                where: { id: eventId },
                select: idCardDesignSelect,
            });
            if (!existing) {
                return res.status(404).json({ error: "Event not found" });
            }

            const githubPath = buildBackgroundImagePath(eventId, req.file.originalname);
            const ghResult = await githubStorage.uploadContent(
                req.file.buffer,
                githubPath,
                `Upload ID card background for event ${eventId}`,
            );

            await bestEffortDeleteGithubFile(
                existing.idCardBackgroundImageGithubPath,
                existing.idCardBackgroundImageGithubSha,
            );

            const updated = await prisma.event.update({
                where: { id: eventId },
                data: {
                    idCardBackgroundImageGithubPath: ghResult.githubPath,
                    idCardBackgroundImageGithubSha: ghResult.githubSha,
                    idCardBackgroundImageFileSize: req.file.size,
                    idCardBackgroundImageMimeType: req.file.mimetype,
                },
                select: idCardDesignSelect,
            });

            return res.json(updated);
        } catch (error: any) {
            console.error("POST /events/:id/id-card-design/background-image", error);
            return res.status(500).json({
                error: error?.message || "Failed to upload ID card background image",
            });
        }
    },
);

// ============================================
// DELETE /api/events/:id/id-card-design/background-image
// ============================================
router.delete("/:id/id-card-design/background-image", async (req: Request, res: Response) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageIdCardDesign(res, req.user, eventId))) return;

        const existing = await prisma.event.findUnique({
            where: { id: eventId },
            select: idCardDesignSelect,
        });
        if (!existing) {
            return res.status(404).json({ error: "Event not found" });
        }

        await bestEffortDeleteGithubFile(
            existing.idCardBackgroundImageGithubPath,
            existing.idCardBackgroundImageGithubSha,
        );

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                idCardBackgroundImageGithubPath: null,
                idCardBackgroundImageGithubSha: null,
                idCardBackgroundImageFileSize: null,
                idCardBackgroundImageMimeType: null,
            },
            select: idCardDesignSelect,
        });

        return res.json(updated);
    } catch (error) {
        console.error("DELETE /events/:id/id-card-design/background-image", error);
        return res.status(500).json({ error: "Failed to delete ID card background image" });
    }
});

// ============================================
// GET /api/events/:id/id-card-design/background-image/download
// ============================================
router.get("/:id/id-card-design/background-image/download", async (req: Request, res: Response) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageIdCardDesign(res, req.user, eventId))) return;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: idCardDesignSelect,
        });
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        if (!event.idCardBackgroundImageGithubPath) {
            return res.status(404).json({ error: "ID card background image not found" });
        }

        const ghResponse = await githubStorage.downloadFile(event.idCardBackgroundImageGithubPath);
        res.setHeader("Content-Type", event.idCardBackgroundImageMimeType || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            'inline; filename="id-card-background-image"',
        );
        if (event.idCardBackgroundImageFileSize) {
            res.setHeader("Content-Length", event.idCardBackgroundImageFileSize);
        }

        await pipeGithubBodyToResponse(ghResponse, res);
        return;
    } catch (error) {
        console.error("GET /events/:id/id-card-design/background-image/download", error);
        return res.status(500).json({ error: "Failed to download ID card background image" });
    }
});

export default router;
