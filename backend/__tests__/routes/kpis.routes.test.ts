import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    taskAssignmentFindMany: vi.fn(),
    eventTaskAssignmentFindMany: vi.fn(),
    memberFindFirst: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        taskAssignment: {
            findMany: prismaMocks.taskAssignmentFindMany,
        },
        eventTaskAssignment: {
            findMany: prismaMocks.eventTaskAssignmentFindMany,
        },
        member: {
            findFirst: prismaMocks.memberFindFirst,
        },
    },
}));

import kpisRouter from "../../routes/kpis";
import { buildRouteApp } from "./testHarness";

const RANGE = "startDate=2026-03-01&endDate=2026-03-31";

describe("GET /kpis/employees", () => {
    beforeEach(() => {
        prismaMocks.taskAssignmentFindMany.mockReset();
        prismaMocks.eventTaskAssignmentFindMany.mockReset();
        prismaMocks.memberFindFirst.mockReset();
        prismaMocks.taskAssignmentFindMany.mockResolvedValue([]);
        prismaMocks.eventTaskAssignmentFindMany.mockResolvedValue([]);
    });

    it("returns 403 for non-privileged user", async () => {
        const app = buildRouteApp(kpisRouter, {
            isDeveloper: false,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
        });
        const res = await request(app).get(`/employees?${RANGE}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe("KPI access required");
        expect(prismaMocks.taskAssignmentFindMany).not.toHaveBeenCalled();
    });

    it("returns 400 when startDate/endDate missing", async () => {
        const app = buildRouteApp(kpisRouter, { isAdmin: true });
        const res = await request(app).get("/employees?startDate=2026-03-01");
        expect(res.status).toBe(400);
        expect(prismaMocks.taskAssignmentFindMany).not.toHaveBeenCalled();
    });

    it("returns 400 when range is inverted", async () => {
        const app = buildRouteApp(kpisRouter, { isOfficer: true });
        const res = await request(app).get("/employees?startDate=2026-03-31&endDate=2026-03-01");
        expect(res.status).toBe(400);
        expect(prismaMocks.taskAssignmentFindMany).not.toHaveBeenCalled();
    });

    it("returns aggregated KPIs for privileged user", async () => {
        prismaMocks.taskAssignmentFindMany.mockResolvedValue([
            {
                id: 1,
                memberId: 10,
                status: "COMPLETED",
                assignedDate: new Date("2026-03-02T10:00:00.000Z"),
                completedDate: new Date("2026-03-04T10:00:00.000Z"),
                member: { id: 10, fullName: "Ada Lovelace", profilePhotoUrl: null },
                task: {
                    id: 100,
                    title: "Write report",
                    dueDate: new Date("2026-03-10T00:00:00.000Z"),
                    project: { id: 1, title: "Alpha" },
                },
            },
            {
                id: 2,
                memberId: 10,
                status: "IN_PROGRESS",
                assignedDate: new Date("2026-03-05T10:00:00.000Z"),
                completedDate: null,
                member: { id: 10, fullName: "Ada Lovelace", profilePhotoUrl: null },
                task: {
                    id: 101,
                    title: "Late task",
                    dueDate: new Date("2020-01-01T00:00:00.000Z"),
                    project: { id: 1, title: "Alpha" },
                },
            },
        ]);
        prismaMocks.eventTaskAssignmentFindMany.mockResolvedValue([
            {
                id: 50,
                memberId: 10,
                startDateTime: new Date("2026-03-08T09:00:00.000Z"),
                endDateTime: new Date("2026-03-08T12:00:00.000Z"),
                member: { id: 10, fullName: "Ada Lovelace", profilePhotoUrl: null },
                eventTask: {
                    id: 200,
                    title: "Registration desk",
                    taskDate: new Date("2026-03-08T00:00:00.000Z"),
                    event: { id: 7, title: "Open Day" },
                },
            },
        ]);

        const app = buildRouteApp(kpisRouter, { isLeadership: true });
        const res = await request(app).get(`/employees?${RANGE}`);

        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({
            totalMembers: 1,
            totalProjectTasksAssigned: 2,
            totalProjectTasksCompleted: 1,
            totalEventTaskAssignments: 1,
        });
        expect(res.body.employees).toHaveLength(1);
        expect(res.body.employees[0]).toMatchObject({
            memberId: 10,
            fullName: "Ada Lovelace",
            projectTasks: {
                assignedCount: 2,
                completedCount: 1,
                overdueCount: 1,
                completionRate: 0.5,
                avgCompletionDays: 2,
            },
            eventTasks: { assignedCount: 1 },
        });

        const projectWhere = prismaMocks.taskAssignmentFindMany.mock.calls[0][0].where;
        expect(projectWhere.assignedDate.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
        expect(projectWhere.assignedDate.lte.toISOString()).toBe("2026-03-31T23:59:59.999Z");
        expect(projectWhere.member).toEqual({ isActive: true });
        expect(projectWhere.task).toEqual({
            isActive: true,
            project: { isActive: true },
        });

        const eventWhere = prismaMocks.eventTaskAssignmentFindMany.mock.calls[0][0].where;
        expect(eventWhere.startDateTime.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
        expect(eventWhere.eventTask).toEqual({
            isActive: true,
            event: { isActive: true },
        });
    });
});

describe("GET /kpis/employees/:memberId", () => {
    beforeEach(() => {
        prismaMocks.taskAssignmentFindMany.mockReset();
        prismaMocks.eventTaskAssignmentFindMany.mockReset();
        prismaMocks.memberFindFirst.mockReset();
        prismaMocks.taskAssignmentFindMany.mockResolvedValue([]);
        prismaMocks.eventTaskAssignmentFindMany.mockResolvedValue([]);
    });

    it("returns 403 for non-privileged user", async () => {
        const app = buildRouteApp(kpisRouter);
        const res = await request(app).get(`/employees/10?${RANGE}`);
        expect(res.status).toBe(403);
        expect(prismaMocks.memberFindFirst).not.toHaveBeenCalled();
    });

    it("returns 400 when dates missing", async () => {
        const app = buildRouteApp(kpisRouter, { isDeveloper: true });
        const res = await request(app).get("/employees/10");
        expect(res.status).toBe(400);
    });

    it("returns 404 when member missing or inactive", async () => {
        prismaMocks.memberFindFirst.mockResolvedValue(null);
        const app = buildRouteApp(kpisRouter, { isAdmin: true });
        const res = await request(app).get(`/employees/99?${RANGE}`);
        expect(res.status).toBe(404);
        expect(prismaMocks.taskAssignmentFindMany).not.toHaveBeenCalled();
    });

    it("returns zeros and empty lists when active member has no range activity", async () => {
        prismaMocks.memberFindFirst.mockResolvedValue({
            id: 10,
            fullName: "Ada Lovelace",
            profilePhotoUrl: "/photos/10.jpg",
        });

        const app = buildRouteApp(kpisRouter, { isAdmin: true });
        const res = await request(app).get(`/employees/10?${RANGE}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            memberId: 10,
            fullName: "Ada Lovelace",
            profilePhotoUrl: "/photos/10.jpg",
            projectTasks: {
                assignedCount: 0,
                completedCount: 0,
                overdueCount: 0,
                completionRate: 0,
                avgCompletionDays: null,
                tasks: [],
            },
            eventTasks: {
                assignedCount: 0,
                tasks: [],
            },
        });
    });

    it("returns detail task lists for privileged user", async () => {
        prismaMocks.memberFindFirst.mockResolvedValue({
            id: 10,
            fullName: "Ada Lovelace",
            profilePhotoUrl: null,
        });
        prismaMocks.taskAssignmentFindMany.mockResolvedValue([
            {
                id: 1,
                memberId: 10,
                status: "COMPLETED",
                assignedDate: new Date("2026-03-02T10:00:00.000Z"),
                completedDate: new Date("2026-03-03T10:00:00.000Z"),
                member: { id: 10, fullName: "Ada Lovelace", profilePhotoUrl: null },
                task: {
                    id: 100,
                    title: "Write report",
                    dueDate: new Date("2026-03-10T00:00:00.000Z"),
                    project: { id: 1, title: "Alpha" },
                },
            },
        ]);
        prismaMocks.eventTaskAssignmentFindMany.mockResolvedValue([
            {
                id: 50,
                memberId: 10,
                startDateTime: new Date("2026-03-08T09:00:00.000Z"),
                endDateTime: new Date("2026-03-08T12:00:00.000Z"),
                member: { id: 10, fullName: "Ada Lovelace", profilePhotoUrl: null },
                eventTask: {
                    id: 200,
                    title: "Registration desk",
                    taskDate: new Date("2026-03-08T00:00:00.000Z"),
                    event: { id: 7, title: "Open Day" },
                },
            },
        ]);

        const app = buildRouteApp(kpisRouter, { isOfficer: true });
        const res = await request(app).get(`/employees/10?${RANGE}`);

        expect(res.status).toBe(200);
        expect(res.body.projectTasks.assignedCount).toBe(1);
        expect(res.body.projectTasks.tasks).toEqual([
            {
                assignmentId: 1,
                taskId: 100,
                title: "Write report",
                status: "COMPLETED",
                dueDate: "2026-03-10T00:00:00.000Z",
                completedDate: "2026-03-03T10:00:00.000Z",
                assignedDate: "2026-03-02T10:00:00.000Z",
                project: { id: 1, title: "Alpha" },
            },
        ]);
        expect(res.body.eventTasks.tasks).toEqual([
            {
                assignmentId: 50,
                eventTaskId: 200,
                title: "Registration desk",
                taskDate: "2026-03-08T00:00:00.000Z",
                startDateTime: "2026-03-08T09:00:00.000Z",
                endDateTime: "2026-03-08T12:00:00.000Z",
                event: { id: 7, title: "Open Day" },
            },
        ]);
        expect(prismaMocks.taskAssignmentFindMany.mock.calls[0][0].where.memberId).toBe(10);
    });
});
