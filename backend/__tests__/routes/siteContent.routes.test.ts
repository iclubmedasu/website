import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    sitePageFindUnique: vi.fn(),
    sitePageUpdate: vi.fn(),
    aboutSectionFindMany: vi.fn(),
    aboutSectionFindUnique: vi.fn(),
    aboutSectionCreate: vi.fn(),
    aboutSectionUpdate: vi.fn(),
    aboutSectionDelete: vi.fn(),
    aboutSectionAggregate: vi.fn(),
    aboutSponsorFindFirst: vi.fn(),
    aboutSponsorCreate: vi.fn(),
    aboutSponsorUpdate: vi.fn(),
    aboutSponsorDelete: vi.fn(),
    aboutSponsorAggregate: vi.fn(),
    contactMethodFindMany: vi.fn(),
    contactMethodCreate: vi.fn(),
    contactMethodUpdate: vi.fn(),
    contactMethodDelete: vi.fn(),
    contactMethodAggregate: vi.fn(),
    socialLinkFindMany: vi.fn(),
    socialLinkCreate: vi.fn(),
    socialLinkUpdate: vi.fn(),
    socialLinkDelete: vi.fn(),
    socialLinkAggregate: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        sitePage: {
            findUnique: prismaMocks.sitePageFindUnique,
            update: prismaMocks.sitePageUpdate,
        },
        aboutSection: {
            findMany: prismaMocks.aboutSectionFindMany,
            findUnique: prismaMocks.aboutSectionFindUnique,
            create: prismaMocks.aboutSectionCreate,
            update: prismaMocks.aboutSectionUpdate,
            delete: prismaMocks.aboutSectionDelete,
            aggregate: prismaMocks.aboutSectionAggregate,
        },
        aboutSponsor: {
            findFirst: prismaMocks.aboutSponsorFindFirst,
            create: prismaMocks.aboutSponsorCreate,
            update: prismaMocks.aboutSponsorUpdate,
            delete: prismaMocks.aboutSponsorDelete,
            aggregate: prismaMocks.aboutSponsorAggregate,
        },
        contactMethod: {
            findMany: prismaMocks.contactMethodFindMany,
            create: prismaMocks.contactMethodCreate,
            update: prismaMocks.contactMethodUpdate,
            delete: prismaMocks.contactMethodDelete,
            aggregate: prismaMocks.contactMethodAggregate,
        },
        socialLink: {
            findMany: prismaMocks.socialLinkFindMany,
            create: prismaMocks.socialLinkCreate,
            update: prismaMocks.socialLinkUpdate,
            delete: prismaMocks.socialLinkDelete,
            aggregate: prismaMocks.socialLinkAggregate,
        },
    },
}));

import siteContentRouter from "../../routes/siteContent";
import { buildRouteApp } from "./testHarness";

const aboutPage = {
    id: "about",
    eyebrow: "About",
    title: "iClub",
    description: "About us",
    createdAt: new Date(),
    updatedAt: new Date(),
};

const bulletSection = {
    id: 2,
    sortOrder: 1,
    type: "BULLET_LIST" as const,
    title: "What We Do",
    leftLabel: null,
    leftText: null,
    rightLabel: null,
    rightText: null,
    bullets: ["Item one"],
    emptyMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sponsors: [],
};

describe("site content routes", () => {
    beforeEach(() => {
        prismaMocks.sitePageFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
            if (where.id === "about") return aboutPage;
            if (where.id === "contact") {
                return {
                    ...aboutPage,
                    id: "contact",
                    eyebrow: "Contact",
                    title: "Reach out",
                    description: "Contact us",
                };
            }
            return null;
        });
        prismaMocks.aboutSectionFindMany.mockResolvedValue([bulletSection]);
        prismaMocks.contactMethodFindMany.mockResolvedValue([]);
        prismaMocks.socialLinkFindMany.mockResolvedValue([]);
        prismaMocks.aboutSectionAggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("GET /about returns 403 for regular members", async () => {
        const response = await request(buildRouteApp(siteContentRouter, { isOfficer: false, isAdmin: false }))
            .get("/about");

        expect(response.status).toBe(403);
    });

    it("GET /about returns page for officers", async () => {
        const response = await request(buildRouteApp(siteContentRouter, { isOfficer: true }))
            .get("/about");

        expect(response.status).toBe(200);
        expect(response.body.header.title).toBe("iClub");
        expect(response.body.sections).toHaveLength(1);
        expect(response.body.sections[0].type).toBe("BULLET_LIST");
    });

    it("PUT /about/header updates header for administration", async () => {
        prismaMocks.sitePageUpdate.mockResolvedValue({
            ...aboutPage,
            title: "Updated title",
        });

        const response = await request(buildRouteApp(siteContentRouter, { isAdmin: true }))
            .put("/about/header")
            .send({
                eyebrow: "About",
                title: "Updated title",
                description: "About us",
            });

        expect(response.status).toBe(200);
        expect(response.body.header.title).toBe("Updated title");
    });

    it("POST /about/sections creates a bullet list section", async () => {
        prismaMocks.aboutSectionCreate.mockResolvedValue({
            ...bulletSection,
            id: 3,
            title: "New section",
        });
        prismaMocks.aboutSectionFindMany.mockResolvedValue([
            bulletSection,
            { ...bulletSection, id: 3, title: "New section" },
        ]);

        const response = await request(buildRouteApp(siteContentRouter, { isOfficer: true }))
            .post("/about/sections")
            .send({
                type: "BULLET_LIST",
                title: "New section",
                bullets: ["First point"],
            });

        expect(response.status).toBe(201);
        expect(prismaMocks.aboutSectionCreate).toHaveBeenCalled();
    });
});
