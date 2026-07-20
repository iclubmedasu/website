import { CLUB_TIMEZONE, toEventDayString } from '@iclub/shared/utils';

function eventDayFromInstant(value: Date | string, timeZone: string): string | null {
    return toEventDayString(value, timeZone);
}

function eventDayFromDateOnly(date: Date, timeZone: string): string {
    return toEventDayString(date, timeZone) ?? '';
}

function toDayString(value: Date | string, timeZone: string): string | null {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return eventDayFromDateOnly(value, timeZone);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return eventDayFromInstant(parsed, timeZone);
}

export function getEventDayRange(
    start?: Date | string | null,
    end?: Date | string | null,
    timeZone: string = CLUB_TIMEZONE,
): { startDay: string; endDay: string } | null {
    const startDay = start != null ? toDayString(start, timeZone) : null;
    if (!startDay) return null;
    const endDay = end != null ? toDayString(end, timeZone) : startDay;
    if (!endDay) return null;
    return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

export function isWithinEventDays(
    start?: Date | string | null,
    end?: Date | string | null,
    referenceDate: Date = new Date(),
    timeZone: string = CLUB_TIMEZONE,
): boolean {
    const range = getEventDayRange(start, end, timeZone);
    if (!range) return false;
    const today = eventDayFromInstant(referenceDate, timeZone);
    if (!today) return false;
    return today >= range.startDay && today <= range.endDay;
}

export function formatEventDay(date: Date, timeZone: string = CLUB_TIMEZONE): string {
    return eventDayFromDateOnly(date, timeZone);
}

export function parseEventDayString(value: unknown, timeZone: string = CLUB_TIMEZONE): string | null {
    const trimmed = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatEventDay(parsed, timeZone) === trimmed ? trimmed : null;
}

export function eventDayStringToDate(day: string): Date {
    return new Date(`${day}T00:00:00.000Z`);
}

export function isEventDayInRange(
    eventDay: string,
    start?: Date | string | null,
    end?: Date | string | null,
    timeZone: string = CLUB_TIMEZONE,
): boolean {
    const range = getEventDayRange(start, end, timeZone);
    if (!range) return false;
    return eventDay >= range.startDay && eventDay <= range.endDay;
}

export function resolveCheckInEventDay(
    start: Date | string,
    end: Date | string,
    options?: { eventDay?: unknown; referenceDate?: Date; timeZone?: string },
): { eventDay: string; eventDayDate: Date } | null {
    const timeZone = options?.timeZone ?? CLUB_TIMEZONE;
    const referenceDate = options?.referenceDate ?? new Date();
    const explicit = options?.eventDay != null && String(options.eventDay).trim() !== ''
        ? parseEventDayString(options.eventDay, timeZone)
        : null;
    const eventDay = explicit ?? eventDayFromInstant(referenceDate, timeZone);
    if (!eventDay || !isEventDayInRange(eventDay, start, end, timeZone)) return null;
    return { eventDay, eventDayDate: eventDayStringToDate(eventDay) };
}

/** Whether a walk-in should receive a ticket email for use on remaining event days. */
export function shouldSendWalkInTicket(
    start?: Date | string | null,
    end?: Date | string | null,
    referenceDate: Date = new Date(),
    timeZone: string = CLUB_TIMEZONE,
): boolean {
    const range = getEventDayRange(start, end, timeZone);
    if (!range) return false;
    if (range.startDay === range.endDay) return false;

    const today = eventDayFromInstant(referenceDate, timeZone);
    if (!today) return false;
    if (today < range.startDay || today > range.endDay) return false;
    return today < range.endDay;
}
