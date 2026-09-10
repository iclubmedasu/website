import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    eventCount: vi.fn(),
    certificateCount: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventRegistrationDayCount: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        event: { count: prismaMocks.eventCount },
        certificate: { count: prismaMocks.certificateCount },
        eventRegistration: { count: prismaMocks.eventRegistrationCount },
        eventRegistrationDay: { count: prismaMocks.eventRegistrationDayCount },
        usageEvent: {
            groupBy: prismaMocks.groupBy,
            findMany: prismaMocks.findMany,
        },
    },
}));

import usageDashboardRouter from "../../routes/usageDashboard";
import { buildRouteApp } from "./testHarness";

describe("GET /usage-dashboard/summary", () => {
    beforeEach(() => {
        prismaMocks.eventCount.mockReset();
        prismaMocks.certificateCount.mockReset();
        prismaMocks.eventRegistrationCount.mockReset();
        prismaMocks.eventRegistrationDayCount.mockReset();
        prismaMocks.groupBy.mockReset();
        prismaMocks.findMany.mockReset();

        prismaMocks.eventCount.mockResolvedValue(5);
        prismaMocks.certificateCount.mockResolvedValue(4);
        prismaMocks.eventRegistrationDayCount.mockResolvedValue(12);
        prismaMocks.eventRegistrationCount.mockResolvedValue(20);
        prismaMocks.groupBy.mockResolvedValue([
            { actionType: "DATA_EXPORTED", _count: { _all: 2 } },
            { actionType: "LOGIN", _count: { _all: 10 } },
        ]);
        prismaMocks.findMany.mockResolvedValue([{ memberId: 1 }, { memberId: 2 }]);
    });

    it("returns 403 for non-developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, {
            isDeveloper: false,
            isAdmin: true,
            isOfficer: true,
        });
        const res = await request(app).get("/summary");
        expect(res.status).toBe(403);
        expect(prismaMocks.eventCount).not.toHaveBeenCalled();
        expect(prismaMocks.groupBy).not.toHaveBeenCalled();
    });

    it("returns summary counts for developer (default 30 days)", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary");
        expect(res.status).toBe(200);
        expect(res.body.windowDays).toBe(30);
        expect(res.body.since).toBeTruthy();
        expect(res.body.until).toBeTruthy();
        expect(res.body.counts).toEqual({
            eventsCreated: 5,
            certificatesIssued: 4,
            checkInsScanned: 12,
            registrationsCreated: 20,
            dataExports: 2,
            logins: 10,
            activeMembers: 2,
        });

        expect(prismaMocks.eventCount).toHaveBeenCalledWith({
            where: { createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
        });
        expect(prismaMocks.certificateCount).toHaveBeenCalledWith({
            where: {
                OR: [
                    { issuedAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
                    {
                        issuedAt: null,
                        createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
                        status: { not: "DRAFT" },
                    },
                ],
            },
        });
        expect(prismaMocks.eventRegistrationDayCount).toHaveBeenCalledWith({
            where: { checkedInAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
        });
        expect(prismaMocks.eventRegistrationCount).toHaveBeenCalledWith({
            where: { createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
        });
        expect(prismaMocks.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ["actionType"],
                where: expect.objectContaining({
                    actionType: { in: ["DATA_EXPORTED", "LOGIN"] },
                }),
            }),
        );
    });

    it("accepts days query", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?days=7");
        expect(res.status).toBe(200);
        expect(res.body.windowDays).toBe(7);
        expect(prismaMocks.eventCount).toHaveBeenCalled();
        const where = prismaMocks.eventCount.mock.calls[0][0].where.createdAt;
        expect(where.gte).toBeInstanceOf(Date);
        expect(where.lte).toBeInstanceOf(Date);
    });

    it("accepts custom from/to range", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.windowDays).toBe(31);
        expect(res.body.since).toBe("2026-03-01T00:00:00.000Z");
        expect(res.body.until).toBe("2026-03-31T23:59:59.999Z");
    });

    it("rejects invalid from/to", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?from=2026-03-31&to=2026-03-01");
        expect(res.status).toBe(400);
        expect(prismaMocks.eventCount).not.toHaveBeenCalled();
        expect(prismaMocks.groupBy).not.toHaveBeenCalled();
    });

    it("rejects incomplete custom range", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?from=2026-03-01");
        expect(res.status).toBe(400);
    });
});
