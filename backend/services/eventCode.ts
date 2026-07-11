import { randomInt } from 'crypto';
import { prisma } from '../db';

const CONFIRMATION_CODE_LENGTH = 6;
const CONFIRMATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODE_ATTEMPTS = 25;

export const PUBLIC_SLUG_LENGTH = 12;
/** Ambiguous-character-safe alphabet (lowercase for cleaner public URLs). */
export const PUBLIC_SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const MAX_SLUG_ATTEMPTS = 40;

function generateCandidateCode(length = CONFIRMATION_CODE_LENGTH): string {
    let code = '';
    for (let index = 0; index < length; index += 1) {
        code += CONFIRMATION_ALPHABET[randomInt(CONFIRMATION_ALPHABET.length)];
    }
    return code;
}

export function generateCandidatePublicSlug(length = PUBLIC_SLUG_LENGTH): string {
    let slug = '';
    for (let index = 0; index < length; index += 1) {
        slug += PUBLIC_SLUG_ALPHABET[randomInt(PUBLIC_SLUG_ALPHABET.length)];
    }
    return slug;
}

export async function generateUniqueConfirmationCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const candidate = generateCandidateCode();
        const existing = await prisma.eventRegistration.findFirst({
            where: { confirmationCode: candidate },
            select: { id: true },
        });

        if (!existing) {
            return candidate;
        }
    }

    throw new Error('Unable to generate a unique confirmation code');
}

export async function generateUniqueEventSlug(): Promise<string> {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
        const candidate = generateCandidatePublicSlug();
        const existing = await prisma.event.findFirst({
            where: { slug: candidate },
            select: { id: true },
        });
        if (!existing) {
            return candidate;
        }
    }
    throw new Error('Unable to generate a unique event slug');
}

export async function generateUniqueProjectSlug(): Promise<string> {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
        const candidate = generateCandidatePublicSlug();
        const existing = await prisma.project.findFirst({
            where: { slug: candidate },
            select: { id: true },
        });
        if (!existing) {
            return candidate;
        }
    }
    throw new Error('Unable to generate a unique project slug');
}
