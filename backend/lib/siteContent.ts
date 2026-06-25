import type {
    AboutSectionType,
    EditorAboutPage,
    EditorAboutSection,
    EditorContactPage,
    PublicAboutPage,
    PublicAboutSection,
    PublicAboutSponsor,
    PublicContactPage,
    PublicSocialLink,
    SitePageHeader,
} from "@iclub/shared";
import type { AboutSection, AboutSponsor, SitePage } from "@prisma/client";
import { prisma } from "../db";

type AboutSectionWithSponsors = AboutSection & { sponsors: AboutSponsor[] };

function toHeader(page: SitePage): SitePageHeader {
    return {
        eyebrow: page.eyebrow,
        title: page.title,
        description: page.description,
    };
}

function parseBullets(bullets: unknown): string[] {
    if (!Array.isArray(bullets)) return [];
    return bullets.filter((item): item is string => typeof item === "string");
}

function toSponsor(sponsor: AboutSponsor): PublicAboutSponsor {
    return {
        id: sponsor.id,
        name: sponsor.name,
        description: sponsor.description,
        logoUrl: sponsor.logoUrl,
        websiteUrl: sponsor.websiteUrl,
        sortOrder: sponsor.sortOrder,
    };
}

export function toPublicAboutSection(section: AboutSectionWithSponsors): PublicAboutSection {
    const base = {
        id: section.id,
        sortOrder: section.sortOrder,
        title: section.title,
    };

    if (section.type === "TWO_COLUMN") {
        return {
            ...base,
            type: "TWO_COLUMN",
            leftLabel: section.leftLabel ?? "Left",
            leftText: section.leftText ?? "",
            rightLabel: section.rightLabel ?? "Right",
            rightText: section.rightText ?? "",
        };
    }

    if (section.type === "BULLET_LIST") {
        return {
            ...base,
            type: "BULLET_LIST",
            bullets: parseBullets(section.bullets),
        };
    }

    return {
        ...base,
        type: "SPONSORS",
        emptyMessage: section.emptyMessage,
        sponsors: section.sponsors
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(toSponsor),
    };
}

export function toEditorAboutSection(section: AboutSectionWithSponsors): EditorAboutSection {
    return toPublicAboutSection(section);
}

export async function getAboutPageData(): Promise<PublicAboutPage | null> {
    const page = await prisma.sitePage.findUnique({ where: { id: "about" } });
    if (!page) return null;

    const sections = await prisma.aboutSection.findMany({
        orderBy: { sortOrder: "asc" },
        include: { sponsors: { orderBy: { sortOrder: "asc" } } },
    });

    return {
        header: toHeader(page),
        sections: sections.map(toPublicAboutSection),
    };
}

export async function getEditorAboutPageData(): Promise<EditorAboutPage | null> {
    const page = await prisma.sitePage.findUnique({ where: { id: "about" } });
    if (!page) return null;

    const sections = await prisma.aboutSection.findMany({
        orderBy: { sortOrder: "asc" },
        include: { sponsors: { orderBy: { sortOrder: "asc" } } },
    });

    return {
        header: toHeader(page),
        sections: sections.map(toEditorAboutSection),
    };
}

export async function getContactPageData(
    options: { includeInactive?: boolean } = {},
): Promise<PublicContactPage | EditorContactPage | null> {
    const page = await prisma.sitePage.findUnique({ where: { id: "contact" } });
    if (!page) return null;

    const methodWhere = options.includeInactive ? {} : { isActive: true };
    const socialWhere = options.includeInactive ? {} : { isActive: true };

    const [methods, socialLinks] = await Promise.all([
        prisma.contactMethod.findMany({
            where: methodWhere,
            orderBy: { sortOrder: "asc" },
        }),
        prisma.socialLink.findMany({
            where: socialWhere,
            orderBy: { sortOrder: "asc" },
        }),
    ]);

    const payload = {
        header: toHeader(page),
        methods: methods.map((method) => ({
            id: method.id,
            type: method.type,
            label: method.label,
            value: method.value,
            sortOrder: method.sortOrder,
            ...(options.includeInactive ? { isActive: method.isActive } : {}),
        })),
        socialLinks: socialLinks.map((link) => ({
            id: link.id,
            platform: link.platform,
            url: link.url,
            sortOrder: link.sortOrder,
            ...(options.includeInactive ? { isActive: link.isActive } : {}),
        })),
    };

    return payload as PublicContactPage | EditorContactPage;
}

export async function getActiveSocialLinks(): Promise<PublicSocialLink[]> {
    const links = await prisma.socialLink.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
    });

    return links.map((link) => ({
        id: link.id,
        platform: link.platform,
        url: link.url,
        sortOrder: link.sortOrder,
    }));
}

export async function getNextAboutSectionSortOrder(): Promise<number> {
    const result = await prisma.aboutSection.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
}

export async function getNextContactMethodSortOrder(): Promise<number> {
    const result = await prisma.contactMethod.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
}

export async function getNextSocialLinkSortOrder(): Promise<number> {
    const result = await prisma.socialLink.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
}

export async function getNextSponsorSortOrder(sectionId: number): Promise<number> {
    const result = await prisma.aboutSponsor.aggregate({
        where: { sectionId },
        _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
}

export function validateAboutSectionType(type: string): type is AboutSectionType {
    return type === "TWO_COLUMN" || type === "BULLET_LIST" || type === "SPONSORS";
}

export async function reorderRecords<T extends { id: number }>(
    records: T[],
    orderedIds: number[],
    updateSortOrder: (id: number, sortOrder: number) => Promise<unknown>,
): Promise<void> {
    const recordIds = new Set(records.map((record) => record.id));
    if (orderedIds.length !== records.length) {
        throw new Error("orderedIds must include every record");
    }
    for (const id of orderedIds) {
        if (!recordIds.has(id)) {
            throw new Error("orderedIds contains unknown id");
        }
    }

    await Promise.all(orderedIds.map((id, index) => updateSortOrder(id, index)));
}
