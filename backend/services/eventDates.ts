function toLocalDayString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDayString(value: Date | string): string | null {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return toLocalDayString(value);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return toLocalDayString(parsed);
}

export function getEventDayRange(
    start?: Date | string | null,
    end?: Date | string | null,
): { startDay: string; endDay: string } | null {
    const startDay = start != null ? toDayString(start) : null;
    if (!startDay) return null;
    const endDay = end != null ? toDayString(end) : startDay;
    if (!endDay) return null;
    return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

export function isWithinEventDays(
    start?: Date | string | null,
    end?: Date | string | null,
    referenceDate: Date = new Date(),
): boolean {
    const range = getEventDayRange(start, end);
    if (!range) return false;
    const today = toLocalDayString(referenceDate);
    return today >= range.startDay && today <= range.endDay;
}

export function formatEventDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function parseEventDayString(value: unknown): string | null {
    const trimmed = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatEventDay(parsed) === trimmed ? trimmed : null;
}

export function eventDayStringToDate(day: string): Date {
    return new Date(`${day}T00:00:00.000Z`);
}

export function isEventDayInRange(
    eventDay: string,
    start?: Date | string | null,
    end?: Date | string | null,
): boolean {
    const range = getEventDayRange(start, end);
    if (!range) return false;
    return eventDay >= range.startDay && eventDay <= range.endDay;
}

export function resolveCheckInEventDay(
    start: Date | string,
    end: Date | string,
    options?: { eventDay?: unknown; referenceDate?: Date },
): { eventDay: string; eventDayDate: Date } | null {
    const referenceDate = options?.referenceDate ?? new Date();
    const explicit = options?.eventDay != null && String(options.eventDay).trim() !== ''
        ? parseEventDayString(options.eventDay)
        : null;
    const eventDay = explicit ?? toLocalDayString(referenceDate);
    if (!isEventDayInRange(eventDay, start, end)) return null;
    return { eventDay, eventDayDate: eventDayStringToDate(eventDay) };
}

/** Whether a walk-in should receive a ticket email for use on remaining event days. */
export function shouldSendWalkInTicket(
    start?: Date | string | null,
    end?: Date | string | null,
    referenceDate: Date = new Date(),
): boolean {
    const range = getEventDayRange(start, end);
    if (!range) return false;
    if (range.startDay === range.endDay) return false;

    const today = toLocalDayString(referenceDate);
    if (today < range.startDay || today > range.endDay) return false;
    return today < range.endDay;
}
