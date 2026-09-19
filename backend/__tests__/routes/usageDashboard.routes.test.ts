import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    eventCount: vi.fn(),
    eventFindMany: vi.fn(),
    eventFindFirst: vi.fn(),
    certificateCount: vi.fn(),
    certificateGroupBy: vi.fn(),
    certificateFindMany: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventRegistrationGroupBy: vi.fn(),
    eventRegistrationFindMany: vi.fn(),
    eventRegistrationDayCount: vi.fn(),
    eventSessionGroupBy: vi.fn(),
    eventSessionFindMany: vi.fn(),
    eventFileGroupBy: vi.fn(),
    eventFileCount: vi.fn(),
    eventPhotoGroupBy: vi.fn(),
    eventPhotoCount: vi.fn(),
    eventTaskGroupBy: vi.fn(),
    eventTaskFindMany: vi.fn(),
    eventTaskAssignmentFindMany: vi.fn(),
    eventSessionAttendanceFindMany: vi.fn(),
    projectFindMany: vi.fn(),
    projectFindFirst: vi.fn(),
    taskFindMany: vi.fn(),
    projectPhaseGroupBy: vi.fn(),
    projectPhaseCount: vi.fn(),
    projectFileGroupBy: vi.fn(),
    projectFileCount: vi.fn(),
    projectPhotoGroupBy: vi.fn(),
    projectPhotoCount: vi.fn(),
    projectScheduleSlotFindMany: vi.fn(),
    taskAssignmentFindMany: vi.fn(),
    announcementFindMany: vi.fn(),
    announcementFindFirst: vi.fn(),
    announcementResponseFindMany: vi.fn(),
    announcementResponsePeriodCount: vi.fn(),
    usageGroupBy: vi.fn(),
    usageFindMany: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        event: {
            count: prismaMocks.eventCount,
            findMany: prismaMocks.eventFindMany,
            findFirst: prismaMocks.eventFindFirst,
        },
        certificate: {
            count: prismaMocks.certificateCount,
            groupBy: prismaMocks.certificateGroupBy,
            findMany: prismaMocks.certificateFindMany,
        },
        eventRegistration: {
            count: prismaMocks.eventRegistrationCount,
            groupBy: prismaMocks.eventRegistrationGroupBy,
            findMany: prismaMocks.eventRegistrationFindMany,
        },
        eventRegistrationDay: { count: prismaMocks.eventRegistrationDayCount },
        eventSession: {
            groupBy: prismaMocks.eventSessionGroupBy,
            findMany: prismaMocks.eventSessionFindMany,
        },
        eventFile: {
            groupBy: prismaMocks.eventFileGroupBy,
            count: prismaMocks.eventFileCount,
        },
        eventPhoto: {
            groupBy: prismaMocks.eventPhotoGroupBy,
            count: prismaMocks.eventPhotoCount,
        },
        eventTask: {
            groupBy: prismaMocks.eventTaskGroupBy,
            findMany: prismaMocks.eventTaskFindMany,
        },
        eventTaskAssignment: { findMany: prismaMocks.eventTaskAssignmentFindMany },
        eventSessionAttendance: { findMany: prismaMocks.eventSessionAttendanceFindMany },
        project: {
            findMany: prismaMocks.projectFindMany,
            findFirst: prismaMocks.projectFindFirst,
        },
        task: { findMany: prismaMocks.taskFindMany },
        projectPhase: {
            groupBy: prismaMocks.projectPhaseGroupBy,
            count: prismaMocks.projectPhaseCount,
        },
        projectFile: {
            groupBy: prismaMocks.projectFileGroupBy,
            count: prismaMocks.projectFileCount,
        },
        projectPhoto: {
            groupBy: prismaMocks.projectPhotoGroupBy,
            count: prismaMocks.projectPhotoCount,
        },
        projectScheduleSlot: { findMany: prismaMocks.projectScheduleSlotFindMany },
        taskAssignment: { findMany: prismaMocks.taskAssignmentFindMany },
        announcement: {
            findMany: prismaMocks.announcementFindMany,
            findFirst: prismaMocks.announcementFindFirst,
        },
        announcementResponse: { findMany: prismaMocks.announcementResponseFindMany },
        announcementResponsePeriod: { count: prismaMocks.announcementResponsePeriodCount },
        usageEvent: {
            groupBy: prismaMocks.usageGroupBy,
            findMany: prismaMocks.usageFindMany,
        },
    },
}));

