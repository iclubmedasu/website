import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    sitePageFindUnique: vi.fn(),
    sitePageUpdate: vi.fn(),
    supportNoticeBlockFindMany: vi.fn(),
    supportNoticeBlockFindUnique: vi.fn(),
    supportNoticeBlockCreate: vi.fn(),
    supportNoticeBlockUpdate: vi.fn(),
    supportNoticeBlockDelete: vi.fn(),
    supportNoticeBlockAggregate: vi.fn(),
    incidentReportTypeFindMany: vi.fn(),
    incidentReportTypeFindFirst: vi.fn(),
    incidentReportTypeFindUnique: vi.fn(),
    incidentReportTypeCreate: vi.fn(),
    incidentReportTypeUpdate: vi.fn(),
    incidentReportTypeDelete: vi.fn(),
    incidentReportTypeAggregate: vi.fn(),
    incidentReportFieldFindMany: vi.fn(),
    incidentReportFieldFindFirst: vi.fn(),
    incidentReportFieldFindUnique: vi.fn(),
    incidentReportFieldCreate: vi.fn(),
    incidentReportFieldUpdate: vi.fn(),
    incidentReportFieldDelete: vi.fn(),
    incidentReportFieldAggregate: vi.fn(),
    incidentReportCreate: vi.fn(),
    incidentReportFindMany: vi.fn(),
    incidentReportCount: vi.fn(),
    incidentReportFindUnique: vi.fn(),
    teamMemberFindMany: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        sitePage: {
            findUnique: prismaMocks.sitePageFindUnique,
            update: prismaMocks.sitePageUpdate,
        },
        supportNoticeBlock: {
            findMany: prismaMocks.supportNoticeBlockFindMany,
            findUnique: prismaMocks.supportNoticeBlockFindUnique,
            create: prismaMocks.supportNoticeBlockCreate,
            update: prismaMocks.supportNoticeBlockUpdate,
            delete: prismaMocks.supportNoticeBlockDelete,
            aggregate: prismaMocks.supportNoticeBlockAggregate,
        },
        incidentReportType: {
            findMany: prismaMocks.incidentReportTypeFindMany,
            findFirst: prismaMocks.incidentReportTypeFindFirst,
            findUnique: prismaMocks.incidentReportTypeFindUnique,
            create: prismaMocks.incidentReportTypeCreate,
            update: prismaMocks.incidentReportTypeUpdate,
            delete: prismaMocks.incidentReportTypeDelete,
            aggregate: prismaMocks.incidentReportTypeAggregate,
        },
        incidentReportField: {
            findMany: prismaMocks.incidentReportFieldFindMany,
            findFirst: prismaMocks.incidentReportFieldFindFirst,
            findUnique: prismaMocks.incidentReportFieldFindUnique,
            create: prismaMocks.incidentReportFieldCreate,
            update: prismaMocks.incidentReportFieldUpdate,
            delete: prismaMocks.incidentReportFieldDelete,
            aggregate: prismaMocks.incidentReportFieldAggregate,
        },
        incidentReport: {
            create: prismaMocks.incidentReportCreate,
            findMany: prismaMocks.incidentReportFindMany,
            count: prismaMocks.incidentReportCount,
            findUnique: prismaMocks.incidentReportFindUnique,
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
        },
        $transaction: prismaMocks.transaction,
    },
}));

import supportContentRouter from "../../routes/supportContent";
import { buildRouteApp } from "./testHarness";

const supportPage = {
    id: "support",
    eyebrow: "Support",
    title: "Help and Support",
    description: "Submit a report",
    createdAt: new Date(),
    updatedAt: new Date(),
};

