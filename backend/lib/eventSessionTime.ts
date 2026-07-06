import {
    combineClubLocalDateTime,
    extractClubLocalTime,
    toClubDayString,
} from '@iclub/shared/utils';

export interface EventSessionInstantInput {
    startDateTime?: unknown;
    endDateTime?: unknown;
    sessionDate?: unknown;
    startTime?: unknown;
    endTime?: unknown;
}

export interface ParsedEventSessionTimes {
    startDateTime: Date;
    endDateTime: Date;
    sessionDate: Date;
    startTime: string | null;
    endTime: string | null;
}

function parseIsoInstant(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseLegacySessionTime(value: unknown): string | null {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
    return trimmed;
}

function parseLegacySessionDay(value: unknown): string | null {
    const trimmed = String(value ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    return trimmed;
}

export function parseEventSessionTimes(input: EventSessionInstantInput): ParsedEventSessionTimes | null {
    const startInstant = parseIsoInstant(input.startDateTime);
    const endInstant = parseIsoInstant(input.endDateTime);
    if (startInstant && endInstant) {
        if (endInstant.getTime() < startInstant.getTime()) return null;
        const clubDay = toClubDayString(startInstant);
        const sessionDate = clubDay ? new Date(`${clubDay}T00:00:00.000Z`) : startInstant;
        return {
            startDateTime: startInstant,
            endDateTime: endInstant,
            sessionDate,
            startTime: extractClubLocalTime(startInstant),
            endTime: extractClubLocalTime(endInstant),
        };
    }

    const sessionDay = parseLegacySessionDay(input.sessionDate);
    if (!sessionDay) return null;
    const startTime = parseLegacySessionTime(input.startTime);
    const endTime = parseLegacySessionTime(input.endTime);
    const startIso = combineClubLocalDateTime(sessionDay, startTime ?? '00:00');
    const endIso = combineClubLocalDateTime(sessionDay, endTime ?? startTime ?? '23:59');
    if (!startIso || !endIso) return null;
    const startDateTime = new Date(startIso);
    const endDateTime = new Date(endIso);
    if (endDateTime.getTime() < startDateTime.getTime()) return null;

    return {
        startDateTime,
        endDateTime,
        sessionDate: new Date(`${sessionDay}T00:00:00.000Z`),
        startTime,
        endTime,
    };
}

export function serializeEventSession<T extends {
    sessionDate: Date;
    startTime: string | null;
    endTime: string | null;
    startDateTime: Date | null;
    endDateTime: Date | null;
}>(session: T) {
    const startDateTime = session.startDateTime ?? null;
    const endDateTime = session.endDateTime ?? null;
    return {
        ...session,
        sessionDate: toClubDayString(session.sessionDate) ?? session.sessionDate.toISOString().slice(0, 10),
        startDateTime: startDateTime?.toISOString() ?? null,
        endDateTime: endDateTime?.toISOString() ?? null,
    };
}

export function isSessionActiveAt(
    session: { startDateTime: Date | null; endDateTime: Date | null; isActive?: boolean },
    referenceDate: Date,
): boolean {
    if (session.isActive === false) return false;
    if (!session.startDateTime || !session.endDateTime) return false;
    const now = referenceDate.getTime();
    return session.startDateTime.getTime() <= now && now < session.endDateTime.getTime();
}

export function doSessionInstantsOverlap(
    a: { startDateTime: Date | null; endDateTime: Date | null },
    b: { startDateTime: Date | null; endDateTime: Date | null },
): boolean {
    if (!a.startDateTime || !a.endDateTime || !b.startDateTime || !b.endDateTime) return false;
    return a.startDateTime < b.endDateTime && b.startDateTime < a.endDateTime;
}
