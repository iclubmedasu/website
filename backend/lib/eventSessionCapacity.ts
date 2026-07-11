import { prisma } from '../db';

export type SessionCapacityFields = {
    id: number;
    maxCapacity: number | null;
};

export type SessionCapacityStats = {
    registeredCount: number;
    spotsRemaining: number | null;
    isFull: boolean;
};

export function parseSessionMaxCapacity(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
    if (raw === undefined) {
        return { ok: true, value: null };
    }
    if (raw === null || raw === '') {
        return { ok: true, value: null };
    }
    const parsed = Number.parseInt(String(raw), 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return { ok: false, error: 'maxCapacity must be a positive integer or empty for unlimited' };
    }
    return { ok: true, value: parsed };
}

export async function countActiveSessionRegistrations(sessionId: number): Promise<number> {
    return prisma.eventRegistrationSession.count({
        where: {
            sessionId,
            registration: { status: { not: 'CANCELLED' } },
        },
    });
}

export async function countActiveSessionRegistrationsForSessions(
    sessionIds: number[],
): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    for (const id of sessionIds) {
        counts.set(id, 0);
    }
    if (sessionIds.length === 0) return counts;

    const rows = await prisma.eventRegistrationSession.groupBy({
        by: ['sessionId'],
        where: {
            sessionId: { in: sessionIds },
            registration: { status: { not: 'CANCELLED' } },
        },
        _count: { _all: true },
    });

    for (const row of rows) {
        counts.set(row.sessionId, row._count._all);
    }
    return counts;
}

export function buildSessionCapacityStats(
    maxCapacity: number | null | undefined,
    registeredCount: number,
): SessionCapacityStats {
    if (maxCapacity == null) {
        return {
            registeredCount,
            spotsRemaining: null,
            isFull: false,
        };
    }
    const spotsRemaining = Math.max(0, maxCapacity - registeredCount);
    return {
        registeredCount,
        spotsRemaining,
        isFull: registeredCount >= maxCapacity,
    };
}

export function withSessionCapacityFields<T extends { id: number; maxCapacity?: number | null }>(
    session: T,
    registeredCount: number,
) {
    const stats = buildSessionCapacityStats(session.maxCapacity ?? null, registeredCount);
    return {
        ...session,
        maxCapacity: session.maxCapacity ?? null,
        registeredCount: stats.registeredCount,
        spotsRemaining: stats.spotsRemaining,
        isFull: stats.isFull,
    };
}

/**
 * Validate newly added session IDs against capacity.
 * `alreadySelectedIds` are sessions the registrant already has (allowed even if full).
 */
export async function assertSessionsHaveCapacityForNewSelections(
    sessionIds: number[],
    alreadySelectedIds: number[] = [],
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
    if (sessionIds.length === 0) return { ok: true };

    const already = new Set(alreadySelectedIds);
    const newlyRequested = sessionIds.filter((id) => !already.has(id));
    if (newlyRequested.length === 0) return { ok: true };

    const sessions = await prisma.eventSession.findMany({
        where: { id: { in: newlyRequested }, isActive: true },
        select: { id: true, label: true, maxCapacity: true },
    });

    if (sessions.length !== newlyRequested.length) {
        return { ok: false, error: 'One or more selected sessions are invalid', status: 400 };
    }

    const counts = await countActiveSessionRegistrationsForSessions(newlyRequested);
    for (const session of sessions) {
        if (session.maxCapacity == null) continue;
        const count = counts.get(session.id) ?? 0;
        if (count >= session.maxCapacity) {
            const title = session.label?.trim() || 'Untitled session';
            return {
                ok: false,
                error: `Session "${title}" is full`,
                status: 409,
            };
        }
    }

    return { ok: true };
}

export type TicketSessionSplitInput = {
    id: number;
    maxCapacity: number | null;
    isActive?: boolean;
};

export function splitSessionsForTicket<T extends TicketSessionSplitInput>(
    allActiveSessions: T[],
    selectedSessionIds: Iterable<number>,
): { waitingForYou: T[]; dontMissOut: T[] } {
    const selected = new Set(selectedSessionIds);
    const waitingForYou = allActiveSessions.filter((session) => selected.has(session.id));
    const dontMissOut = allActiveSessions.filter(
        (session) => !selected.has(session.id) && session.maxCapacity == null,
    );
    return { waitingForYou, dontMissOut };
}
