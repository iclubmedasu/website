import express, { Request, Response } from "express";
import { prisma } from "../db";
import { isSessionEndedAt, serializeEventSession } from "../lib/eventSessionTime";
import {
    countActiveSessionRegistrationsForSessions,
    splitSessionsForTicket,
    withSessionCapacityFields,
} from "../lib/eventSessionCapacity";
import {
    EVENT_PHOTO_PREVIEW_CONTENT_TYPE,
    eventPhotoPreviewGithubPath,
    optimizeEventPhoto,
} from "../lib/optimizeEventPhoto";
import { pipeGithubBodyToResponse } from "../lib/pipeGithubResponse";
import { sendEmail } from "../services/emailService";
import { buildRegistrationJoinUrl } from "../services/eventTicketEmailService";
import { generateTokensForRegistration, getSessionTokensForRegistration } from "../services/sessionTokenService";
import * as githubStorage from "../services/githubStorageService";
import { buildMemberTimeline, toMemberProfileView } from "../lib/memberProfileVisibility";
import { buildPublicMemberDirectory } from "../lib/publicMemberDirectory";
import { getPublicWebsiteUrl } from "../lib/publicWebsiteUrl";
import { getAboutPageData, getActiveSocialLinks, getContactPageData } from "../lib/siteContent";
import { createIncidentReportSubmission, getSupportPageData } from "../lib/supportContent";
import { resolveEventByIdOrSlug, resolveProjectByIdOrSlug } from "../lib/publicEntitySlug";
import { contactPostLimiter, incidentReportPostLimiter } from "../middleware/rateLimit";

const PUBLIC_EVENT_PHOTO_CACHE_CONTROL =
    "public, max-age=86400, stale-while-revalidate=604800";
const router = express.Router();

/** Coalesce concurrent preview backfills for the same photo id. */
const previewBackfillInFlight = new Map<string, Promise<void>>();

function scheduleEventPhotoPreviewPersist(
    photoId: number,
    originalGithubPath: string,
    optimizedBuffer: Buffer,
): void {
    const key = `event:${photoId}`;
    if (previewBackfillInFlight.has(key)) return;

    const work = (async () => {
        const previewPath = eventPhotoPreviewGithubPath(originalGithubPath);
        const previewResult = await githubStorage.uploadContent(
            optimizedBuffer,
            previewPath,
            `Backfill preview for event photo ${photoId}`,
        );
        await prisma.eventPhoto.update({
            where: { id: photoId },
            data: {
                previewGithubPath: previewResult.githubPath,
                previewGithubSha: previewResult.githubSha,
                previewFileSize: optimizedBuffer.length,
            },
        });
    })()
        .catch((previewErr) => {
            console.warn(
                "GET /public/event-photos/:id/download preview backfill failed (non-fatal; served optimized in-memory):",
                previewErr instanceof Error ? previewErr.message : previewErr,
            );
        })
        .finally(() => {
            previewBackfillInFlight.delete(key);
        });

    previewBackfillInFlight.set(key, work);
}

function scheduleProjectPhotoPreviewPersist(
    photoId: number,
    originalGithubPath: string,
    optimizedBuffer: Buffer,
): void {
    const key = `project:${photoId}`;
    if (previewBackfillInFlight.has(key)) return;

    const work = (async () => {
        const previewPath = eventPhotoPreviewGithubPath(originalGithubPath);
        const previewResult = await githubStorage.uploadContent(
            optimizedBuffer,
            previewPath,
            `Backfill preview for project photo ${photoId}`,
        );
        await prisma.projectPhoto.update({
            where: { id: photoId },
            data: {
                previewGithubPath: previewResult.githubPath,
                previewGithubSha: previewResult.githubSha,
                previewFileSize: optimizedBuffer.length,
            },
        });
    })()
        .catch((previewErr) => {
            console.warn(
                "GET /public/project-photos/:id/download preview backfill failed (non-fatal; served optimized in-memory):",
                previewErr instanceof Error ? previewErr.message : previewErr,
            );
        })
        .finally(() => {
            previewBackfillInFlight.delete(key);
        });

    previewBackfillInFlight.set(key, work);
}

const DEFAULT_CONTACT_INBOX = "asu.medicine.iclub@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EventCapacityRow = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    eventDate: Date;
    eventEndDate: Date;
    venue: string | null;
    timezone: string;
    registrationDeadline: Date | null;
    capacity: number | null;
    status: string;
    isActive: boolean;
    isArchived: boolean;
    isPublished: boolean;
    isDisclosed?: boolean;
    projectType?: { name: string } | null;
};

const publicEventSelect = {
    id: true,
    slug: true,
    title: true,
    description: true,
    eventDate: true,
    eventEndDate: true,
    venue: true,
    timezone: true,
    registrationDeadline: true,
    capacity: true,
    status: true,
    isActive: true,
    isArchived: true,
    isPublished: true,
    isDisclosed: true,
    isFinalized: true,
    projectType: { select: { name: true } },
} as const;

