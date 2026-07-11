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

/** Tokens for registrants who selected this ONLINE session. */
export async function generateTokensForSession(sessionId: number): Promise<number> {
    const session = await prisma.eventSession.findUnique({
        where: { id: sessionId },
        select: { id: true, eventId: true, mode: true, isActive: true },
    });

    if (!session || !session.isActive || !isOnlineSessionMode(session.mode)) {
        return 0;
    }

    const selections = await prisma.eventRegistrationSession.findMany({
        where: {
            sessionId,
            registration: {
                eventId: session.eventId,
                status: { not: 'CANCELLED' },
            },
        },
        select: { registrationId: true },
    });

    let generated = 0;
    for (const row of selections) {
        const existing = await prisma.eventSessionToken.findUnique({
            where: {
                sessionId_registrationId: {
                    sessionId,
                    registrationId: row.registrationId,
                },
            },
            select: { id: true },
        });
        if (!existing) {
            await ensureSessionToken(sessionId, row.registrationId);
            generated += 1;
        }
    }

    return generated;
}

/** Tokens only for ONLINE sessions this registration selected. */
export async function generateTokensForRegistration(registrationId: number): Promise<number> {
    const registration = await prisma.eventRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true, eventId: true, status: true },
    });

    if (!registration || registration.status === 'CANCELLED') {
        return 0;
    }

    const selections = await prisma.eventRegistrationSession.findMany({
        where: { registrationId },
        select: {
            sessionId: true,
            session: { select: { id: true, mode: true, isActive: true } },
        },
    });

    const onlineSelectedIds = selections
        .filter((row) => row.session.isActive && isOnlineSessionMode(row.session.mode))
        .map((row) => row.sessionId);

    // Drop tokens for sessions the registrant no longer has selected
    await prisma.eventSessionToken.deleteMany({
        where: {
            registrationId,
            ...(onlineSelectedIds.length > 0
                ? { sessionId: { notIn: onlineSelectedIds } }
                : {}),
        },
    });

    let generated = 0;
    for (const sessionId of onlineSelectedIds) {
        const existing = await prisma.eventSessionToken.findUnique({
            where: {
                sessionId_registrationId: {
                    sessionId,
                    registrationId: registration.id,
                },
            },
            select: { id: true },
        });
        if (!existing) {
            await ensureSessionToken(sessionId, registration.id);
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

    let generated = 0;
    for (const session of sessions) {
        generated += await generateTokensForSession(session.id);
    }
    return generated;
}