const generalForm = {
    id: 1,
    label: "General Report",
    slug: "general",
    sortOrder: 0,
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [
        {
            id: 10,
            formId: 1,
            label: "Location",
            type: "text",
            options: null,
            required: false,
            order: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ],
};

const personalForm = {
    id: 2,
    label: "Personal Report",
    slug: "personal",
    sortOrder: 1,
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [],
};

const noticeBlock = {
    id: 1,
    sortOrder: 0,
    locale: "EN" as const,
    content: "Guidance text",
    createdAt: new Date(),
    updatedAt: new Date(),
};

function mockEditorPageData() {
    prismaMocks.sitePageFindUnique.mockResolvedValue(supportPage);
    prismaMocks.supportNoticeBlockFindMany.mockResolvedValue([noticeBlock]);
    prismaMocks.incidentReportTypeFindMany.mockResolvedValue([generalForm, personalForm]);
}

describe("support content routes", () => {
    beforeEach(() => {
        mockEditorPageData();
        prismaMocks.supportNoticeBlockAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
        prismaMocks.incidentReportFieldAggregate.mockResolvedValue({ _max: { order: 0 } });
        prismaMocks.incidentReportTypeAggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
        prismaMocks.incidentReportFindMany.mockResolvedValue([]);
        prismaMocks.incidentReportCount.mockResolvedValue(0);
        prismaMocks.teamMemberFindMany.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("GET / returns 403 for regular members", async () => {
        const response = await request(buildRouteApp(supportContentRouter, { isLeadership: false }))
            .get("/");

        expect(response.status).toBe(403);
    });

    it("GET / returns 403 for leadership without forms editor access", async () => {
        const response = await request(buildRouteApp(supportContentRouter, { isLeadership: true }))
            .get("/");

        expect(response.status).toBe(403);
    });

    it("GET / returns page for officers with nested forms", async () => {
        const response = await request(buildRouteApp(supportContentRouter, { isOfficer: true }))
            .get("/");

        expect(response.status).toBe(200);
        expect(response.body.header.title).toBe("Help and Support");
        expect(response.body.forms).toHaveLength(2);
        expect(response.body.forms[0].fields).toHaveLength(1);
    });

    it("GET / strips header and notices for HR forms editors", async () => {
        const response = await request(buildRouteApp(supportContentRouter, { isSupportFormsEditor: true }))
            .get("/");

        expect(response.status).toBe(200);
        expect(response.body.header).toEqual({ eyebrow: "", title: "", description: "" });
        expect(response.body.notices).toEqual([]);
        expect(response.body.forms).toHaveLength(2);
    });

    it("PUT /header returns 403 for HR forms editors", async () => {
        const response = await request(buildRouteApp(supportContentRouter, { isSupportFormsEditor: true }))
            .put("/header")
            .send({ eyebrow: "A", title: "B", description: "C" });

        expect(response.status).toBe(403);
    });

    it("POST /forms/:formId/fields allows HR forms editors", async () => {
        prismaMocks.incidentReportTypeFindUnique.mockResolvedValue(generalForm);
        prismaMocks.incidentReportFieldCreate.mockResolvedValue({
            ...generalForm.fields[0],
            id: 12,
            label: "Priority",
            type: "text",
        });
        prismaMocks.incidentReportTypeFindMany.mockResolvedValue([
            {
                ...generalForm,
                fields: [
                    ...generalForm.fields,
                    {
                        ...generalForm.fields[0],
                        id: 12,
                        label: "Priority",
                        type: "text",
                    },
                ],
            },
            personalForm,
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { isSupportFormsEditor: true }))
            .post("/forms/1/fields")
            .send({
                label: "Priority",
                type: "text",
                required: false,
            });

        expect(response.status).toBe(201);
    });

    it("POST /forms/:formId/fields creates a field for officers", async () => {
        prismaMocks.incidentReportTypeFindUnique.mockResolvedValue(generalForm);
        prismaMocks.incidentReportFieldCreate.mockResolvedValue({
            ...generalForm.fields[0],
            id: 11,
            label: "Severity",
            type: "dropdown",
        });
        prismaMocks.incidentReportTypeFindMany.mockResolvedValue([
            {
                ...generalForm,
                fields: [
                    ...generalForm.fields,
                    {
                        ...generalForm.fields[0],
                        id: 11,
                        label: "Severity",
                        type: "dropdown",
                    },
                ],
            },
            personalForm,
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { isOfficer: true }))
            .post("/forms/1/fields")
            .send({
                label: "Severity",
                type: "dropdown",
                options: ["Low", "High"],
                required: true,
            });

        expect(response.status).toBe(201);
        expect(prismaMocks.incidentReportFieldCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ formId: 1 }) }),
        );
    });

    it("POST /incident-reports allows authenticated members with general form", async () => {
        prismaMocks.incidentReportTypeFindFirst.mockResolvedValue(generalForm);
        prismaMocks.incidentReportCreate.mockResolvedValue({
            id: 10,
            answers: {
                form: { id: 1, label: "General Report", slug: "general" },
                reporter: { name: null, email: "member@example.com", phone: null, team: "Outreach" },
                description: "Issue details",
                extraAnswers: [],
            },
            source: "PORTAL",
            submitterMemberId: 5,
            createdAt: new Date("2026-06-24T12:00:00.000Z"),
        });
        prismaMocks.teamMemberFindMany.mockResolvedValue([
            { team: { name: "Outreach" } },
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { memberId: 5 }))
            .post("/incident-reports")
            .send({
                formId: 1,
                email: "member@example.com",
                description: "Issue details",
            });

        expect(response.status).toBe(201);
        expect(prismaMocks.incidentReportCreate).toHaveBeenCalled();
        const createData = prismaMocks.incidentReportCreate.mock.calls[0][0].data;
        expect(createData.answers.reporter.team).toBe("Outreach");
    });

    it("POST /incident-reports validates email is required", async () => {
        prismaMocks.incidentReportTypeFindFirst.mockResolvedValue(generalForm);

        const response = await request(buildRouteApp(supportContentRouter, { memberId: 5 }))
            .post("/incident-reports")
            .send({
                formId: 1,
                description: "Issue details",
            });

        expect(response.status).toBe(400);
        expect(response.body.fieldErrors?.email).toBeDefined();
    });

    it("POST /incident-reports requires name for personal forms", async () => {
        prismaMocks.incidentReportTypeFindFirst.mockResolvedValue(personalForm);

        const response = await request(buildRouteApp(supportContentRouter, { memberId: 5 }))
            .post("/incident-reports")
            .send({
                formId: 2,
                email: "member@example.com",
                description: "Personal concern",
            });

        expect(response.status).toBe(400);
        expect(response.body.fieldErrors?.name).toBeDefined();
    });

    it("POST /incident-reports does not require name for general forms", async () => {
        prismaMocks.incidentReportTypeFindFirst.mockResolvedValue(generalForm);
        prismaMocks.incidentReportCreate.mockResolvedValue({
            id: 11,
            answers: {
                form: { id: 1, label: "General Report", slug: "general" },
                reporter: { name: null, email: "anon@example.com", phone: null, team: null },
                description: "Anonymous report",
                extraAnswers: [],
            },
            source: "PORTAL",
            submitterMemberId: 5,
            createdAt: new Date("2026-06-24T12:00:00.000Z"),
        });

        const response = await request(buildRouteApp(supportContentRouter, { memberId: 5 }))
            .post("/incident-reports")
            .send({
                formId: 1,
                email: "anon@example.com",
                description: "Anonymous report",
            });

        expect(response.status).toBe(201);
    });

    it("DELETE /forms/:id returns 409 for system forms", async () => {
        prismaMocks.incidentReportTypeFindUnique.mockResolvedValue(generalForm);

        const response = await request(buildRouteApp(supportContentRouter, { isOfficer: true }))
            .delete("/forms/1");

        expect(response.status).toBe(409);
        expect(prismaMocks.incidentReportTypeDelete).not.toHaveBeenCalled();
    });

    it("DELETE /forms/:id allows deleting custom forms", async () => {
        const customForm = { ...generalForm, id: 99, isSystem: false, slug: null, fields: [] };
        prismaMocks.incidentReportTypeFindUnique.mockResolvedValue(customForm);
        prismaMocks.incidentReportTypeDelete.mockResolvedValue(customForm);

        const response = await request(buildRouteApp(supportContentRouter, { isOfficer: true }))
            .delete("/forms/99");

        expect(response.status).toBe(200);
        expect(prismaMocks.incidentReportTypeDelete).toHaveBeenCalledWith({ where: { id: 99 } });
    });

    it("GET /reports/counts returns submission counts for forms editors", async () => {
        prismaMocks.incidentReportFindMany.mockResolvedValue([
            {
                answers: {
                    form: { id: 1, label: "General Report" },
                    reporter: { email: "a@example.com" },
                    description: "One",
                    extraAnswers: [],
                },
            },
            {
                answers: {
                    form: { id: 1, label: "General Report" },
                    reporter: { email: "b@example.com" },
                    description: "Two",
                    extraAnswers: [],
                },
            },
            {
                answers: {
                    form: { id: 2, label: "Personal Report" },
                    reporter: { email: "c@example.com" },
                    description: "Three",
                    extraAnswers: [],
                },
            },
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { isSupportFormsEditor: true }))
            .get("/reports/counts");

        expect(response.status).toBe(200);
        expect(response.body.counts).toEqual({ "1": 2, "2": 1 });
    });

    it("GET /reports?formId filters submissions by form", async () => {
        prismaMocks.incidentReportFindMany.mockResolvedValue([
            {
                id: 1,
                answers: {
                    form: { id: 1, label: "General Report", slug: "general" },
                    reporter: { email: "a@example.com" },
                    description: "Match",
                    extraAnswers: [],
                },
                source: "PORTAL",
                submitterMemberId: 5,
                createdAt: new Date("2026-06-24T12:00:00.000Z"),
            },
            {
                id: 2,
                answers: {
                    form: { id: 2, label: "Personal Report", slug: "personal" },
                    reporter: { email: "b@example.com" },
                    description: "Other",
                    extraAnswers: [],
                },
                source: "PUBLIC",
                submitterMemberId: null,
                createdAt: new Date("2026-06-24T13:00:00.000Z"),
            },
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { isOfficer: true }))
            .get("/reports?formId=1");

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(1);
        expect(response.body.reports).toHaveLength(1);
        expect(response.body.reports[0].formId).toBe(1);
    });

    it("GET /forms/:formId/reports returns full submission rows for forms editors", async () => {
        prismaMocks.incidentReportFindMany.mockResolvedValue([
            {
                id: 1,
                answers: {
                    form: { id: 1, label: "General Report", slug: "general" },
                    reporter: {
                        name: "Alex",
                        email: "alex@example.com",
                        phone: "123",
                        team: "Outreach",
                    },
                    description: "Issue",
                    extraAnswers: [],
                },
                source: "PORTAL",
                submitterMemberId: 5,
                createdAt: new Date("2026-06-24T12:00:00.000Z"),
            },
            {
                id: 2,
                answers: {
                    form: { id: 2, label: "Personal Report", slug: "personal" },
                    reporter: {
                        name: "Bob",
                        email: "bob@example.com",
                        phone: null,
                        team: null,
                    },
                    description: "Other form",
                    extraAnswers: [],
                },
                source: "PUBLIC",
                submitterMemberId: null,
                createdAt: new Date("2026-06-24T13:00:00.000Z"),
            },
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { isSupportFormsEditor: true }))
            .get("/forms/1/reports");

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(1);
        expect(response.body.reports).toHaveLength(1);
        expect(response.body.reports[0].payload.reporter.email).toBe("alex@example.com");
        expect(response.body.reports[0].payload.form.id).toBe(1);
    });

    it("GET /forms/:formId/reports/export returns xlsx for forms editors", async () => {
        prismaMocks.incidentReportTypeFindUnique.mockResolvedValue(generalForm);
        prismaMocks.incidentReportFindMany.mockResolvedValue([
            {
                id: 1,
                answers: {
                    form: { id: 1, label: "General Report", slug: "general" },
                    reporter: {
                        name: "Alex",
                        email: "alex@example.com",
                        phone: "123",
                        team: "Outreach",
                    },
                    description: "Issue",
                    extraAnswers: [],
                },
                source: "PORTAL",
                submitterMemberId: 5,
                createdAt: new Date("2026-06-24T12:00:00.000Z"),
            },
        ]);

        const response = await request(buildRouteApp(supportContentRouter, { isSupportFormsEditor: true }))
            .get("/forms/1/reports/export")
            .buffer(true)
            .parse((res, callback) => {
                const data: Buffer[] = [];
                res.on("data", (chunk) => data.push(chunk));
                res.on("end", () => callback(null, Buffer.concat(data)));
            });

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        expect(response.headers["content-disposition"]).toContain("General Report-submissions.xlsx");
        expect((response.body as Buffer).length).toBeGreaterThan(0);
    });

    it("GET /forms/:formId/reports/export returns 403 for regular members", async () => {
        const response = await request(buildRouteApp(supportContentRouter, { isLeadership: false }))
            .get("/forms/1/reports/export");

        expect(response.status).toBe(403);
    });
});
