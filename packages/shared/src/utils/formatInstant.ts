import { CLUB_TIMEZONE, CLUB_TIMEZONE_LABEL } from "./constants";

function parseInstant(value: string | Date): Date | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

type FormatOptions = {
    timeZone?: string;
    withTimeZoneLabel?: boolean;
};

function resolveFormatOptions(options?: FormatOptions): Intl.DateTimeFormatOptions {
    const base: Intl.DateTimeFormatOptions = options?.timeZone ? { timeZone: options.timeZone } : {};
    return base;
}

export function formatDate(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    const formatted = new Intl.DateTimeFormat("en-US", {
        ...resolveFormatOptions(options),
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
    if (options?.withTimeZoneLabel && options.timeZone) {
        return `${formatted} (${CLUB_TIMEZONE_LABEL})`;
    }
    return formatted;
}

export function formatTime(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    const formatted = new Intl.DateTimeFormat("en-US", {
        ...resolveFormatOptions(options),
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
    if (options?.withTimeZoneLabel && options.timeZone) {
        return `${formatted} (${CLUB_TIMEZONE_LABEL})`;
    }
    return formatted;
}

export function formatDateTime(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    const formatted = new Intl.DateTimeFormat("en-US", {
        ...resolveFormatOptions(options),
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
    if (options?.withTimeZoneLabel && options.timeZone) {
        return `${formatted} (${CLUB_TIMEZONE_LABEL})`;
    }
    return formatted;
}

export function formatDateRange(start: string | Date, end: string | Date, options?: FormatOptions): string {
    const startDate = parseInstant(start);
    const endDate = parseInstant(end);
    if (!startDate || !endDate) return "—";
    if (startDate.toDateString() === endDate.toDateString()) {
        return `${formatDate(startDate, options)} · ${formatTime(startDate, options)} – ${formatTime(endDate, options)}`;
    }
    return `${formatDateTime(startDate, options)} – ${formatDateTime(endDate, options)}`;
}

/** Server/email formatting in club venue timezone with an explicit label. */
export function formatDateTimeInClubTimezone(value: string | Date): string {
    return formatDateTime(value, { timeZone: CLUB_TIMEZONE, withTimeZoneLabel: true });
}

export function formatEventDateRangeInClubTimezone(eventDate: string, eventEndDate: string): string {
    const start = parseInstant(eventDate);
    const end = parseInstant(eventEndDate);
    if (!start || !end) return "—";
    const options = { timeZone: CLUB_TIMEZONE, withTimeZoneLabel: true };
    if (start.toLocaleDateString("en-US", { timeZone: CLUB_TIMEZONE }) === end.toLocaleDateString("en-US", { timeZone: CLUB_TIMEZONE })) {
        return `${formatDate(start, options)} · ${formatTime(start, options)} – ${formatTime(end, options)}`;
    }
    return `${formatDateTime(start, options)} – ${formatDateTime(end, options)}`;
}

export { formatEventDateRange, formatRegistrationDeadline } from "./eventDateTime";
