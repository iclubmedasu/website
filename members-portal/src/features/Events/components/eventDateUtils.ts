import { formatDate, formatEventDateRange, toDateInputValue } from '@iclub/shared/utils';

function toLocalDayString(date: Date): string {
    return toDateInputValue(date);
}

function toDayString(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return toLocalDayString(parsed);
}

export function formatEventDuration(start?: string | null, end?: string | null): string {
    if (!start) return '—';
    const endValue = end ?? start;
    return formatEventDateRange(start, endValue);
}

export function getEventDayRange(
    start?: string | null,
    end?: string | null,
): { startDay: string; endDay: string } | null {
    const startDay = start ? toDayString(start) : null;
    if (!startDay) return null;
    const endDay = end ? toDayString(end) : startDay;
    if (!endDay) return null;
    return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

export function isWithinEventDays(
    start?: string | null,
    end?: string | null,
    referenceDate: Date = new Date(),
): boolean {
    const range = getEventDayRange(start, end);
    if (!range) return false;
    const today = toLocalDayString(referenceDate);
    return today >= range.startDay && today <= range.endDay;
}

export function isMultiDayEvent(start?: string | null, end?: string | null): boolean {
    const range = getEventDayRange(start, end);
    if (!range) return false;
    return range.startDay !== range.endDay;
}

export function formatAttendanceDayLabel(eventDay: string): string {
    const parsed = new Date(`${eventDay.slice(0, 10)}T12:00:00`);
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
    if (!session.startTime || !session.endTime || !session.sessionDate) return false;
    const sessionDay = session.sessionDate.slice(0, 10);
    const today = toLocalDayString(referenceDate);
    if (sessionDay !== today) return false;
    const hhmm = `${String(referenceDate.getHours()).padStart(2, '0')}:${String(referenceDate.getMinutes()).padStart(2, '0')}`;
    return session.startTime <= hhmm && hhmm < session.endTime;
}

export function getActiveSessionsNow<T extends SessionTimeWindowLike>(
    sessions: T[],
    referenceDate: Date = new Date(),
): T[] {
    return sessions.filter((session) => isSessionActiveNow(session, referenceDate));
}
