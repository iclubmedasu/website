import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    groupBy: vi.fn(),
    findMany: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
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
        prismaMocks.groupBy.mockReset();
        prismaMocks.findMany.mockReset();
        prismaMocks.groupBy.mockResolvedValue([
            { actionType: "EVENT_CREATED", _count: { _all: 3 } },
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
            eventsCreated: 3,
            certificatesIssued: 0,
            checkInsScanned: 0,
            registrationsCreated: 0,
            dataExports: 0,
            logins: 10,
            activeMembers: 2,
        });
    });

    it("accepts days query", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?days=7");
        expect(res.status).toBe(200);
        expect(res.body.windowDays).toBe(7);
        expect(prismaMocks.groupBy).toHaveBeenCalled();
        const where = prismaMocks.groupBy.mock.calls[0][0].where.createdAt;
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
        expect(prismaMocks.groupBy).not.toHaveBeenCalled();
    });

    it("rejects incomplete custom range", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?from=2026-03-01");
        expect(res.status).toBe(400);
    });
});
