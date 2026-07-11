import express, { Request, Response } from "express";
import { prisma } from "../db";
import { serializeEventSession } from "../lib/eventSessionTime";
import {
    countActiveSessionRegistrationsForSessions,
    splitSessionsForTicket,
    withSessionCapacityFields,
} from "../lib/eventSessionCapacity";
import { sendEmail } from "../services/emailService";
import { buildRegistrationJoinUrl } from "../services/eventTicketEmailService";
import { generateTokensForRegistration, getSessionTokensForRegistration } from "../services/sessionTokenService";
import { buildMemberTimeline, toMemberProfileView } from "../lib/memberProfileVisibility";
import { buildPublicMemberDirectory } from "../lib/publicMemberDirectory";
import { getPublicWebsiteUrl } from "../lib/publicWebsiteUrl";
import { getAboutPageData, getActiveSocialLinks, getContactPageData } from "../lib/siteContent";
import { createIncidentReportSubmission, getSupportPageData } from "../lib/supportContent";
import { resolveEventByIdOrSlug, resolveProjectByIdOrSlug } from "../lib/publicEntitySlug";

const router = express.Router();

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
    registrationDeadline: true,
    capacity: true,
    status: true,
    isActive: true,
    isArchived: true,
    isPublished: true,
    isDisclosed: true,
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
function canPublicViewEvent(event: { isPublished: boolean; isActive: boolean; isArchived: boolean }): boolean {
    return event.isActive && !event.isArchived && event.isPublished;
}

/** Live published OR archived+disclosed (past public detail). */
function canPublicViewEventDetail(event: {
    isPublished: boolean;
    isActive: boolean;
    isArchived: boolean;
    isDisclosed: boolean;
}): boolean {
    if (event.isArchived) {
        return event.isDisclosed;
    }
    return canPublicViewEvent(event);
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
        registrationDeadline: event.registrationDeadline,
        capacity: event.capacity,
        registeredCount,
        spotsRemaining,
        registrationOpen,
        projectType: event.projectType ? { name: event.projectType.name } : null,
    };
}

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
                    isArchived: true,
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

router.get("/events/:id/tiers", async (req: Request, res: Response) => {
    try {
        const resolved = await resolveEventByIdOrSlug(String(req.params.id));
        if (!resolved) {
            return res.status(404).json({ error: "Event not found" });
        }
        const eventId = resolved.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, isActive: true, isArchived: true, isPublished: true },
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
            select: { id: true, isActive: true, isArchived: true, isPublished: true },
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
            select: { id: true, isActive: true, isArchived: true, isPublished: true },
        });

        if (!event || event.isArchived || !canPublicViewEvent(event)) {
            return res.status(404).json({ error: "Event not found" });
        }

        const sessions = await prisma.eventSession.findMany({
            where: { eventId, isActive: true },
            orderBy: [{ startDateTime: "asc" }, { sessionDate: "asc" }, { order: "asc" }],
        });

        const counts = await countActiveSessionRegistrationsForSessions(sessions.map((session) => session.id));
        return res.json(sessions.map((session) => (
            withSessionCapacityFields(
                serializeEventSession(session),
                counts.get(session.id) ?? 0,
            )
        )));
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
                isPublished: true,
                tierFieldShowOnPublic: true,
                tierFieldRequired: true,
                sessionFieldShowOnPublic: true,
                sessionFieldRequired: true,
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
                        isActive: true,
                        isArchived: true,
                        isPublished: true,
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

        const mapSession = (
            session: (typeof eventSessions)[number],
            section: "waitingForYou" | "dontMissOut",
        ) => {
            const serialized = serializeEventSession(session);
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
            },
            tier: registration.tier ? { name: registration.tier.name } : null,
            sessions: [...waitingForYouSessions, ...dontMissOutSessions],
            waitingForYou: waitingForYouSessions,
            dontMissOut: dontMissOutSessions,
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
                isArchived: true,
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
                isArchived: true,
                isDisclosed: true,
            },
        });

        if (!project || !project.isArchived || !project.isDisclosed) {
            return res.status(404).json({ error: "Project not found" });
        }

        const { isArchived: _isArchived, isDisclosed: _isDisclosed, ...payload } = project;
        return res.json(payload);
    } catch (error) {
        console.error("GET /public/projects/:id error:", error);
        return res.status(500).json({ error: "Failed to load project" });
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

router.post("/contact", async (req: Request, res: Response) => {
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

router.post("/support/incident-reports", async (req: Request, res: Response) => {
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