import usageDashboardRouter from "../../routes/usageDashboard";
import { buildRouteApp } from "./testHarness";

describe("GET /usage-dashboard/summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.eventCount.mockResolvedValue(5);
        prismaMocks.certificateCount.mockResolvedValue(4);
        prismaMocks.eventRegistrationDayCount.mockResolvedValue(12);
        prismaMocks.eventRegistrationCount.mockResolvedValue(20);
        prismaMocks.usageGroupBy.mockResolvedValue([
            { actionType: "DATA_EXPORTED", _count: { _all: 2 } },
            { actionType: "LOGIN", _count: { _all: 10 } },
        ]);
        prismaMocks.usageFindMany.mockResolvedValue([{ memberId: 1 }, { memberId: 2 }]);
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
        expect(prismaMocks.usageGroupBy).not.toHaveBeenCalled();
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
        expect(prismaMocks.usageGroupBy).toHaveBeenCalledWith(
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
        expect(prismaMocks.usageGroupBy).not.toHaveBeenCalled();
    });

    it("rejects incomplete custom range", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/summary?from=2026-03-01");
        expect(res.status).toBe(400);
    });
});

describe("GET /usage-dashboard/events", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.eventFindMany.mockResolvedValue([
            {
                id: 10,
                title: "Workshop",
                venue: "Hall A",
                eventDate: new Date("2026-03-10T09:00:00.000Z"),
                eventEndDate: new Date("2026-03-10T17:00:00.000Z"),
                status: "PUBLISHED",
            },
        ]);
        prismaMocks.eventRegistrationGroupBy
            .mockResolvedValueOnce([{ eventId: 10, _count: { _all: 3 } }])
            .mockResolvedValueOnce([{ eventId: 10, _count: { _all: 2 } }])
            .mockResolvedValueOnce([{ eventId: 10, _count: { _all: 1 } }]);
        prismaMocks.eventSessionGroupBy.mockResolvedValue([{ eventId: 10, _count: { _all: 2 } }]);
        prismaMocks.eventFileGroupBy.mockResolvedValue([{ eventId: 10, _count: { _all: 4 } }]);
        prismaMocks.eventPhotoGroupBy.mockResolvedValue([{ eventId: 10, _count: { _all: 5 } }]);
        prismaMocks.eventTaskGroupBy.mockResolvedValue([{ eventId: 10, _count: { _all: 2 } }]);
        prismaMocks.certificateGroupBy.mockResolvedValue([{ eventId: 10, _count: { _all: 1 } }]);
        prismaMocks.eventRegistrationDayCount.mockResolvedValue(7);
        prismaMocks.eventTaskAssignmentFindMany.mockResolvedValue([
            {
                memberId: 1,
                startDateTime: new Date("2026-03-10T09:00:00.000Z"),
                endDateTime: new Date("2026-03-10T11:00:00.000Z"),
                eventTask: { eventId: 10 },
            },
            {
                memberId: 2,
                startDateTime: new Date("2026-03-10T11:00:00.000Z"),
                endDateTime: new Date("2026-03-10T12:00:00.000Z"),
                eventTask: { eventId: 10 },
            },
        ]);
    });

    it("returns 403 for non-developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: false, isAdmin: true });
        const res = await request(app).get("/events?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(403);
        expect(prismaMocks.eventFindMany).not.toHaveBeenCalled();
    });

    it("returns events summary and rows for developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/events?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.windowDays).toBe(31);
        expect(res.body.summary).toEqual({
            eventsCreated: 1,
            eventTasks: 2,
            eventTaskAssignments: 2,
            tasksPerEvent: 2,
            peopleWorked: 2,
            totalAssignmentHours: 3,
            totalEventDurationHours: 8,
            registrations: 3,
            ticketsSent: 2,
            remindersSent: 1,
            certificatesIssued: 1,
            sessions: 2,
            filesUploaded: 4,
            photosUploaded: 5,
            checkIns: 7,
        });
        expect(res.body.events).toEqual([
            {
                id: 10,
                title: "Workshop",
                venue: "Hall A",
                eventDate: "2026-03-10T09:00:00.000Z",
                eventEndDate: "2026-03-10T17:00:00.000Z",
                status: "PUBLISHED",
                registrations: 3,
                sessions: 2,
                ticketsSent: 2,
                remindersSent: 1,
                certificatesIssued: 1,
                files: 4,
                photos: 5,
                peopleWorked: 2,
                assignmentHours: 3,
                tasks: 2,
            },
        ]);

        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                    deletedAt: null,
                    createdAt: {
                        gte: new Date("2026-03-01T00:00:00.000Z"),
                        lte: new Date("2026-03-31T23:59:59.999Z"),
                    },
                }),
            }),
        );
        expect(prismaMocks.eventRegistrationGroupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ ticketEmailSentAt: { not: null } }),
            }),
        );
        expect(prismaMocks.eventRegistrationGroupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ reminderEmailSentAt: { not: null } }),
            }),
        );
    });

    it("returns empty summary when no events in range", async () => {
        prismaMocks.eventFindMany.mockResolvedValue([]);
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/events?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.events).toEqual([]);
        expect(res.body.summary.eventsCreated).toBe(0);
        expect(prismaMocks.eventRegistrationGroupBy).not.toHaveBeenCalled();
    });

    it("rejects invalid date range", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/events?from=2026-03-31&to=2026-03-01");
        expect(res.status).toBe(400);
    });
});

