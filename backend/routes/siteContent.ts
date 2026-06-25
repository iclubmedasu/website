import express, { Request, Response } from "express";
import { prisma } from "../db";
import { requireSiteContentEditor } from "../middleware/auth";
import {
    getEditorAboutPageData,
    getContactPageData,
    getNextAboutSectionSortOrder,
    getNextContactMethodSortOrder,
    getNextSocialLinkSortOrder,
    getNextSponsorSortOrder,
    reorderRecords,
    validateAboutSectionType,
} from "../lib/siteContent";

const router = express.Router();

router.use(requireSiteContentEditor);

function parseId(value: string): number | null {
    const id = parseInt(value, 10);
    return Number.isNaN(id) ? null : id;
}

function trimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

// ── About page ─────────────────────────────────────────────

router.get("/about", async (_req: Request, res: Response) => {
    try {
        const page = await getEditorAboutPageData();
        if (!page) {
            return res.status(404).json({ error: "About page not found" });
        }
        return res.json(page);
    } catch (error) {
        console.error("GET /site-content/about error:", error);
        return res.status(500).json({ error: "Failed to fetch about page" });
    }
});

router.put("/about/header", async (req: Request, res: Response) => {
    try {
        const eyebrow = trimString(req.body?.eyebrow);
        const title = trimString(req.body?.title);
        const description = trimString(req.body?.description);

        if (!eyebrow || !title || !description) {
            return res.status(400).json({ error: "eyebrow, title, and description are required" });
        }

        const page = await prisma.sitePage.update({
            where: { id: "about" },
            data: { eyebrow, title, description },
        });

        return res.json({
            header: {
                eyebrow: page.eyebrow,
                title: page.title,
                description: page.description,
            },
        });
    } catch (error) {
        console.error("PUT /site-content/about/header error:", error);
        return res.status(500).json({ error: "Failed to update about header" });
    }
});

router.post("/about/sections", async (req: Request, res: Response) => {
    try {
        const type = trimString(req.body?.type);
        const title = trimString(req.body?.title);

        if (!validateAboutSectionType(type)) {
            return res.status(400).json({ error: "Invalid section type" });
        }
        if (!title) {
            return res.status(400).json({ error: "title is required" });
        }

        const sortOrder = await getNextAboutSectionSortOrder();
        const data: Record<string, unknown> = { sortOrder, type, title };

        if (type === "TWO_COLUMN") {
            data.leftLabel = trimString(req.body?.leftLabel) || "Left";
            data.leftText = trimString(req.body?.leftText);
            data.rightLabel = trimString(req.body?.rightLabel) || "Right";
            data.rightText = trimString(req.body?.rightText);
        } else if (type === "BULLET_LIST") {
            data.bullets = Array.isArray(req.body?.bullets)
                ? req.body.bullets.filter((item: unknown) => typeof item === "string" && item.trim())
                : [];
        } else {
            data.emptyMessage = trimString(req.body?.emptyMessage) || null;
        }

        const section = await prisma.aboutSection.create({
            data: data as never,
            include: { sponsors: { orderBy: { sortOrder: "asc" } } },
        });

        const page = await getEditorAboutPageData();
        return res.status(201).json({ section, page });
    } catch (error) {
        console.error("POST /site-content/about/sections error:", error);
        return res.status(500).json({ error: "Failed to create section" });
    }
});

router.put("/about/sections/reorder", async (req: Request, res: Response) => {
    try {
        const orderedIds = req.body?.orderedIds;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" });
        }

        const sections = await prisma.aboutSection.findMany({ select: { id: true } });
        await reorderRecords(sections, orderedIds.map((id: unknown) => Number(id)), (id, sortOrder) =>
            prisma.aboutSection.update({ where: { id }, data: { sortOrder } }),
        );

        const page = await getEditorAboutPageData();
        return res.json(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reorder sections";
        console.error("PUT /site-content/about/sections/reorder error:", error);
        return res.status(400).json({ error: message });
    }
});

