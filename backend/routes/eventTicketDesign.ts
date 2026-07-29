import express, { Request, Response } from "express";
import multer from "multer";
import { normalizeHex } from "@iclub/shared/utils";
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

const ticketDesignSelect = {
    id: true,
    ticketAccentColor: true,
    ticketHeaderTitle: true,
    ticketHeaderSubtitle: true,
    ticketFooterNote: true,
    ticketHeaderImageGithubPath: true,
    ticketHeaderImageGithubSha: true,
    ticketHeaderImageFileSize: true,
    ticketHeaderImageMimeType: true,
    ticketFooterImageGithubPath: true,
    ticketFooterImageGithubSha: true,
    ticketFooterImageFileSize: true,
    ticketFooterImageMimeType: true,
} as const;

type TicketImageSlot = "header" | "footer";

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildTicketDesignImagePath(
    eventId: number,
    slot: TicketImageSlot,
    originalFileName: string,
): string {
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `events/${eventId}/ticket-design/${slot}-${uuidv4()}-${safeName}`;
}

function nullableTrimmedString(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function ensureCanManageTicketDesign(
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
            "GitHub ticket-design image delete failed (continuing):",
            error?.message || error,
        );
    }
}

function imageColumnData(slot: TicketImageSlot, data: {
    githubPath: string | null;
    githubSha: string | null;
    fileSize: number | null;
    mimeType: string | null;
}) {
    if (slot === "header") {
        return {
            ticketHeaderImageGithubPath: data.githubPath,
            ticketHeaderImageGithubSha: data.githubSha,
            ticketHeaderImageFileSize: data.fileSize,
            ticketHeaderImageMimeType: data.mimeType,
        };
    }
    return {
        ticketFooterImageGithubPath: data.githubPath,
        ticketFooterImageGithubSha: data.githubSha,
        ticketFooterImageFileSize: data.fileSize,
        ticketFooterImageMimeType: data.mimeType,
    };
}

function getImageFields(
    event: {
        ticketHeaderImageGithubPath: string | null;
        ticketHeaderImageGithubSha: string | null;
        ticketHeaderImageFileSize: number | null;
        ticketHeaderImageMimeType: string | null;
        ticketFooterImageGithubPath: string | null;
        ticketFooterImageGithubSha: string | null;
        ticketFooterImageFileSize: number | null;
        ticketFooterImageMimeType: string | null;
    },
    slot: TicketImageSlot,
) {
    if (slot === "header") {
        return {
            githubPath: event.ticketHeaderImageGithubPath,
            githubSha: event.ticketHeaderImageGithubSha,
            fileSize: event.ticketHeaderImageFileSize,
            mimeType: event.ticketHeaderImageMimeType,
            fileName: "ticket-header-image",
        };
    }
    return {
        githubPath: event.ticketFooterImageGithubPath,
        githubSha: event.ticketFooterImageGithubSha,
        fileSize: event.ticketFooterImageFileSize,
        mimeType: event.ticketFooterImageMimeType,
        fileName: "ticket-footer-image",
    };
}

// ============================================
// PUT /api/events/:id/ticket-design
// ============================================
router.put("/:id/ticket-design", async (req: Request, res: Response) => {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageTicketDesign(res, req.user, eventId))) return;

        const data: Record<string, string | null> = {};

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "accentColor")) {
            const raw = req.body.accentColor;
            if (raw === null || raw === "") {
                data.ticketAccentColor = null;
            } else if (typeof raw === "string") {
                const normalized = normalizeHex(raw);
                if (!normalized) {
                    return res.status(400).json({ error: "accentColor must be a valid hex color" });
                }
                data.ticketAccentColor = normalized;
            } else {
                return res.status(400).json({ error: "accentColor must be a valid hex color" });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "headerTitle")) {
            const raw = req.body.headerTitle;
            if (raw !== null && typeof raw !== "string") {
                return res.status(400).json({ error: "headerTitle must be a string or null" });
            }
            data.ticketHeaderTitle = nullableTrimmedString(raw);
        }

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "headerSubtitle")) {
            const raw = req.body.headerSubtitle;
            if (raw !== null && typeof raw !== "string") {
                return res.status(400).json({ error: "headerSubtitle must be a string or null" });
            }
            data.ticketHeaderSubtitle = nullableTrimmedString(raw);
        }

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "footerNote")) {
            const raw = req.body.footerNote;
            if (raw !== null && typeof raw !== "string") {
                return res.status(400).json({ error: "footerNote must be a string or null" });
            }
            data.ticketFooterNote = nullableTrimmedString(raw);
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                error: "Provide at least one of accentColor, headerTitle, headerSubtitle, footerNote",
            });
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data,
            select: ticketDesignSelect,
        });

        return res.json(updated);
    } catch (error) {
        console.error("PUT /events/:id/ticket-design", error);
        return res.status(500).json({ error: "Failed to update ticket design" });
    }
});