const publicProjectSelect = {
    id: true,
    slug: true,
    title: true,
    description: true,
    completedDate: true,
    projectType: {
        select: {
            name: true,
            category: true,
        },
    },
    tags: {
        select: {
            tagName: true,
        },
    },
} as const;

function parseLimit(value: unknown, fallback: number, max = 50): number {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.min(parsed, max);
}

function parseEventId(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseMemberId(value: string): number | null {
    return parseEventId(value);
}

function isPublicEligibleMember(member: {
    fullName: string;
    isActive: boolean;
    assignmentStatus: string;
}): boolean {
    return member.isActive && member.assignmentStatus !== "ALUMNI" && member.fullName !== "Pending";
}

function isTruthyQuery(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "true" || normalized === "1";
}

function isUpcomingQuery(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "" || normalized === "true" || normalized === "1";
}

/** Live published events (registration-capable). */
function canPublicViewEvent(event: {
    isPublished: boolean;
    isActive: boolean;
    isArchived: boolean;
    isFinalized: boolean;
}): boolean {
    return event.isActive && !event.isArchived && !event.isFinalized && event.isPublished;
}

/** Live published OR any disclosed event (past public detail/photos). */
function canPublicViewEventDetail(event: {
    isPublished: boolean;
    isActive: boolean;
    isArchived: boolean;
    isDisclosed: boolean;
    isFinalized?: boolean;
}): boolean {
    if (event.isDisclosed) {
        return true;
    }
    return canPublicViewEvent({
        ...event,
        isFinalized: event.isFinalized ?? false,
    });
}

/** Disclosed projects are publicly visible (parity with event disclose). */
function canPublicViewProject(project: { isDisclosed: boolean }): boolean {
    return project.isDisclosed;
}

function computeSpotsRemaining(capacity: number | null | undefined, registeredCount: number): number | null {
    if (capacity == null) return null;
    return Math.max(capacity - registeredCount, 0);
}

function isRegistrationOpen(
    event: Pick<EventCapacityRow, "registrationDeadline" | "capacity" | "eventEndDate">,
    registeredCount: number,
    now: Date,
): boolean {
    if (event.registrationDeadline && event.registrationDeadline < now) {
        return false;
    }
    if (event.eventEndDate < now) {
        return false;
    }
    if (event.capacity != null && registeredCount >= event.capacity) {
        return false;
    }
    return true;
}

async function getRegistrationCountsByEventIds(eventIds: number[]): Promise<Map<number, number>> {
    if (eventIds.length === 0) {
        return new Map();
    }

    const groups = await prisma.eventRegistration.groupBy({
        by: ["eventId"],
        where: {
            eventId: { in: eventIds },
            status: { not: "CANCELLED" },
        },
        _count: { _all: true },
    });

    return new Map(groups.map((group) => [group.eventId, group._count._all]));
}

async function getTierRegistrationCounts(eventId: number, tierIds: number[]): Promise<Map<number, number>> {
    if (tierIds.length === 0) {
        return new Map();
    }

    const groups = await prisma.eventRegistration.groupBy({
        by: ["tierId"],
        where: {
            eventId,
            tierId: { in: tierIds },
            status: { not: "CANCELLED" },
        },
        _count: { _all: true },
    });

    return new Map(
        groups
            .filter((group) => group.tierId != null)
            .map((group) => [group.tierId as number, group._count._all]),
    );
}

function serializePublicEventListItem(
    event: EventCapacityRow,
    registeredCount: number,
    now: Date,
    options?: { includeDescription?: boolean },
) {
    const spotsRemaining = computeSpotsRemaining(event.capacity, registeredCount);
    const registrationOpen = isRegistrationOpen(event, registeredCount, now);

    return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        ...(options?.includeDescription ? { description: event.description } : {}),
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        venue: event.venue,
        timezone: event.timezone,
        registrationDeadline: event.registrationDeadline,
        capacity: event.capacity,
        registeredCount,
        spotsRemaining,
        registrationOpen,
        projectType: event.projectType ? { name: event.projectType.name } : null,
    };
}

function shuffleInPlace<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = items[i]!;
        items[i] = items[j]!;
        items[j] = tmp;
    }
    return items;
}

const HIGHLIGHTS_MAX_SOURCES = 5;
const HIGHLIGHTS_MAX_PHOTOS_PER_SOURCE = 10;

type HighlightCandidatePhoto = {
    id: number;
    isCore: boolean;
    showOnPublic: boolean;
};

type HighlightSource = {
    source: "event" | "project";
    title: string;
    slug: string;
    recency: Date;
    photos: HighlightCandidatePhoto[];
};