describe("GET /usage-dashboard/events/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.eventFindFirst.mockResolvedValue({
            id: 10,
            title: "Workshop",
            venue: "Hall A",
            status: "PUBLISHED",
            eventDate: new Date("2026-03-10T09:00:00.000Z"),
            eventEndDate: new Date("2026-03-10T17:00:00.000Z"),
            createdAt: new Date("2026-03-05T12:00:00.000Z"),
            capacity: 10,
        });
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([
            {
                status: "REGISTERED",
                isWalkIn: false,
                ticketEmailSentAt: new Date(),
                reminderEmailSentAt: null,
            },
            {
                status: "CANCELLED",
                isWalkIn: false,
                ticketEmailSentAt: null,
                reminderEmailSentAt: null,
            },
            {
                status: "CHECKED_IN",
                isWalkIn: true,
                ticketEmailSentAt: new Date(),
                reminderEmailSentAt: new Date(),
            },
        ]);
        prismaMocks.eventSessionFindMany.mockResolvedValue([
            {
                id: 1,
                label: "Morning",
                sessionDate: new Date("2026-03-10T00:00:00.000Z"),
                startDateTime: new Date("2026-03-10T09:00:00.000Z"),
                endDateTime: new Date("2026-03-10T12:00:00.000Z"),
                mode: "ONSITE",
                maxCapacity: 20,
            },
        ]);
        prismaMocks.eventTaskFindMany.mockResolvedValue([
            {
                id: 1,
                assignments: [
                    {
                        memberId: 1,
                        startDateTime: new Date("2026-03-10T09:00:00.000Z"),
                        endDateTime: new Date("2026-03-10T10:00:00.000Z"),
                    },
                ],
            },
        ]);
        prismaMocks.eventFileCount.mockResolvedValue(2);
        prismaMocks.eventPhotoCount.mockResolvedValue(3);
        prismaMocks.certificateFindMany.mockResolvedValue([
            { certificateEmailSentAt: new Date() },
            { certificateEmailSentAt: null },
        ]);
        prismaMocks.eventRegistrationDayCount.mockResolvedValue(4);
        prismaMocks.eventSessionAttendanceFindMany.mockResolvedValue([
            {
                joinedAt: new Date("2026-03-10T09:00:00.000Z"),
                checkedOutAt: new Date("2026-03-10T10:00:00.000Z"),
            },
            {
                joinedAt: new Date("2026-03-10T09:00:00.000Z"),
                checkedOutAt: null,
            },
        ]);
    });

    it("returns event detail with capacity fill and attendance dwell", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/events/10?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.event.title).toBe("Workshop");
        expect(res.body.metrics.capacityFillPercent).toBe(20);
        expect(res.body.metrics.registrations).toBe(3);
        expect(res.body.metrics.walkInRegistrations).toBe(1);
        expect(res.body.metrics.cancelledRegistrations).toBe(1);
        expect(res.body.metrics.ticketsSent).toBe(2);
        expect(res.body.metrics.remindersSent).toBe(1);
        expect(res.body.metrics.certificatesIssued).toBe(2);
        expect(res.body.metrics.certificateEmailsSent).toBe(1);
        expect(res.body.metrics.sessionAttendanceSegments).toBe(2);
        expect(res.body.metrics.sessionAttendanceDwellMinutes).toBe(60);
        expect(res.body.registrationStatusBreakdown).toEqual({
            REGISTERED: 1,
            CANCELLED: 1,
            CHECKED_IN: 1,
        });
        expect(prismaMocks.eventFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 10,
                    isActive: true,
                    deletedAt: null,
                }),
            }),
        );
    });

    it("returns 404 when event outside period", async () => {
        prismaMocks.eventFindFirst.mockResolvedValue(null);
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/events/10?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/events/abc?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(400);
    });
});

