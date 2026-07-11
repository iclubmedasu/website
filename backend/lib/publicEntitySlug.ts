import { prisma } from '../db';

export const PUBLIC_SLUG_PATTERN = /^[a-z0-9]{12}$/i;
export const NUMERIC_ID_PATTERN = /^\d+$/;

export type PublicEntityRef = {
    id: number;
    slug: string;
};

function isNumericIdParam(value: string): boolean {
    return NUMERIC_ID_PATTERN.test(value);
}

export function isPublicSlugParam(value: string): boolean {
    return PUBLIC_SLUG_PATTERN.test(value);
}

/**
 * Resolve an event by numeric id or 12-char public slug.
 * Returns null when the param format is invalid or no row exists.
 */
export async function resolveEventByIdOrSlug(idOrSlug: string): Promise<PublicEntityRef | null> {
    const trimmed = String(idOrSlug || '').trim();
    if (!trimmed) return null;

    if (isNumericIdParam(trimmed)) {
        const id = Number.parseInt(trimmed, 10);
        if (!Number.isInteger(id) || id <= 0) return null;
        const event = await prisma.event.findUnique({
            where: { id },
            select: { id: true, slug: true },
        });
        return event;
    }

    if (!isPublicSlugParam(trimmed)) {
        return null;
    }

    const event = await prisma.event.findUnique({
        where: { slug: trimmed.toLowerCase() },
        select: { id: true, slug: true },
    });
    return event;
}

/**
 * Resolve a project by numeric id or 12-char public slug.
 */
export async function resolveProjectByIdOrSlug(idOrSlug: string): Promise<PublicEntityRef | null> {
    const trimmed = String(idOrSlug || '').trim();
    if (!trimmed) return null;

    if (isNumericIdParam(trimmed)) {
        const id = Number.parseInt(trimmed, 10);
        if (!Number.isInteger(id) || id <= 0) return null;
        const project = await prisma.project.findUnique({
            where: { id },
            select: { id: true, slug: true },
        });
        return project;
    }

    if (!isPublicSlugParam(trimmed)) {
        return null;
    }

    const project = await prisma.project.findUnique({
        where: { slug: trimmed.toLowerCase() },
        select: { id: true, slug: true },
    });
    return project;
}