async function handleImageUpload(
    req: UploadRequest,
    res: Response,
    slot: TicketImageSlot,
) {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageTicketDesign(res, req.user, eventId))) return;

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
            select: ticketDesignSelect,
        });
        if (!existing) {
            return res.status(404).json({ error: "Event not found" });
        }

        const previous = getImageFields(existing, slot);
        const githubPath = buildTicketDesignImagePath(eventId, slot, req.file.originalname);
        const ghResult = await githubStorage.uploadContent(
            req.file.buffer,
            githubPath,
            `Upload ticket ${slot} image for event ${eventId}`,
        );

        await bestEffortDeleteGithubFile(previous.githubPath, previous.githubSha);

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: imageColumnData(slot, {
                githubPath: ghResult.githubPath,
                githubSha: ghResult.githubSha,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
            }),
            select: ticketDesignSelect,
        });

        return res.json(updated);
    } catch (error: any) {
        console.error(`POST /events/:id/ticket-design/${slot}-image`, error);
        return res.status(500).json({
            error: error?.message || `Failed to upload ticket ${slot} image`,
        });
    }
}

async function handleImageDelete(
    req: Request,
    res: Response,
    slot: TicketImageSlot,
) {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageTicketDesign(res, req.user, eventId))) return;

        const existing = await prisma.event.findUnique({
            where: { id: eventId },
            select: ticketDesignSelect,
        });
        if (!existing) {
            return res.status(404).json({ error: "Event not found" });
        }

        const previous = getImageFields(existing, slot);
        await bestEffortDeleteGithubFile(previous.githubPath, previous.githubSha);

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: imageColumnData(slot, {
                githubPath: null,
                githubSha: null,
                fileSize: null,
                mimeType: null,
            }),
            select: ticketDesignSelect,
        });

        return res.json(updated);
    } catch (error) {
        console.error(`DELETE /events/:id/ticket-design/${slot}-image`, error);
        return res.status(500).json({ error: `Failed to delete ticket ${slot} image` });
    }
}

async function handleImageDownload(
    req: Request,
    res: Response,
    slot: TicketImageSlot,
) {
    try {
        const eventId = parseId(req.params.id);
        if (!eventId) {
            return res.status(400).json({ error: "Invalid event ID" });
        }
        if (!(await ensureCanManageTicketDesign(res, req.user, eventId))) return;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: ticketDesignSelect,
        });
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        const image = getImageFields(event, slot);
        if (!image.githubPath) {
            return res.status(404).json({ error: `Ticket ${slot} image not found` });
        }

        const ghResponse = await githubStorage.downloadFile(image.githubPath);
        res.setHeader("Content-Type", image.mimeType || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${image.fileName}"`,
        );
        if (image.fileSize) {
            res.setHeader("Content-Length", image.fileSize);
        }

        await pipeGithubBodyToResponse(ghResponse, res);
        return;
    } catch (error) {
        console.error(`GET /events/:id/ticket-design/${slot}-image/download`, error);
        return res.status(500).json({ error: `Failed to download ticket ${slot} image` });
    }
}

router.post(
    "/:id/ticket-design/header-image",
    upload.single("image"),
    (req: Request, res: Response) => handleImageUpload(req as UploadRequest, res, "header"),
);

router.post(
    "/:id/ticket-design/footer-image",
    upload.single("image"),
    (req: Request, res: Response) => handleImageUpload(req as UploadRequest, res, "footer"),
);

router.delete(
    "/:id/ticket-design/header-image",
    (req: Request, res: Response) => handleImageDelete(req, res, "header"),
);

router.delete(
    "/:id/ticket-design/footer-image",
    (req: Request, res: Response) => handleImageDelete(req, res, "footer"),
);

router.get(
    "/:id/ticket-design/header-image/download",
    (req: Request, res: Response) => handleImageDownload(req, res, "header"),
);

router.get(
    "/:id/ticket-design/footer-image/download",
    (req: Request, res: Response) => handleImageDownload(req, res, "footer"),
);

export default router;
