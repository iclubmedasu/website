import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';

function toLocalDayString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const startDay = start.slice(0, 10);
    const endDay = end?.slice(0, 10);
    if (!end || !endDay || startDay === endDay) return fmtDate(start) || '—';
    return `${fmtDate(start) || '—'} – ${fmtDate(end) || '—'}`;
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
    const parsed = new Date(`${eventDay}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return eventDay;
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toLocalTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

interface SessionTimeWindowLike {
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    isActive?: boolean;
}

export function isSessionActiveNow(
    session: SessionTimeWindowLike,
    referenceDate: Date = new Date(),
): boolean {
    if (session.isActive === false) return false;
    if (!session.startTime || !session.endTime) return false;
    const sessionDay = session.sessionDate.slice(0, 10);
    const today = toLocalDayString(referenceDate);
    if (sessionDay !== today) return false;
    const hhmm = toLocalTimeString(referenceDate);
    return session.startTime <= hhmm && hhmm < session.endTime;
}

export function getActiveSessionsNow<T extends SessionTimeWindowLike>(
    sessions: T[],
    referenceDate: Date = new Date(),
): T[] {
    return sessions.filter((session) => isSessionActiveNow(session, referenceDate));
}