/** Prefer core photos, then randomly fill from public photos up to the per-source cap. */
function selectHighlightPhotosForSource(
    photos: HighlightCandidatePhoto[],
    maxPhotos = HIGHLIGHTS_MAX_PHOTOS_PER_SOURCE,
): HighlightCandidatePhoto[] {
    const core = shuffleInPlace(photos.filter((photo) => photo.isCore)).slice(0, maxPhotos);
    const coreIds = new Set(core.map((photo) => photo.id));
    const fillers = shuffleInPlace(
        photos.filter((photo) => photo.showOnPublic && !coreIds.has(photo.id)),
    ).slice(0, Math.max(0, maxPhotos - core.length));
    return [...core, ...fillers];
}

router.get("/highlights/photos", async (_req: Request, res: Response) => {
    try {
        const photoWhere = {
            isActive: true,
            OR: [{ isCore: true }, { showOnPublic: true }],
        };
        const photoSelect = {
            id: true,
            isCore: true,
            showOnPublic: true,
        };

        const [events, projects] = await Promise.all([
            prisma.event.findMany({
                where: {
                    isDisclosed: true,
                    photos: { some: photoWhere },
                },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    eventDate: true,
                    eventEndDate: true,
                    photos: {
                        where: photoWhere,
                        select: photoSelect,
                    },
                },
            }),
            prisma.project.findMany({
                where: {
                    isDisclosed: true,
                    photos: { some: photoWhere },
                },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    completedDate: true,
                    updatedAt: true,
                    photos: {
                        where: photoWhere,
                        select: photoSelect,
                    },
                },
            }),
        ]);

        const sources: HighlightSource[] = [
            ...events.map((event) => ({
                source: "event" as const,
                title: event.title,
                slug: event.slug,
                recency: event.eventEndDate ?? event.eventDate,
                photos: event.photos,
            })),
            ...projects.map((project) => ({
                source: "project" as const,
                title: project.title,
                slug: project.slug,
                recency: project.completedDate ?? project.updatedAt,
                photos: project.photos,
            })),
        ];

        // Hide Highlights unless there is at least one disclosed event/project with eligible photos
        if (sources.length === 0) {
            return res.json([]);
        }

        sources.sort((a, b) => b.recency.getTime() - a.recency.getTime());
        const selectedSources = sources.slice(0, HIGHLIGHTS_MAX_SOURCES);
        const highlights = selectedSources.flatMap((item) => {
            const photos = selectHighlightPhotosForSource(item.photos);
            const downloadBase =
                item.source === "event"
                    ? "/api/public/event-photos"
                    : "/api/public/project-photos";
            return photos.map((photo) => ({
                id: photo.id,
                downloadUrl: `${downloadBase}/${photo.id}/download`,
                source: item.source,
                title: item.title,
                slug: item.slug,
            }));
        });

        return res.json(highlights);
    } catch (error) {
        console.error("GET /public/highlights/photos error:", error);
        return res.status(500).json({ error: "Failed to load highlight photos" });
    }
});

router.get("/events", async (req: Request, res: Response) => {
    try {
        const limit = parseLimit(req.query.limit, 50);
        const past = isTruthyQuery(req.query.past);
        const upcoming = isUpcomingQuery(req.query.upcoming);
        const registerable = isTruthyQuery(req.query.registerable);
        const now = new Date();

        if (past) {
            const events = await prisma.event.findMany({
                where: {
                    isDisclosed: true,
                },
                select: publicEventSelect,
                orderBy: { eventEndDate: "desc" },
                take: limit,
            });

            const counts = await getRegistrationCountsByEventIds(events.map((event) => event.id));
            const items = events.map((event) =>
                serializePublicEventListItem(event, counts.get(event.id) ?? 0, now, { includeDescription: true }),
            );

            return res.json(items);
        }

        const where: Record<string, unknown> = {
            isActive: true,
            isArchived: false,
            isFinalized: false,
            isPublished: true,
        };

        if (upcoming || registerable) {
            where.eventEndDate = { gte: now };
        }

        if (registerable) {
            where.OR = [
                { registrationDeadline: null },
                { registrationDeadline: { gte: now } },
            ];
        }

        const events = await prisma.event.findMany({
            where,
            select: publicEventSelect,
            orderBy: { eventDate: "asc" },
            take: registerable ? limit * 3 : limit,
        });

        const counts = await getRegistrationCountsByEventIds(events.map((event) => event.id));
        let items = events.map((event) =>
            serializePublicEventListItem(event, counts.get(event.id) ?? 0, now, { includeDescription: true }),
        );

        if (registerable) {
            items = items.filter((item) => item.registrationOpen).slice(0, limit);
        } else {
            items = items.slice(0, limit);
        }

        return res.json(items);
    } catch (error) {
        console.error("GET /public/events error:", error);
        return res.status(500).json({ error: "Failed to load events" });
    }
});

router.get("/events/:id", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }

        const event = await prisma.event.findUnique({
            where: { id: resolved.id },
            select: publicEventSelect,
        });

        if (!event || !canPublicViewEventDetail(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        const registeredCount = await prisma.eventRegistration.count({
            where: { eventId: resolved.id, status: { not: "CANCELLED" } },
        });

        const payload = serializePublicEventListItem(event, registeredCount, new Date(), {
            includeDescription: true,
        });

        // Past/archived events are view-only: registration is closed.
        if (event.isArchived) {
            return res.json({ ...payload, registrationOpen: false });
        }

        return res.json(payload);
    } catch (error) {
        console.error("GET /public/events/:id error:", error);
        return res.status(500).json({ error: "Failed to load event" });
    }
});

