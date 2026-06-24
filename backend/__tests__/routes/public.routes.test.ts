import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    eventFindMany: vi.fn(),
    eventFindUnique: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventRegistrationGroupBy: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventTierFindMany: vi.fn(),
    eventCustomFieldFindMany: vi.fn(),
    projectFindMany: vi.fn(),
    projectFindUnique: vi.fn(),
}));

const emailMocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
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
        eventTier: {
            findMany: prismaMocks.eventTierFindMany,
        },
        eventCustomField: {
            findMany: prismaMocks.eventCustomFieldFindMany,
        },
        project: {
            findMany: prismaMocks.projectFindMany,
            findUnique: prismaMocks.projectFindUnique,
        },
    },
}));

vi.mock("../../services/emailService", () => emailMocks);

import publicRouter from "../../routes/public";

function createApp() {
    const app = express();
    app.use(express.json());
    app.use("/public", publicRouter);
    return app;
}

const baseEvent = {
    id: 1,
    title: "Health Fair",
    description: "Community outreach",
    eventDate: new Date("2026-07-01T10:00:00.000Z"),
    eventEndDate: new Date("2026-07-01T18:00:00.000Z"),
    venue: "ASU Downtown",
    registrationDeadline: new Date("2026-06-28T23:59:59.000Z"),
    capacity: 100,
    status: "PUBLISHED",
    isActive: true,
    isArchived: false,
    isPublished: true,
    projectType: { name: "Workshop" },
};

describe("public routes", () => {
    beforeEach(() => {
        prismaMocks.eventFindMany.mockResolvedValue([]);
        prismaMocks.eventFindUnique.mockResolvedValue(null);
        prismaMocks.eventRegistrationCount.mockResolvedValue(0);
        prismaMocks.eventRegistrationGroupBy.mockResolvedValue([]);
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null);
        prismaMocks.eventTierFindMany.mockResolvedValue([]);
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([]);
        prismaMocks.projectFindMany.mockResolvedValue([]);
        prismaMocks.projectFindUnique.mockResolvedValue(null);
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
            description: "Community outreach",
            registeredCount: 12,
            spotsRemaining: 88,
        });
    });

    it("GET /public/events/:id/tiers returns active tiers with capacity", async () => {
        prismaMocks.eventFindUnique.mockResolvedValue({
            id: 1,
            isActive: true,
            isArchived: false,
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
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            confirmationCode: "ABC123",
            fullName: "Ada Lovelace",
            email: "ada@example.com",
            status: "REGISTERED",
            event: {
                id: 1,
                title: "Health Fair",
                eventDate: new Date("2026-07-01T10:00:00.000Z"),
                eventEndDate: new Date("2026-07-01T18:00:00.000Z"),
                venue: "ASU Downtown",
                isActive: true,
                isArchived: false,
                isPublished: true,
            },
            tier: { name: "General" },
        });

        const response = await request(createApp()).get("/public/events/1/confirmation?code=abc123");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            confirmationCode: "ABC123",
            fullName: "Ada Lovelace",
            tier: { name: "General" },
        });
    });

    it("GET /public/projects returns disclosed archived projects", async () => {
        prismaMocks.projectFindMany.mockResolvedValue([
            {
                id: 2,
                title: "Telehealth Pilot",
                description: "Student-led pilot",
                completedDate: "2026-05-01T00:00:00.000Z",
                projectType: { name: "Technology", category: "Technology" },
                tags: [{ tagName: "innovation" }],
            },
        ]);

        const response = await request(createApp()).get("/public/projects?limit=2");

        expect(response.status).toBe(200);
        expect(response.body[0].title).toBe("Telehealth Pilot");
        expect(prismaMocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                isArchived: true,
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
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                isArchived: true,
                isDisclosed: true,
            },
            orderBy: { eventEndDate: "desc" },
        }));
    });

    it("GET /public/projects/:id returns disclosed archived project detail", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 2,
            title: "Telehealth Pilot",
            description: "Student-led pilot",
            completedDate: "2026-05-01T00:00:00.000Z",
            projectType: { name: "Technology", category: "Technology" },
            tags: [{ tagName: "innovation" }],
            isArchived: true,
            isDisclosed: true,
        });

        const response = await request(createApp()).get("/public/projects/2");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: 2,
            title: "Telehealth Pilot",
            projectType: { name: "Technology", category: "Technology" },
        });
        expect(response.body.isArchived).toBeUndefined();
    });

    it("GET /public/projects/:id returns 404 for undisclosed project", async () => {
        prismaMocks.projectFindUnique.mockResolvedValue({
            id: 3,
            title: "Hidden Project",
            description: null,
            completedDate: null,
            projectType: null,
            tags: [],
            isArchived: true,
            isDisclosed: false,
        });

        const response = await request(createApp()).get("/public/projects/3");

        expect(response.status).toBe(404);
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
});
