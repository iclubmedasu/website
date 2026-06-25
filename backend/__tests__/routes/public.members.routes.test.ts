import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    teamFindFirst: vi.fn(),
    teamFindMany: vi.fn(),
    memberFindMany: vi.fn(),
    memberFindUnique: vi.fn(),
    memberRoleHistoryFindMany: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        team: {
            findFirst: prismaMocks.teamFindFirst,
            findMany: prismaMocks.teamFindMany,
        },
        member: {
            findMany: prismaMocks.memberFindMany,
            findUnique: prismaMocks.memberFindUnique,
        },
        memberRoleHistory: {
            findMany: prismaMocks.memberRoleHistoryFindMany,
        },
    },
}));

vi.mock("../../services/emailService", () => ({
    sendEmail: vi.fn(),
}));

import publicRouter from "../../routes/public";

function createApp() {
    const app = express();
    app.use(express.json());
    app.use("/public", publicRouter);
    return app;
}

const eligibleMember = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    fullName: "Alice Officer",
    profilePhotoUrl: "https://example.com/photo.jpg",
    isActive: true,
    assignmentStatus: "ASSIGNED",
    ...overrides,
});

describe("public members routes", () => {
    beforeEach(() => {
        prismaMocks.teamFindFirst.mockResolvedValue(null);
        prismaMocks.teamFindMany.mockResolvedValue([]);
        prismaMocks.memberFindMany.mockResolvedValue([]);
        prismaMocks.memberFindUnique.mockResolvedValue(null);
        prismaMocks.memberRoleHistoryFindMany.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("GET /public/members/directory", () => {
        it("returns pyramid slots and excludes leadership from members list", async () => {
            prismaMocks.teamFindFirst.mockResolvedValueOnce({
                id: 1,
                name: "Administration",
                isActive: true,
                members: [
                    {
                        member: eligibleMember({ id: 10, fullName: "Officer One" }),
                        role: { roleName: "Officer" },
                    },
                    {
                        member: eligibleMember({ id: 11, fullName: "President One" }),
                        role: { roleName: "President" },
                    },
                    {
                        member: eligibleMember({ id: 12, fullName: "VP One" }),
                        role: { roleName: "Vice President" },
                    },
                ],
            });

            prismaMocks.teamFindMany.mockResolvedValueOnce([
                {
                    id: 2,
                    name: "Events",
                    isActive: true,
                    members: [
                        {
                            member: eligibleMember({ id: 20, fullName: "Events Head" }),
                            role: { roleName: "Head of Team", systemRoleKey: 1 },
                        },
                        {
                            member: eligibleMember({ id: 21, fullName: "Events Vice" }),
                            role: { roleName: "Vice Head of Team", systemRoleKey: 2 },
                        },
                    ],
                },
                {
                    id: 3,
                    name: "Media",
                    isActive: true,
                    members: [
                        {
                            member: eligibleMember({ id: 30, fullName: "Media Head" }),
                            role: { roleName: "Head of Team", systemRoleKey: 1 },
                        },
                    ],
                },
            ]);

            prismaMocks.memberFindMany.mockResolvedValueOnce([
                {
                    id: 40,
                    fullName: "Regular Member",
                    profilePhotoUrl: null,
                    teamMemberships: [
                        {
                            team: { name: "Events" },
                            role: { roleName: "Member" },
                        },
                    ],
                },
            ]);

            const response = await request(createApp()).get("/public/members/directory");

            expect(response.status).toBe(200);
            expect(response.body.officer.fullName).toBe("Officer One");
            expect(response.body.president.fullName).toBe("President One");
            expect(response.body.vicePresident.fullName).toBe("VP One");
            expect(response.body.teamLeadership).toHaveLength(2);
            expect(response.body.teamLeadership[0].teamName).toBe("Events");
            expect(response.body.teamLeadership[0].head.fullName).toBe("Events Head");
            expect(response.body.teamLeadership[0].vice.fullName).toBe("Events Vice");
            expect(response.body.members).toHaveLength(1);
            expect(response.body.members[0].fullName).toBe("Regular Member");
            expect(response.body.members[0].roleLabel).toBe("Member — Events");

            expect(prismaMocks.memberFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: { notIn: expect.arrayContaining([10, 11, 12, 20, 21, 30]) },
                    }),
                }),
            );
        });
    });

    describe("GET /public/members/:id/profile", () => {
        const baseProfileMember = {
            id: 42,
            fullName: "Test Member",
            email: "213256@med.asu.edu.eg",
            email2: "extra@example.com",
            email3: null,
            phoneNumber: "+201012345678",
            phoneNumber2: null,
            studentId: 213256,
            profilePhotoUrl: null,
            linkedInUrl: "https://linkedin.com/in/test",
            joinDate: new Date("2025-01-01T00:00:00.000Z"),
            showPhoneNumber: false,
            showPhoneNumber2: false,
            showEmail2: false,
            showEmail3: false,
            showStudentId: false,
            isActive: true,
            assignmentStatus: "ASSIGNED",
        };

        it("redacts hidden contact fields", async () => {
            prismaMocks.memberFindUnique.mockResolvedValueOnce(baseProfileMember);
            prismaMocks.memberRoleHistoryFindMany.mockResolvedValueOnce([]);

            const response = await request(createApp()).get("/public/members/42/profile");

            expect(response.status).toBe(200);
            expect(response.body.email).toBe("213256@med.asu.edu.eg");
            expect(response.body.phoneNumber).toBeNull();
            expect(response.body.email2).toBeNull();
            expect(response.body.studentId).toBeNull();
            expect(response.body.roleHistory).toEqual([]);
        });

        it("includes contact fields when visibility flags are enabled", async () => {
            prismaMocks.memberFindUnique.mockResolvedValueOnce({
                ...baseProfileMember,
                showPhoneNumber: true,
                showEmail2: true,
                showStudentId: true,
            });
            prismaMocks.memberRoleHistoryFindMany.mockResolvedValueOnce([]);

            const response = await request(createApp()).get("/public/members/42/profile");

            expect(response.status).toBe(200);
            expect(response.body.phoneNumber).toBe("+201012345678");
            expect(response.body.email2).toBe("extra@example.com");
            expect(response.body.studentId).toBe(213256);
        });

        it("returns role history for eligible members", async () => {
            prismaMocks.memberFindUnique.mockResolvedValueOnce(baseProfileMember);
            prismaMocks.memberRoleHistoryFindMany.mockResolvedValueOnce([
                {
                    id: 1,
                    changeType: "Assigned",
                    changeReason: null,
                    notes: null,
                    startDate: new Date("2025-01-01T00:00:00.000Z"),
                    endDate: null,
                    isActive: true,
                    member: { fullName: "Test Member" },
                    team: { name: "Events" },
                    role: { roleName: "Member" },
                    subteam: null,
                },
            ]);

            const response = await request(createApp()).get("/public/members/42/profile");

            expect(response.status).toBe(200);
            expect(response.body.roleHistory).toHaveLength(1);
            expect(response.body.roleHistory[0].teamName).toBe("Events");
        });

        it("returns 404 for inactive members", async () => {
            prismaMocks.memberFindUnique.mockResolvedValueOnce({
                ...baseProfileMember,
                isActive: false,
            });

            const response = await request(createApp()).get("/public/members/42/profile");
            expect(response.status).toBe(404);
        });

        it("returns 404 for alumni", async () => {
            prismaMocks.memberFindUnique.mockResolvedValueOnce({
                ...baseProfileMember,
                assignmentStatus: "ALUMNI",
            });

            const response = await request(createApp()).get("/public/members/42/profile");
            expect(response.status).toBe(404);
        });

        it("returns 404 for pending placeholder members", async () => {
            prismaMocks.memberFindUnique.mockResolvedValueOnce({
                ...baseProfileMember,
                fullName: "Pending",
            });

            const response = await request(createApp()).get("/public/members/42/profile");
            expect(response.status).toBe(404);
        });
    });
});