router.get("/events/:id/photos", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }

        const event = await prisma.event.findUnique({
            where: { id: resolved.id },
            select: {
                isPublished: true,
                isActive: true,
                isArchived: true,
                isDisclosed: true,
                isFinalized: true,
            },
        });

        if (!event || !canPublicViewEventDetail(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        const photos = await prisma.eventPhoto.findMany({
            where: {
                eventId: resolved.id,
                isActive: true,
                showOnPublic: true,
            },
            orderBy: [{ eventDay: "asc" }, { order: "asc" }],
            select: {
                id: true,
                fileName: true,
                eventDay: true,
                caption: true,
            },
        });

        return res.json(
            photos.map((photo) => ({
                id: photo.id,
                fileName: photo.fileName,
                eventDay: photo.eventDay,
                caption: photo.caption,
                downloadUrl: `/api/public/event-photos/${photo.id}/download`,
            })),
        );
    } catch (error) {
        console.error("GET /public/events/:id/photos error:", error);
        return res.status(500).json({ error: "Failed to load event photos" });
    }
});

router.get("/event-photos/:id/download", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) {
            return res.status(404).json({ error: "Photo not found" });
        }

        const photo = await prisma.eventPhoto.findUnique({
            where: { id },
            include: {
                event: {
                    select: {
                        isPublished: true,
                        isActive: true,
                        isArchived: true,
                        isDisclosed: true,
                        isFinalized: true,
                    },
                },
            },
        });

        if (
            !photo
            || !photo.isActive
            || (!photo.showOnPublic && !photo.isCore)
            || !canPublicViewEventDetail(photo.event)
        ) {
            return res.status(404).json({ error: "Photo not found" });
        }

        res.setHeader("Cache-Control", PUBLIC_EVENT_PHOTO_CACHE_CONTROL);

        if (photo.previewGithubPath) {
            const ghResponse = await githubStorage.downloadFile(photo.previewGithubPath);
            res.setHeader("Content-Type", EVENT_PHOTO_PREVIEW_CONTENT_TYPE);
            res.setHeader(
                "Content-Disposition",
                `inline; filename="${photo.fileName.replace(/\.[^.]+$/, "") || "photo"}-preview.webp"`,
            );
            if (photo.previewFileSize) {
                res.setHeader("Content-Length", photo.previewFileSize);
            }
            await pipeGithubBodyToResponse(ghResponse, res);
            return;
        }

        const ghResponse = await githubStorage.downloadFile(photo.githubPath);
        const originalBuffer = Buffer.from(await ghResponse.arrayBuffer());

        try {
            const optimized = await optimizeEventPhoto(originalBuffer);
            // Serve immediately; persist to GitHub+DB in the background (coalesced).
            scheduleEventPhotoPreviewPersist(photo.id, photo.githubPath, optimized.buffer);

            res.setHeader("Content-Type", EVENT_PHOTO_PREVIEW_CONTENT_TYPE);
            res.setHeader(
                "Content-Disposition",
                `inline; filename="${photo.fileName.replace(/\.[^.]+$/, "") || "photo"}-preview.webp"`,
            );
            res.setHeader("Content-Length", optimized.buffer.length);
            return res.send(optimized.buffer);
        } catch (previewErr) {
            console.error(
                "GET /public/event-photos/:id/download optimize failed (serving original):",
                previewErr,
            );
            res.setHeader("Content-Type", photo.mimeType);
            res.setHeader("Content-Disposition", `inline; filename="${photo.fileName}"`);
            res.setHeader("Content-Length", originalBuffer.length);
            return res.send(originalBuffer);
        }
    } catch (error) {
        console.error("GET /public/event-photos/:id/download error:", error);
        return res.status(500).json({ error: "Failed to download photo" });
    }
});

