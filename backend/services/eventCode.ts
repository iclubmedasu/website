import { randomInt } from 'crypto';
import { prisma } from '../db';

const CONFIRMATION_CODE_LENGTH = 6;
const CONFIRMATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODE_ATTEMPTS = 25;

function generateCandidateCode(length = CONFIRMATION_CODE_LENGTH): string {
    let code = '';
    for (let index = 0; index < length; index += 1) {
        code += CONFIRMATION_ALPHABET[randomInt(CONFIRMATION_ALPHABET.length)];
    }
    return code;
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
