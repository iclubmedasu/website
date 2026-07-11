import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
    DEFAULT_ABOUT_PAGE,
    DEFAULT_ABOUT_SECTIONS,
    DEFAULT_CONTACT_METHOD,
    DEFAULT_CONTACT_PAGE,
    DEFAULT_SOCIAL_LINKS,
} from "./siteContentDefaults";

/**
 * Ensures About SitePage (+ default sections when none exist).
 * Safe to call repeatedly; only creates missing data.
 */
export async function ensureAboutPageExists(): Promise<void> {
    const existing = await prisma.sitePage.findUnique({ where: { id: "about" } });
    if (!existing) {
        await prisma.sitePage.create({ data: { ...DEFAULT_ABOUT_PAGE } });
    }

    const sectionCount = await prisma.aboutSection.count();
    if (sectionCount === 0) {
        for (const section of DEFAULT_ABOUT_SECTIONS) {
            if (section.type === "TWO_COLUMN") {
                await prisma.aboutSection.create({
                    data: {
                        sortOrder: section.sortOrder,
                        type: section.type,
                        title: section.title,
                        leftLabel: section.leftLabel,
                        leftText: section.leftText,
                        rightLabel: section.rightLabel,
                        rightText: section.rightText,
                    },
                });
            } else if (section.type === "BULLET_LIST") {
                await prisma.aboutSection.create({
                    data: {
                        sortOrder: section.sortOrder,
                        type: section.type,
                        title: section.title,
                        bullets: section.bullets as Prisma.InputJsonValue,
                    },
                });
            } else {
                await prisma.aboutSection.create({
                    data: {
                        sortOrder: section.sortOrder,
                        type: section.type,
                        title: section.title,
                        emptyMessage: section.emptyMessage,
                    },
                });
            }
        }
    }
}

/**
 * Ensures Contact SitePage (+ default method/social links when none exist).
 * Safe to call repeatedly; only creates missing data.
 */
export async function ensureContactPageExists(): Promise<void> {
    const existing = await prisma.sitePage.findUnique({ where: { id: "contact" } });
    if (!existing) {
        await prisma.sitePage.create({ data: { ...DEFAULT_CONTACT_PAGE } });
    }

    const methodCount = await prisma.contactMethod.count();
    if (methodCount === 0) {
        await prisma.contactMethod.create({ data: { ...DEFAULT_CONTACT_METHOD } });
    }

    const socialCount = await prisma.socialLink.count();
    if (socialCount === 0) {
        await prisma.socialLink.createMany({ data: [...DEFAULT_SOCIAL_LINKS] });
    }
}

/**
 * Seeds About + Contact pages and related defaults when About is missing.
 * Used by `npm run seed:site-content`. No-ops if About SitePage already exists
 * (Contact is still ensured so a partial seed can recover).
 */
export async function seedSiteContentDefaults(): Promise<"created" | "skipped"> {
    const existingAbout = await prisma.sitePage.findUnique({ where: { id: "about" } });
    if (existingAbout) {
        // Recover contact-only gap if about was seeded earlier without contact.
        await ensureContactPageExists();
        return "skipped";
    }

    await ensureAboutPageExists();
    await ensureContactPageExists();
    return "created";
}