describe("GET /usage-dashboard/projects", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.projectFindMany.mockResolvedValue([
            {
                id: 20,
                title: "Portal",
                status: "IN_PROGRESS",
                startDate: new Date("2026-03-01T00:00:00.000Z"),
                dueDate: new Date("2026-03-11T00:00:00.000Z"),
                completedDate: null,
            },
        ]);
        prismaMocks.taskFindMany.mockResolvedValue([
            { id: 1, projectId: 20, parentTaskId: null },
            { id: 2, projectId: 20, parentTaskId: null },
            { id: 3, projectId: 20, parentTaskId: 1 },
        ]);
        prismaMocks.projectPhaseGroupBy.mockResolvedValue([{ projectId: 20, _count: { _all: 2 } }]);
        prismaMocks.projectFileGroupBy.mockResolvedValue([{ projectId: 20, _count: { _all: 3 } }]);
        prismaMocks.projectPhotoGroupBy.mockResolvedValue([{ projectId: 20, _count: { _all: 1 } }]);
        prismaMocks.certificateGroupBy.mockResolvedValue([{ projectId: 20, _count: { _all: 2 } }]);
        prismaMocks.taskAssignmentFindMany.mockResolvedValue([
            { memberId: 1, task: { projectId: 20 } },
            { memberId: 2, task: { projectId: 20 } },
            { memberId: 1, task: { projectId: 20 } },
        ]);
    });

    it("returns 403 for non-developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: false });
        const res = await request(app).get("/projects?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(403);
    });

    it("returns projects summary and rows for developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/projects?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({
            projectsCreated: 1,
            tasks: 2,
            subtasks: 1,
            phases: 2,
            peopleWorked: 2,
            totalPlannedDurationDays: 10,
            files: 3,
            photos: 1,
            certificates: 2,
        });
        expect(res.body.projects).toEqual([
            {
                id: 20,
                title: "Portal",
                status: "IN_PROGRESS",
                startDate: "2026-03-01T00:00:00.000Z",
                dueDate: "2026-03-11T00:00:00.000Z",
                completedDate: null,
                tasks: 2,
                subtasks: 1,
                phases: 2,
                peopleWorked: 2,
                files: 3,
                photos: 1,
            },
        ]);
        expect(prismaMocks.projectFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                    createdAt: {
                        gte: new Date("2026-03-01T00:00:00.000Z"),
                        lte: new Date("2026-03-31T23:59:59.999Z"),
                    },
                }),
            }),
        );
    });

    it("returns empty when no projects", async () => {
        prismaMocks.projectFindMany.mockResolvedValue([]);
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/projects?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.projects).toEqual([]);
        expect(res.body.summary.projectsCreated).toBe(0);
        expect(prismaMocks.taskFindMany).not.toHaveBeenCalled();
    });
});