async function streamPublicTicketDesignImage(
    req: Request,
    res: Response,
    slot: "header" | "footer",
): Promise<Response | void> {
    const resolved = await resolveEventByIdOrSlug(String(req.params.id));
    if (!resolved) {
        return res.status(404).json({ error: "Image not found" });
    }

    const event = await prisma.event.findUnique({
        where: { id: resolved.id },
        select: {
            isPublished: true,
            isActive: true,
            isArchived: true,
            isDisclosed: true,
            isFinalized: true,
            ticketHeaderImageGithubPath: true,
            ticketHeaderImageFileSize: true,
            ticketHeaderImageMimeType: true,
            ticketFooterImageGithubPath: true,
            ticketFooterImageFileSize: true,
            ticketFooterImageMimeType: true,
        },
    });

    if (!event || !canPublicViewEvent(event)) {
        return res.status(404).json({ error: "Image not found" });
    }

    const githubPath = slot === "header"
        ? event.ticketHeaderImageGithubPath
        : event.ticketFooterImageGithubPath;
    const mimeType = slot === "header"
        ? event.ticketHeaderImageMimeType
        : event.ticketFooterImageMimeType;
    const fileSize = slot === "header"
        ? event.ticketHeaderImageFileSize
        : event.ticketFooterImageFileSize;

    if (!githubPath) {
        return res.status(404).json({ error: "Image not found" });
    }

    const ghResponse = await githubStorage.downloadFile(githubPath);
    res.setHeader("Cache-Control", PUBLIC_EVENT_PHOTO_CACHE_CONTROL);
    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader(
        "Content-Disposition",
        `inline; filename="ticket-${slot}-image"`,
    );
    if (fileSize) {
        res.setHeader("Content-Length", fileSize);
    }
    await pipeGithubBodyToResponse(ghResponse, res);
}

router.get("/events/:id/ticket-design/header-image", async (req: Request, res: Response) => {
    try {
        return await streamPublicTicketDesignImage(req, res, "header");
    } catch (error) {
        console.error("GET /public/events/:id/ticket-design/header-image error:", error);
        return res.status(500).json({ error: "Failed to download ticket header image" });
    }
});

router.get("/events/:id/ticket-design/footer-image", async (req: Request, res: Response) => {
    try {
        return await streamPublicTicketDesignImage(req, res, "footer");
    } catch (error) {
        console.error("GET /public/events/:id/ticket-design/footer-image error:", error);
        return res.status(500).json({ error: "Failed to download ticket footer image" });
    }
});

router.get("/events/:id/tiers", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }
        const eventId = resolved.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, isActive: true, isArchived: true, isFinalized: true, isPublished: true },
        });

        if (!event || event.isArchived || !canPublicViewEvent(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        const tiers = await prisma.eventTier.findMany({
            where: { eventId, isActive: true, showOnPublic: true },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                maxCapacity: true,
                isActive: true,
                showOnPublic: true,
            },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        });

        const tierCounts = await getTierRegistrationCounts(
            eventId,
            tiers.map((tier) => tier.id),
        );

        const payload = tiers.map((tier) => {
            const registeredCount = tierCounts.get(tier.id) ?? 0;
            return {
                ...tier,
                registeredCount,
                spotsRemaining: computeSpotsRemaining(tier.maxCapacity, registeredCount),
            };
        });

        return res.json(payload);
    } catch (error) {
        console.error("GET /public/events/:id/tiers error:", error);
        return res.status(500).json({ error: "Failed to load event tiers" });
    }
});

router.get("/events/:id/custom-fields", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }
        const eventId = resolved.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, isActive: true, isArchived: true, isFinalized: true, isPublished: true },
        });

        if (!event || event.isArchived || !canPublicViewEvent(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        const fields = await prisma.eventCustomField.findMany({
            where: {
                eventId,
                showOnPublic: true,
                isActive: true,
            },
            select: {
                id: true,
                label: true,
                type: true,
                options: true,
                required: true,
                order: true,
            },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        });

        return res.json(fields);
    } catch (error) {
        console.error("GET /public/events/:id/custom-fields error:", error);
        return res.status(500).json({ error: "Failed to load custom fields" });
    }
});

router.get("/events/:id/sessions", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }
        const eventId = resolved.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                isActive: true,
                isArchived: true,
                isFinalized: true,
                isPublished: true,
                timezone: true,
            },
        });

        if (!event || event.isArchived || !canPublicViewEvent(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        const tz = event.timezone?.trim() || "Africa/Cairo";
        const sessions = await prisma.eventSession.findMany({
            where: { eventId, isActive: true },
            orderBy: [{ startDateTime: "asc" }, { sessionDate: "asc" }, { order: "asc" }],
        });

        const counts = await countActiveSessionRegistrationsForSessions(sessions.map((session) => session.id));
        const now = new Date();
        return res.json(sessions.map((session) => ({
            ...withSessionCapacityFields(
                serializeEventSession(session, tz),
                counts.get(session.id) ?? 0,
            ),
            hasEnded: isSessionEndedAt(session, now, tz),
        })));
    } catch (error) {
        console.error("GET /public/events/:id/sessions error:", error);
        return res.status(500).json({ error: "Failed to load event sessions" });
    }
});

router.get("/events/:id/registration-form", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }
        const eventId = resolved.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                isActive: true,
                isArchived: true,
                isFinalized: true,
                isPublished: true,
                tierFieldShowOnPublic: true,
                tierFieldRequired: true,
                sessionFieldShowOnPublic: true,
                sessionFieldRequired: true,
                phoneFieldRequired: true,
            },
        });

        if (!event || event.isArchived || !canPublicViewEvent(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        return res.json({
            tierFieldShowOnPublic: event.tierFieldShowOnPublic,
            tierFieldRequired: event.tierFieldRequired,
            sessionFieldShowOnPublic: event.sessionFieldShowOnPublic,
            sessionFieldRequired: event.sessionFieldRequired,
            phoneFieldRequired: event.phoneFieldRequired,
        });
    } catch (error) {
        console.error("GET /public/events/:id/registration-form error:", error);
        return res.status(500).json({ error: "Failed to load registration form settings" });
    }
});