router.put("/about/sections/:id", async (req: Request, res: Response) => {
    try {
        const sectionId = parseId(String(req.params.id));
        if (sectionId == null) {
            return res.status(400).json({ error: "Invalid section ID" });
        }

        const existing = await prisma.aboutSection.findUnique({ where: { id: sectionId } });
        if (!existing) {
            return res.status(404).json({ error: "Section not found" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.title !== undefined) data.title = trimString(req.body.title);
        if (existing.type === "TWO_COLUMN") {
            if (req.body?.leftLabel !== undefined) data.leftLabel = trimString(req.body.leftLabel);
            if (req.body?.leftText !== undefined) data.leftText = trimString(req.body.leftText);
            if (req.body?.rightLabel !== undefined) data.rightLabel = trimString(req.body.rightLabel);
            if (req.body?.rightText !== undefined) data.rightText = trimString(req.body.rightText);
        }
        if (existing.type === "BULLET_LIST" && req.body?.bullets !== undefined) {
            data.bullets = Array.isArray(req.body.bullets)
                ? req.body.bullets.filter((item: unknown) => typeof item === "string" && item.trim())
                : [];
        }
        if (existing.type === "SPONSORS" && req.body?.emptyMessage !== undefined) {
            data.emptyMessage = trimString(req.body.emptyMessage) || null;
        }

        await prisma.aboutSection.update({ where: { id: sectionId }, data: data as never });
        const page = await getEditorAboutPageData();
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/about/sections/:id error:", error);
        return res.status(500).json({ error: "Failed to update section" });
    }
});

router.delete("/about/sections/:id", async (req: Request, res: Response) => {
    try {
        const sectionId = parseId(String(req.params.id));
        if (sectionId == null) {
            return res.status(400).json({ error: "Invalid section ID" });
        }

        await prisma.aboutSection.delete({ where: { id: sectionId } });
        const page = await getEditorAboutPageData();
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/about/sections/:id error:", error);
        return res.status(500).json({ error: "Failed to delete section" });
    }
});

router.post("/about/sections/:sectionId/sponsors", async (req: Request, res: Response) => {
    try {
        const sectionId = parseId(String(req.params.sectionId));
        if (sectionId == null) {
            return res.status(400).json({ error: "Invalid section ID" });
        }

        const section = await prisma.aboutSection.findUnique({ where: { id: sectionId } });
        if (!section || section.type !== "SPONSORS") {
            return res.status(404).json({ error: "Sponsors section not found" });
        }

        const name = trimString(req.body?.name);
        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }

        const sortOrder = await getNextSponsorSortOrder(sectionId);
        await prisma.aboutSponsor.create({
            data: {
                sectionId,
                sortOrder,
                name,
                description: trimString(req.body?.description) || null,
                logoUrl: trimString(req.body?.logoUrl) || null,
                websiteUrl: trimString(req.body?.websiteUrl) || null,
            },
        });

        const page = await getEditorAboutPageData();
        return res.status(201).json(page);
    } catch (error) {
        console.error("POST /site-content/about/sections/:sectionId/sponsors error:", error);
        return res.status(500).json({ error: "Failed to create sponsor" });
    }
});

router.put("/about/sections/:sectionId/sponsors/:id", async (req: Request, res: Response) => {
    try {
        const sectionId = parseId(String(req.params.sectionId));
        const sponsorId = parseId(String(req.params.id));
        if (sectionId == null || sponsorId == null) {
            return res.status(400).json({ error: "Invalid ID" });
        }

        const sponsor = await prisma.aboutSponsor.findFirst({ where: { id: sponsorId, sectionId } });
        if (!sponsor) {
            return res.status(404).json({ error: "Sponsor not found" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.name !== undefined) data.name = trimString(req.body.name);
        if (req.body?.description !== undefined) data.description = trimString(req.body.description) || null;
        if (req.body?.logoUrl !== undefined) data.logoUrl = trimString(req.body.logoUrl) || null;
        if (req.body?.websiteUrl !== undefined) data.websiteUrl = trimString(req.body.websiteUrl) || null;

        await prisma.aboutSponsor.update({ where: { id: sponsorId }, data: data as never });
        const page = await getEditorAboutPageData();
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/about/sections/:sectionId/sponsors/:id error:", error);
        return res.status(500).json({ error: "Failed to update sponsor" });
    }
});

router.delete("/about/sections/:sectionId/sponsors/:id", async (req: Request, res: Response) => {
    try {
        const sectionId = parseId(String(req.params.sectionId));
        const sponsorId = parseId(String(req.params.id));
        if (sectionId == null || sponsorId == null) {
            return res.status(400).json({ error: "Invalid ID" });
        }

        const sponsor = await prisma.aboutSponsor.findFirst({ where: { id: sponsorId, sectionId } });
        if (!sponsor) {
            return res.status(404).json({ error: "Sponsor not found" });
        }

        await prisma.aboutSponsor.delete({ where: { id: sponsorId } });
        const page = await getEditorAboutPageData();
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/about/sections/:sectionId/sponsors/:id error:", error);
        return res.status(500).json({ error: "Failed to delete sponsor" });
    }
});

router.put("/about/sections/:sectionId/sponsors/reorder", async (req: Request, res: Response) => {
    try {
        const sectionId = parseId(String(req.params.sectionId));
        if (sectionId == null) {
            return res.status(400).json({ error: "Invalid section ID" });
        }

        const orderedIds = req.body?.orderedIds;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" });
        }

        const sponsors = await prisma.aboutSponsor.findMany({ where: { sectionId }, select: { id: true } });
        await reorderRecords(sponsors, orderedIds.map((id: unknown) => Number(id)), (id, sortOrder) =>
            prisma.aboutSponsor.update({ where: { id }, data: { sortOrder } }),
        );

        const page = await getEditorAboutPageData();
        return res.json(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reorder sponsors";
        console.error("PUT /site-content/about/sections/:sectionId/sponsors/reorder error:", error);
        return res.status(400).json({ error: message });
    }
});

// ── Contact page ───────────────────────────────────────────

router.get("/contact", async (_req: Request, res: Response) => {
    try {
        const page = await getContactPageData({ includeInactive: true });
        if (!page) {
            return res.status(404).json({ error: "Contact page not found" });
        }
        return res.json(page);
    } catch (error) {
        console.error("GET /site-content/contact error:", error);
        return res.status(500).json({ error: "Failed to fetch contact page" });
    }
});

router.put("/contact/header", async (req: Request, res: Response) => {
    try {
        const eyebrow = trimString(req.body?.eyebrow);
        const title = trimString(req.body?.title);
        const description = trimString(req.body?.description);

        if (!eyebrow || !title || !description) {
            return res.status(400).json({ error: "eyebrow, title, and description are required" });
        }

        const page = await prisma.sitePage.update({
            where: { id: "contact" },
            data: { eyebrow, title, description },
        });

        return res.json({
            header: {
                eyebrow: page.eyebrow,
                title: page.title,
                description: page.description,
            },
        });
    } catch (error) {
        console.error("PUT /site-content/contact/header error:", error);
        return res.status(500).json({ error: "Failed to update contact header" });
    }
});

const CONTACT_METHOD_TYPES = new Set(["EMAIL", "PHONE", "ADDRESS", "OTHER"]);
const SOCIAL_PLATFORMS = new Set(["INSTAGRAM", "FACEBOOK", "WHATSAPP", "LINKEDIN", "IHUB", "OTHER"]);

router.post("/contact/methods", async (req: Request, res: Response) => {
    try {
        const type = trimString(req.body?.type).toUpperCase();
        const label = trimString(req.body?.label);
        const value = trimString(req.body?.value);

        if (!CONTACT_METHOD_TYPES.has(type)) {
            return res.status(400).json({ error: "Invalid contact method type" });
        }
        if (!label || !value) {
            return res.status(400).json({ error: "label and value are required" });
        }

        const sortOrder = await getNextContactMethodSortOrder();
        await prisma.contactMethod.create({
            data: {
                sortOrder,
                type: type as never,
                label,
                value,
                isActive: req.body?.isActive !== false,
            },
        });

        const page = await getContactPageData({ includeInactive: true });
        return res.status(201).json(page);
    } catch (error) {
        console.error("POST /site-content/contact/methods error:", error);
        return res.status(500).json({ error: "Failed to create contact method" });
    }
});

router.put("/contact/methods/reorder", async (req: Request, res: Response) => {
    try {
        const orderedIds = req.body?.orderedIds;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" });
        }

        const methods = await prisma.contactMethod.findMany({ select: { id: true } });
        await reorderRecords(methods, orderedIds.map((id: unknown) => Number(id)), (id, sortOrder) =>
            prisma.contactMethod.update({ where: { id }, data: { sortOrder } }),
        );

        const page = await getContactPageData({ includeInactive: true });
        return res.json(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reorder contact methods";
        console.error("PUT /site-content/contact/methods/reorder error:", error);
        return res.status(400).json({ error: message });
    }
});

router.put("/contact/methods/:id", async (req: Request, res: Response) => {
    try {
        const methodId = parseId(String(req.params.id));
        if (methodId == null) {
            return res.status(400).json({ error: "Invalid method ID" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.type !== undefined) {
            const type = trimString(req.body.type).toUpperCase();
            if (!CONTACT_METHOD_TYPES.has(type)) {
                return res.status(400).json({ error: "Invalid contact method type" });
            }
            data.type = type;
        }
        if (req.body?.label !== undefined) data.label = trimString(req.body.label);
        if (req.body?.value !== undefined) data.value = trimString(req.body.value);
        if (req.body?.isActive !== undefined) data.isActive = !!req.body.isActive;

        await prisma.contactMethod.update({ where: { id: methodId }, data: data as never });
        const page = await getContactPageData({ includeInactive: true });
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/contact/methods/:id error:", error);
        return res.status(500).json({ error: "Failed to update contact method" });
    }
});

router.delete("/contact/methods/:id", async (req: Request, res: Response) => {
    try {
        const methodId = parseId(String(req.params.id));
        if (methodId == null) {
            return res.status(400).json({ error: "Invalid method ID" });
        }

        await prisma.contactMethod.delete({ where: { id: methodId } });
        const page = await getContactPageData({ includeInactive: true });
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/contact/methods/:id error:", error);
        return res.status(500).json({ error: "Failed to delete contact method" });
    }
});

router.post("/contact/social-links", async (req: Request, res: Response) => {
    try {
        const platform = trimString(req.body?.platform).toUpperCase();
        const url = trimString(req.body?.url);

        if (!SOCIAL_PLATFORMS.has(platform)) {
            return res.status(400).json({ error: "Invalid social platform" });
        }
        if (!url) {
            return res.status(400).json({ error: "url is required" });
        }

        const sortOrder = await getNextSocialLinkSortOrder();
        await prisma.socialLink.create({
            data: {
                sortOrder,
                platform: platform as never,
                url,
                isActive: req.body?.isActive !== false,
            },
        });

        const page = await getContactPageData({ includeInactive: true });
        return res.status(201).json(page);
    } catch (error) {
        console.error("POST /site-content/contact/social-links error:", error);
        return res.status(500).json({ error: "Failed to create social link" });
    }
});

router.put("/contact/social-links/reorder", async (req: Request, res: Response) => {
    try {
        const orderedIds = req.body?.orderedIds;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" });
        }

        const links = await prisma.socialLink.findMany({ select: { id: true } });
        await reorderRecords(links, orderedIds.map((id: unknown) => Number(id)), (id, sortOrder) =>
            prisma.socialLink.update({ where: { id }, data: { sortOrder } }),
        );

        const page = await getContactPageData({ includeInactive: true });
        return res.json(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reorder social links";
        console.error("PUT /site-content/contact/social-links/reorder error:", error);
        return res.status(400).json({ error: message });
    }
});

router.put("/contact/social-links/:id", async (req: Request, res: Response) => {
    try {
        const linkId = parseId(String(req.params.id));
        if (linkId == null) {
            return res.status(400).json({ error: "Invalid social link ID" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.platform !== undefined) {
            const platform = trimString(req.body.platform).toUpperCase();
            if (!SOCIAL_PLATFORMS.has(platform)) {
                return res.status(400).json({ error: "Invalid social platform" });
            }
            data.platform = platform;
        }
        if (req.body?.url !== undefined) data.url = trimString(req.body.url);
        if (req.body?.isActive !== undefined) data.isActive = !!req.body.isActive;

        await prisma.socialLink.update({ where: { id: linkId }, data: data as never });
        const page = await getContactPageData({ includeInactive: true });
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/contact/social-links/:id error:", error);
        return res.status(500).json({ error: "Failed to update social link" });
    }
});

router.delete("/contact/social-links/:id", async (req: Request, res: Response) => {
    try {
        const linkId = parseId(String(req.params.id));
        if (linkId == null) {
            return res.status(400).json({ error: "Invalid social link ID" });
        }

        await prisma.socialLink.delete({ where: { id: linkId } });
        const page = await getContactPageData({ includeInactive: true });
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/contact/social-links/:id error:", error);
        return res.status(500).json({ error: "Failed to delete social link" });
    }
});

export default router;
