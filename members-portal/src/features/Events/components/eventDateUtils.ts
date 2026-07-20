import {
    CLUB_TIMEZONE,
    formatDate,
    formatEventDateRange,
    toEventDayString,
} from '@iclub/shared/utils';

function toDayString(value: string, timeZone: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return toEventDayString(parsed, timeZone);
}

export function formatEventDuration(start?: string | null, end?: string | null): string {
    if (!start) return '—';
    const endValue = end ?? start;
    return formatEventDateRange(start, endValue);
}

export function getEventDayRange(
    start?: string | null,
    end?: string | null,
    eventTimezone: string = CLUB_TIMEZONE,
): { startDay: string; endDay: string } | null {
    const startDay = start ? toDayString(start, eventTimezone) : null;
    if (!startDay) return null;
    const endDay = end ? toDayString(end, eventTimezone) : startDay;
    if (!endDay) return null;
    return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

export function isWithinEventDays(
    start?: string | null,
    end?: string | null,
    referenceDate: Date = new Date(),
    eventTimezone: string = CLUB_TIMEZONE,
): boolean {
    const range = getEventDayRange(start, end, eventTimezone);
    if (!range) return false;
    const today = toEventDayString(referenceDate, eventTimezone);
    if (!today) return false;
    return today >= range.startDay && today <= range.endDay;
}

export function isMultiDayEvent(
    start?: string | null,
    end?: string | null,
    eventTimezone: string = CLUB_TIMEZONE,
): boolean {
    const range = getEventDayRange(start, end, eventTimezone);
    if (!range) return false;
    return range.startDay !== range.endDay;
}

export function formatAttendanceDayLabel(eventDay: string): string {
    const dayKey = eventDay.split('T')[0];
    const parsed = new Date(`${dayKey}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return eventDay;
    return formatDate(parsed);
}

interface SessionTimeWindowLike {
    startDateTime?: string | null;
    endDateTime?: string | null;
    sessionDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    isActive?: boolean;
}

export function isSessionActiveNow(
    session: SessionTimeWindowLike,
    referenceDate: Date = new Date(),
): boolean {
    if (session.isActive === false) return false;
    if (session.startDateTime && session.endDateTime) {
        const start = new Date(session.startDateTime);
        const end = new Date(session.endDateTime);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        const now = referenceDate.getTime();
        return start.getTime() <= now && now < end.getTime();
    }
    return false;
}

export function getActiveSessionsNow<T extends SessionTimeWindowLike>(
    sessions: T[],
    referenceDate: Date = new Date(),
): T[] {
    return sessions.filter((session) => isSessionActiveNow(session, referenceDate));
}