router.get("/events/:id/confirmation", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        const confirmationCode = String(req.query.code ?? "").trim().toUpperCase();

        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }
        if (!confirmationCode) {
            return res.status(400).json({ error: "code is required" });
        }

        const eventId = resolved.id;

        const registration = await prisma.eventRegistration.findFirst({
            where: {
                eventId,
                confirmationCode: { equals: confirmationCode, mode: "insensitive" },
            },
            select: {
                id: true,
                confirmationCode: true,
                fullName: true,
                email: true,
                status: true,
                event: {
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        eventDate: true,
                        eventEndDate: true,
                        venue: true,
                        timezone: true,
                        isActive: true,
                        isArchived: true,
                        isFinalized: true,
                        isPublished: true,
                        ticketAccentColor: true,
                        ticketHeaderTitle: true,
                        ticketHeaderSubtitle: true,
                        ticketFooterNote: true,
                        ticketHeaderImageGithubPath: true,
                        ticketFooterImageGithubPath: true,
                    },
                },
                tier: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        if (
            !registration
            || registration.status === "CANCELLED"
            || registration.event.isArchived
            || !canPublicViewEvent(registration.event)
        ) {
            return res.status(404).json({ error: "Registration not found" });
        }

        await generateTokensForRegistration(registration.id);

        const eventSessions = await prisma.eventSession.findMany({
            where: { eventId, isActive: true },
            orderBy: [{ startDateTime: "asc" }, { sessionDate: "asc" }, { order: "asc" }],
        });

        const selectedRows = await prisma.eventRegistrationSession.findMany({
            where: { registrationId: registration.id },
            select: { sessionId: true },
        });
        const selectedIds = selectedRows.map((row) => row.sessionId);
        const { waitingForYou, dontMissOut } = splitSessionsForTicket(eventSessions, selectedIds);

        const sessionTokens = await getSessionTokensForRegistration(registration.id);

        const eventTimezone = registration.event.timezone?.trim() || "Africa/Cairo";

        const mapSession = (
            session: (typeof eventSessions)[number],
            section: "waitingForYou" | "dontMissOut",
        ) => {
            const serialized = serializeEventSession(session, eventTimezone);
            const token = sessionTokens.get(session.id);
            const joinUrl = section === "waitingForYou"
                && session.mode === "ONLINE"
                && token
                ? buildRegistrationJoinUrl(registration.event.slug, token)
                : null;

            return {
                ...serialized,
                maxCapacity: session.maxCapacity ?? null,
                joinUrl,
                section,
            };
        };

        const waitingForYouSessions = waitingForYou.map((session) => mapSession(session, "waitingForYou"));
        const dontMissOutSessions = dontMissOut.map((session) => mapSession(session, "dontMissOut"));

        const eventPublicId = registration.event.slug || registration.event.id;
        const ticketDesign = {
            accentColor: registration.event.ticketAccentColor,
            headerTitle: registration.event.ticketHeaderTitle,
            headerSubtitle: registration.event.ticketHeaderSubtitle,
            footerNote: registration.event.ticketFooterNote,
            headerImageUrl: registration.event.ticketHeaderImageGithubPath
                ? `/api/public/events/${eventPublicId}/ticket-design/header-image`
                : null,
            footerImageUrl: registration.event.ticketFooterImageGithubPath
                ? `/api/public/events/${eventPublicId}/ticket-design/footer-image`
                : null,
        };

        return res.json({
            confirmationCode: registration.confirmationCode,
            fullName: registration.fullName,
            email: registration.email,
            event: {
                id: registration.event.id,
                slug: registration.event.slug,
                title: registration.event.title,
                eventDate: registration.event.eventDate,
                eventEndDate: registration.event.eventEndDate,
                venue: registration.event.venue,
                timezone: eventTimezone,
            },
            tier: registration.tier ? { name: registration.tier.name } : null,
            sessions: [...waitingForYouSessions, ...dontMissOutSessions],
            waitingForYou: waitingForYouSessions,
            dontMissOut: dontMissOutSessions,
            ticketDesign,
        });
    } catch (error) {
        console.error("GET /public/events/:id/confirmation error:", error);
        return res.status(500).json({ error: "Failed to load registration confirmation" });
    }
});

router.get("/projects", async (req: Request, res: Response) => {
    try {
        const limit = parseLimit(req.query.limit, 50);

        const projects = await prisma.project.findMany({
            where: {
                isDisclosed: true,
            },
            select: publicProjectSelect,
            orderBy: [
                { completedDate: "desc" },
                { updatedAt: "desc" },
            ],
            take: limit,
        });

        return res.json(projects);
    } catch (error) {
        console.error("GET /public/projects error:", error);
        return res.status(500).json({ error: "Failed to load projects" });
    }
});

