import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    sitePageFindUnique: vi.fn(),
    sitePageCreate: vi.fn(),
    sitePageUpdate: vi.fn(),
    aboutSectionFindMany: vi.fn(),
    aboutSectionFindUnique: vi.fn(),
    aboutSectionCreate: vi.fn(),
    aboutSectionUpdate: vi.fn(),
    aboutSectionDelete: vi.fn(),
    aboutSectionAggregate: vi.fn(),
    aboutSectionCount: vi.fn(),
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
    contactMethodCount: vi.fn(),
    socialLinkFindMany: vi.fn(),
    socialLinkCreate: vi.fn(),
    socialLinkCreateMany: vi.fn(),
    socialLinkUpdate: vi.fn(),
    socialLinkDelete: vi.fn(),
    socialLinkAggregate: vi.fn(),
    socialLinkCount: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        sitePage: {
            findUnique: prismaMocks.sitePageFindUnique,
            create: prismaMocks.sitePageCreate,
            update: prismaMocks.sitePageUpdate,
        },
        aboutSection: {
            findMany: prismaMocks.aboutSectionFindMany,
            findUnique: prismaMocks.aboutSectionFindUnique,
            create: prismaMocks.aboutSectionCreate,
            update: prismaMocks.aboutSectionUpdate,
            delete: prismaMocks.aboutSectionDelete,
            aggregate: prismaMocks.aboutSectionAggregate,
            count: prismaMocks.aboutSectionCount,
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
            count: prismaMocks.contactMethodCount,
        },
        socialLink: {
            findMany: prismaMocks.socialLinkFindMany,
            create: prismaMocks.socialLinkCreate,
            createMany: prismaMocks.socialLinkCreateMany,
            update: prismaMocks.socialLinkUpdate,
            delete: prismaMocks.socialLinkDelete,
            aggregate: prismaMocks.socialLinkAggregate,
            count: prismaMocks.socialLinkCount,
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
        prismaMocks.aboutSectionCount.mockResolvedValue(1);
        prismaMocks.contactMethodFindMany.mockResolvedValue([]);
        prismaMocks.contactMethodCount.mockResolvedValue(0);
        prismaMocks.socialLinkFindMany.mockResolvedValue([]);
        prismaMocks.socialLinkCount.mockResolvedValue(0);
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

    it("GET /about creates SitePage about when missing and returns 200", async () => {
        const createdAbout = {
            id: "about",
            eyebrow: "About",
            title: "iClub, MED-ASU",
            description: "iClub, MED-ASU connects medical students through events, projects, and community initiatives at the Faculty of Medicine, Ain Shams University.",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        let aboutExists = false;
        prismaMocks.sitePageFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
            if (where.id === "about") return aboutExists ? createdAbout : null;
            return null;
        });
        prismaMocks.sitePageCreate.mockImplementation(async ({ data }: { data: typeof createdAbout }) => {
            aboutExists = true;
            return { ...createdAbout, ...data };
        });
        prismaMocks.aboutSectionCount.mockResolvedValue(0);
        prismaMocks.aboutSectionCreate.mockResolvedValue({ id: 1 });
        prismaMocks.aboutSectionFindMany.mockResolvedValue([
            {
                id: 1,
                sortOrder: 0,
                type: "TWO_COLUMN",
                title: "Mission & Vision",
                leftLabel: "Mission",
                leftText: "Mission text",
                rightLabel: "Vision",
                rightText: "Vision text",
                bullets: null,
                emptyMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                sponsors: [],
            },
        ]);

        const response = await request(buildRouteApp(siteContentRouter, { isOfficer: true }))
            .get("/about");

        expect(response.status).toBe(200);
        expect(prismaMocks.sitePageCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ id: "about" }) }),
        );
        expect(prismaMocks.aboutSectionCreate).toHaveBeenCalled();
        expect(response.body.header.eyebrow).toBe("About");
        expect(response.body.sections.length).toBeGreaterThan(0);
    });

    it("GET /contact creates SitePage contact when missing and returns 200", async () => {
        const createdContact = {
            id: "contact",
            eyebrow: "Contact",
            title: "We would love to hear from you",
            description: "Reach out with questions about events, partnerships, or getting involved with iClub.",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        let contactExists = false;
        prismaMocks.sitePageFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
            if (where.id === "contact") return contactExists ? createdContact : null;
            return null;
        });
        prismaMocks.sitePageCreate.mockImplementation(async ({ data }: { data: typeof createdContact }) => {
            contactExists = true;
            return { ...createdContact, ...data };
        });
        prismaMocks.contactMethodCount.mockResolvedValue(0);
        prismaMocks.socialLinkCount.mockResolvedValue(0);
        prismaMocks.contactMethodCreate.mockResolvedValue({
            id: 1,
            sortOrder: 0,
            type: "EMAIL",
            label: "Email",
            value: "asu.medicine.iclub@gmail.com",
            isActive: true,
        });
        prismaMocks.socialLinkCreateMany.mockResolvedValue({ count: 5 });
        prismaMocks.contactMethodFindMany.mockResolvedValue([
            {
                id: 1,
                sortOrder: 0,
                type: "EMAIL",
                label: "Email",
                value: "asu.medicine.iclub@gmail.com",
                isActive: true,
            },
        ]);
        prismaMocks.socialLinkFindMany.mockResolvedValue([]);

        const response = await request(buildRouteApp(siteContentRouter, { isOfficer: true }))
            .get("/contact");

        expect(response.status).toBe(200);
        expect(prismaMocks.sitePageCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ id: "contact" }) }),
        );
        expect(response.body.header.eyebrow).toBe("Contact");
        expect(response.body.methods).toHaveLength(1);
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