describe("GET /usage-dashboard/projects/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.projectFindFirst.mockResolvedValue({
            id: 20,
            title: "Portal",
            status: "IN_PROGRESS",
            startDate: new Date("2026-03-01T00:00:00.000Z"),
            dueDate: new Date("2026-03-11T00:00:00.000Z"),
            completedDate: null,
            createdAt: new Date("2026-03-02T00:00:00.000Z"),
            createdBy: { id: 5, fullName: "Ada Lovelace" },
        });
        prismaMocks.taskFindMany.mockResolvedValue([
            {
                id: 1,
                parentTaskId: null,
                status: "COMPLETED",
                estimatedHours: 4,
                actualHours: 5,
            },
            {
                id: 2,
                parentTaskId: null,
                status: "IN_PROGRESS",
                estimatedHours: 2,
                actualHours: null,
            },
            {
                id: 3,
                parentTaskId: 1,
                status: "COMPLETED",
                estimatedHours: 1,
                actualHours: 1,
            },
        ]);
        prismaMocks.projectPhaseCount.mockResolvedValue(2);
        prismaMocks.projectFileCount.mockResolvedValue(3);
        prismaMocks.projectPhotoCount.mockResolvedValue(1);
        prismaMocks.certificateCount.mockResolvedValue(2);
        prismaMocks.projectScheduleSlotFindMany.mockResolvedValue([
            {
                startDateTime: new Date("2026-03-05T09:00:00.000Z"),
                endDateTime: new Date("2026-03-05T12:00:00.000Z"),
            },
        ]);
        prismaMocks.taskAssignmentFindMany.mockResolvedValue([
            { memberId: 1, status: "COMPLETED" },
            { memberId: 2, status: "ASSIGNED" },
        ]);
    });

    it("returns project detail with completion and schedule hours", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/projects/20?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.project.createdBy).toEqual({ id: 5, fullName: "Ada Lovelace" });
        expect(res.body.metrics).toEqual({
            tasks: 2,
            subtasks: 1,
            phases: 2,
            peopleWorked: 2,
            files: 3,
            photos: 1,
            certificates: 2,
            taskCompletionRate: 50,
            assignmentCompletionRate: 50,
            scheduleSlotHours: 3,
            estimatedHours: 7,
            actualHours: 6,
        });
        expect(prismaMocks.projectFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 20,
                    isActive: true,
                }),
            }),
        );
        expect(prismaMocks.projectScheduleSlotFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { projectId: 20, isActive: true },
            }),
        );
    });

    it("returns 404 when project outside period", async () => {
        prismaMocks.projectFindFirst.mockResolvedValue(null);
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/projects/20?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(404);
    });
});

describe("GET /usage-dashboard/announcements", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.announcementFindMany.mockResolvedValue([
            {
                id: 30,
                title: "Volunteer call",
                createdAt: new Date("2026-03-05T10:00:00.000Z"),
                isPinned: true,
                isActive: true,
                targetType: "EVENT",
                eventId: 10,
                projectId: null,
                createdByMemberId: 5,
                createdBy: { fullName: "Ada Lovelace" },
                event: { title: "Workshop" },
                project: null,
            },
        ]);
        prismaMocks.announcementResponseFindMany.mockResolvedValue([
            { announcementId: 30, status: "AVAILABLE" },
            { announcementId: 30, status: "AVAILABLE" },
            { announcementId: 30, status: "UNAVAILABLE" },
        ]);
    });

    it("returns 403 for non-developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: false, isAdmin: true });
        const res = await request(app).get("/announcements?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(403);
        expect(prismaMocks.announcementFindMany).not.toHaveBeenCalled();
    });

    it("returns announcements summary and rows for developer", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.windowDays).toBe(31);
        expect(res.body.summary).toEqual({
            announcementsCreated: 1,
            totalResponses: 3,
            availableCount: 2,
            unavailableCount: 1,
            avgResponsesPerAnnouncement: 3,
        });
        expect(res.body.announcements).toEqual([
            {
                id: 30,
                title: "Volunteer call",
                createdAt: "2026-03-05T10:00:00.000Z",
                isPinned: true,
                isActive: true,
                targetType: "EVENT",
                eventId: 10,
                eventTitle: "Workshop",
                projectId: null,
                projectTitle: null,
                responseCount: 3,
                availableCount: 2,
                unavailableCount: 1,
                createdByMemberId: 5,
                createdByName: "Ada Lovelace",
            },
        ]);
        expect(prismaMocks.announcementFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isActive: true,
                    createdAt: {
                        gte: new Date("2026-03-01T00:00:00.000Z"),
                        lte: new Date("2026-03-31T23:59:59.999Z"),
                    },
                }),
            }),
        );
    });

    it("returns empty when no announcements", async () => {
        prismaMocks.announcementFindMany.mockResolvedValue([]);
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.announcements).toEqual([]);
        expect(res.body.summary.announcementsCreated).toBe(0);
        expect(res.body.summary.avgResponsesPerAnnouncement).toBe(0);
        expect(prismaMocks.announcementResponseFindMany).not.toHaveBeenCalled();
    });

    it("rejects invalid date range", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements?from=2026-03-31&to=2026-03-01");
        expect(res.status).toBe(400);
    });
});