router.get("/projects/:id", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveProjectByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Project not found" });
        }

        const project = await prisma.project.findUnique({
            where: { id: resolved.id },
            select: {
                ...publicProjectSelect,
                isDisclosed: true,
            },
        });

        if (!project || !canPublicViewProject(project)) {
            return res.status(404).json({ error: "Project not found" });
        }

        const { isDisclosed: _isDisclosed, ...payload } = project;
        return res.json(payload);
    } catch (error) {
        console.error("GET /public/projects/:id error:", error);
        return res.status(500).json({ error: "Failed to load project" });
    }
});

router.get("/projects/:id/photos", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveProjectByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Project not found" });
        }

        const project = await prisma.project.findUnique({
            where: { id: resolved.id },
            select: {
                isDisclosed: true,
            },
        });

        if (!project || !canPublicViewProject(project)) {
            return res.status(404).json({ error: "Project not found" });
        }

        const photos = await prisma.projectPhoto.findMany({
            where: {
                projectId: resolved.id,
                isActive: true,
                showOnPublic: true,
            },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: {
                id: true,
                fileName: true,
                caption: true,
            },
        });

        return res.json(
            photos.map((photo) => ({
                id: photo.id,
                fileName: photo.fileName,
                caption: photo.caption,
                downloadUrl: `/api/public/project-photos/${photo.id}/download`,
            })),
        );
    } catch (error) {
        console.error("GET /public/projects/:id/photos error:", error);
        return res.status(500).json({ error: "Failed to load project photos" });
    }
});

router.get("/project-photos/:id/download", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) {
            return res.status(404).json({ error: "Photo not found" });
        }

        const photo = await prisma.projectPhoto.findUnique({
            where: { id },
            include: {
                project: {
                    select: {
                        isDisclosed: true,
                    },
                },
            },
        });

        if (
            !photo
            || !photo.isActive
            || (!photo.showOnPublic && !photo.isCore)
            || !canPublicViewProject(photo.project)
        ) {
            return res.status(404).json({ error: "Photo not found" });
        }

        res.setHeader("Cache-Control", PUBLIC_EVENT_PHOTO_CACHE_CONTROL);

        if (photo.previewGithubPath) {
            const ghResponse = await githubStorage.downloadFile(photo.previewGithubPath);
            res.setHeader("Content-Type", EVENT_PHOTO_PREVIEW_CONTENT_TYPE);
            res.setHeader(
                "Content-Disposition",
                `inline; filename="${photo.fileName.replace(/\.[^.]+$/, "") || "photo"}-preview.webp"`,
            );
            if (photo.previewFileSize) {
                res.setHeader("Content-Length", photo.previewFileSize);
            }
            await pipeGithubBodyToResponse(ghResponse, res);
            return;
        }

        const ghResponse = await githubStorage.downloadFile(photo.githubPath);
        const originalBuffer = Buffer.from(await ghResponse.arrayBuffer());

        try {
            const optimized = await optimizeEventPhoto(originalBuffer);
            scheduleProjectPhotoPreviewPersist(photo.id, photo.githubPath, optimized.buffer);

            res.setHeader("Content-Type", EVENT_PHOTO_PREVIEW_CONTENT_TYPE);
            res.setHeader(
                "Content-Disposition",
                `inline; filename="${photo.fileName.replace(/\.[^.]+$/, "") || "photo"}-preview.webp"`,
            );
            res.setHeader("Content-Length", optimized.buffer.length);
            return res.send(optimized.buffer);
        } catch (previewErr) {
            console.error(
                "GET /public/project-photos/:id/download optimize failed (serving original):",
                previewErr,
            );
            res.setHeader("Content-Type", photo.mimeType);
            res.setHeader("Content-Disposition", `inline; filename="${photo.fileName}"`);
            res.setHeader("Content-Length", originalBuffer.length);
            return res.send(originalBuffer);
        }
    } catch (error) {
        console.error("GET /public/project-photos/:id/download error:", error);
        return res.status(500).json({ error: "Failed to download photo" });
    }
});

function getContactInbox(): string {
    return process.env.RESEND_REPLY_TO?.trim() || DEFAULT_CONTACT_INBOX;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

router.post("/contact", contactPostLimiter, async (req: Request, res: Response) => {
    try {
        const body = req.body as Record<string, unknown>;
        const name = String(body.name ?? "").trim();
        const email = String(body.email ?? "").trim();
        const subject = String(body.subject ?? "").trim();
        const message = String(body.message ?? "").trim();
        const honeypot = String(body.website ?? "").trim();

        if (honeypot) {
            return res.json({ success: true });
        }

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: "Name, email, subject, and message are required" });
        }

        if (name.length > 120 || subject.length > 200 || message.length > 5000) {
            return res.status(400).json({ error: "One or more fields exceed the maximum length" });
        }

        if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ error: "A valid email address is required" });
        }

        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safeSubject = escapeHtml(subject);
        const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

        await sendEmail({
            to: getContactInbox(),
            replyTo: email,
            subject: `[iClub Contact] ${subject}`,
            html: `
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Subject:</strong> ${safeSubject}</p>
                <p><strong>Message:</strong></p>
                <p>${safeMessage}</p>
            `,
        });

        return res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message";
        if (message === "Email service is not configured") {
            return res.status(503).json({ error: "Contact form is temporarily unavailable" });
        }

        console.error("POST /public/contact error:", error);
        return res.status(500).json({ error: "Failed to send message" });
    }
});

