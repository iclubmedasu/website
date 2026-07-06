import { randomBytes } from 'crypto';
import { prisma } from '../db';

export function generateOnlineAccessToken(): string {
    return randomBytes(24).toString('hex');
}

function isOnlineSessionMode(mode: string): boolean {
    return mode !== 'ONSITE';
}

export async function ensureSessionToken(
    sessionId: number,
    registrationId: number,
): Promise<string> {
    const existing = await prisma.eventSessionToken.findUnique({
        where: {
            sessionId_registrationId: { sessionId, registrationId },
        },
        select: { token: true },
    });

    if (existing) {
        return existing.token;
    }

    const token = generateOnlineAccessToken();
    await prisma.eventSessionToken.create({
        data: { sessionId, registrationId, token },
    });
    return token;
}

export async function generateTokensForSession(sessionId: number): Promise<number> {
    const session = await prisma.eventSession.findUnique({
        where: { id: sessionId },
        select: { id: true, eventId: true, mode: true, isActive: true },
    });

    if (!session || !session.isActive || !isOnlineSessionMode(session.mode)) {
        return 0;
    }

    const registrations = await prisma.eventRegistration.findMany({
        where: { eventId: session.eventId, status: { not: 'CANCELLED' } },
        select: { id: true },
    });

    let generated = 0;
    for (const reg of registrations) {
        const existing = await prisma.eventSessionToken.findUnique({
            where: {
                sessionId_registrationId: { sessionId, registrationId: reg.id },
            },
            select: { id: true },
        });
        if (!existing) {
            await ensureSessionToken(sessionId, reg.id);
            generated += 1;
        }
    }

    return generated;
}

export async function generateTokensForRegistration(registrationId: number): Promise<number> {
    const registration = await prisma.eventRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true, eventId: true, status: true },
    });

    if (!registration || registration.status === 'CANCELLED') {
        return 0;
    }

    const sessions = await prisma.eventSession.findMany({
        where: {
            eventId: registration.eventId,
            isActive: true,
            mode: { not: 'ONSITE' },
        },
        select: { id: true },
    });

    let generated = 0;
    for (const session of sessions) {
        const existing = await prisma.eventSessionToken.findUnique({
            where: {
                sessionId_registrationId: {
                    sessionId: session.id,
                    registrationId: registration.id,
                },
            },
            select: { id: true },
        });
        if (!existing) {
            await ensureSessionToken(session.id, registration.id);
            generated += 1;
        }
    }

    return generated;
}

export async function getSessionTokensForRegistration(
    registrationId: number,
): Promise<Map<number, string>> {
    const tokens = await prisma.eventSessionToken.findMany({
        where: { registrationId },
        select: { sessionId: true, token: true },
    });

    return new Map(tokens.map((row) => [row.sessionId, row.token]));
}

/** @deprecated Use generateTokensForSession / generateTokensForRegistration instead */
export async function generateTokensForAllEventRegistrations(
    eventId: number,
): Promise<number> {
    const sessions = await prisma.eventSession.findMany({
        where: { eventId, isActive: true, mode: { not: 'ONSITE' } },
        select: { id: true },
    });

    let total = 0;
    for (const session of sessions) {
        total += await generateTokensForSession(session.id);
    }
    return total;
}

/** @deprecated Use ensureSessionToken instead */
export async function ensureRegistrationHasToken(
    registrationId: number,
): Promise<string> {
    const sessions = await prisma.eventSession.findMany({
        where: {
            event: {
                registrations: { some: { id: registrationId } },
            },
            isActive: true,
            mode: { not: 'ONSITE' },
        },
        orderBy: [{ startDateTime: 'asc' }, { sessionDate: 'asc' }, { order: 'asc' }],
        take: 1,
        select: { id: true },
    });

    if (sessions.length === 0) {
        throw new Error('No online sessions found for registration');
    }

    return ensureSessionToken(sessions[0].id, registrationId);
}