describe("GET /usage-dashboard/announcements/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        prismaMocks.announcementFindFirst.mockResolvedValue({
            id: 30,
            title: "Volunteer call",
            body: "Please confirm availability for the upcoming workshop weekend.",
            createdAt: new Date("2026-03-05T10:00:00.000Z"),
            isPinned: true,
            isActive: true,
            targetType: "EVENT",
            eventId: 10,
            projectId: null,
            createdByMemberId: 5,
            createdBy: { fullName: "Ada Lovelace" },
            event: { title: "Workshop" },
            project: null,
        });
        prismaMocks.announcementResponseFindMany.mockResolvedValue([
            { status: "AVAILABLE" },
            { status: "AVAILABLE" },
            { status: "UNAVAILABLE" },
        ]);
        prismaMocks.announcementResponsePeriodCount.mockResolvedValue(4);
    });

    it("returns announcement detail with response metrics", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements/30?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.announcement).toEqual({
            id: 30,
            title: "Volunteer call",
            bodyPreview: "Please confirm availability for the upcoming workshop weekend.",
            createdAt: "2026-03-05T10:00:00.000Z",
            isPinned: true,
            isActive: true,
            targetType: "EVENT",
            eventId: 10,
            eventTitle: "Workshop",
            projectId: null,
            projectTitle: null,
            createdByMemberId: 5,
            createdByName: "Ada Lovelace",
        });
        expect(res.body.metrics).toEqual({
            responseCount: 3,
            availableCount: 2,
            unavailableCount: 1,
            availablePercent: 66.67,
            periodsCount: 4,
        });
        expect(res.body.statusBreakdown).toEqual({
            AVAILABLE: 2,
            UNAVAILABLE: 1,
        });
        expect(prismaMocks.announcementFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 30,
                    isActive: true,
                }),
            }),
        );
    });

    it("truncates long body preview", async () => {
        const longBody = "x".repeat(250);
        prismaMocks.announcementFindFirst.mockResolvedValue({
            id: 30,
            title: "Volunteer call",
            body: longBody,
            createdAt: new Date("2026-03-05T10:00:00.000Z"),
            isPinned: false,
            isActive: true,
            targetType: "NONE",
            eventId: null,
            projectId: null,
            createdByMemberId: 5,
            createdBy: { fullName: "Ada Lovelace" },
            event: null,
            project: null,
        });
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements/30?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(200);
        expect(res.body.announcement.bodyPreview).toBe(`${"x".repeat(200)}…`);
    });

    it("returns 404 when announcement outside period", async () => {
        prismaMocks.announcementFindFirst.mockResolvedValue(null);
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements/30?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
        const app = buildRouteApp(usageDashboardRouter, { isDeveloper: true });
        const res = await request(app).get("/announcements/abc?from=2026-03-01&to=2026-03-31");
        expect(res.status).toBe(400);
    });
});