router.get("/site-config", (_req: Request, res: Response) => {
    return res.json({ publicWebsiteUrl: getPublicWebsiteUrl() });
});

router.get("/site/about", async (_req: Request, res: Response) => {
    try {
        const page = await getAboutPageData();
        if (!page) {
            return res.status(404).json({ error: "About page not found" });
        }
        return res.json(page);
    } catch (error) {
        console.error("GET /public/site/about error:", error);
        return res.status(500).json({ error: "Failed to fetch about page" });
    }
});

router.get("/site/contact", async (_req: Request, res: Response) => {
    try {
        const page = await getContactPageData();
        if (!page) {
            return res.status(404).json({ error: "Contact page not found" });
        }
        return res.json(page);
    } catch (error) {
        console.error("GET /public/site/contact error:", error);
        return res.status(500).json({ error: "Failed to fetch contact page" });
    }
});

router.get("/site/social-links", async (_req: Request, res: Response) => {
    try {
        const links = await getActiveSocialLinks();
        return res.json(links);
    } catch (error) {
        console.error("GET /public/site/social-links error:", error);
        return res.status(500).json({ error: "Failed to fetch social links" });
    }
});

router.get("/site/support", async (_req: Request, res: Response) => {
    try {
        const page = await getSupportPageData();
        if (!page) {
            return res.status(404).json({ error: "Support page not found" });
        }
        return res.json(page);
    } catch (error) {
        console.error("GET /public/site/support error:", error);
        return res.status(500).json({ error: "Failed to fetch support page" });
    }
});

router.post("/support/incident-reports", incidentReportPostLimiter, async (req: Request, res: Response) => {
    try {
        const honeypot = String(req.body?.website ?? "").trim();
        if (honeypot) {
            return res.json({ success: true });
        }

        const formId = parseInt(String(req.body?.formId ?? req.body?.reportTypeId ?? ""), 10);
        if (Number.isNaN(formId)) {
            return res.status(400).json({ error: "formId is required" });
        }

        const created = await createIncidentReportSubmission({
            formId,
            name: req.body?.name,
            email: req.body?.email,
            phone: req.body?.phone,
            description: req.body?.description,
            fieldValues: req.body?.fieldValues,
            source: "PUBLIC",
        });
        return res.status(201).json(created);
    } catch (error) {
        const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
        if (fieldErrors) {
            return res.status(400).json({ error: "Validation failed", fieldErrors });
        }
        console.error("POST /public/support/incident-reports error:", error);
        return res.status(500).json({ error: "Failed to submit incident report" });
    }
});

router.get("/members/directory", async (_req: Request, res: Response) => {
    try {
        const directory = await buildPublicMemberDirectory();
        return res.json(directory);
    } catch (error) {
        console.error("GET /public/members/directory error:", error);
        return res.status(500).json({ error: "Failed to fetch member directory" });
    }
});

router.get("/members/:id/profile", async (req: Request, res: Response) => {
    try {
        const memberId = parseMemberId(String(req.params.id));
        if (memberId == null) {
            return res.status(400).json({ error: "Invalid member ID" });
        }

        const member = await prisma.member.findUnique({
            where: { id: memberId },
            select: {
                id: true,
                fullName: true,
                email: true,
                email2: true,
                email3: true,
                phoneNumber: true,
                phoneNumber2: true,
                studentId: true,
                profilePhotoUrl: true,
                linkedInUrl: true,
                joinDate: true,
                showPhoneNumber: true,
                showPhoneNumber2: true,
                showEmail2: true,
                showEmail3: true,
                showStudentId: true,
                isActive: true,
                assignmentStatus: true,
            },
        });

        if (!member || !isPublicEligibleMember(member)) {
            return res.status(404).json({ error: "Member not found" });
        }

        const history = await prisma.memberRoleHistory.findMany({
            where: { memberId },
            include: {
                team: true,
                role: true,
                member: true,
                subteam: true,
            },
            orderBy: { startDate: "asc" },
        });

        const profile = toMemberProfileView(member);
        return res.json({
            ...profile,
            roleHistory: buildMemberTimeline(history),
        });
    } catch (error) {
        console.error("GET /public/members/:id/profile error:", error);
        return res.status(500).json({ error: "Failed to fetch member profile" });
    }
});

export default router;
