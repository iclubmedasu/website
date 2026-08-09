import { CLUB_TIMEZONE } from "./constants";
import { getTimezoneLabel } from "./eventLocal";

function parseInstant(value: string | Date): Date | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

type FormatOptions = {
    timeZone?: string;
    withTimeZoneLabel?: boolean;
    timeZoneLabel?: string;
};

function resolveLabel(options?: FormatOptions): string | null {
    if (!options?.withTimeZoneLabel || !options.timeZone) return null;
    return options.timeZoneLabel ?? getTimezoneLabel(options.timeZone);
}

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
        const label = resolveLabel(options);
        return label ? `${formatted} (${label})` : formatted;
    }
    return formatted;
}

/** Compact axis label: `01 Jan` style in viewer-local timezone. */
export function formatDateCompact(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-GB", {
        ...resolveFormatOptions(options),
        day: "2-digit",
        month: "short",
    }).format(date);
}

/** Weekday + date for timetables and task pickers. */
export function formatDateWithWeekday(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-US", {
        ...resolveFormatOptions(options),
        weekday: "short",
        month: "short",
        day: "2-digit",
    }).format(date);
}

/** Month + year for Gantt month headers. */
export function formatMonthYear(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-US", {
        ...resolveFormatOptions(options),
        month: "short",
        year: "numeric",
    }).format(date);
}

/** Month abbreviation only for dense chart axes. */
export function formatMonthShort(value: string | Date, options?: FormatOptions): string {
    const date = parseInstant(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-GB", {
        ...resolveFormatOptions(options),
        month: "short",
    }).format(date);
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
        const label = resolveLabel(options);
        return label ? `${formatted} (${label})` : formatted;
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
        const label = resolveLabel(options);
        return label ? `${formatted} (${label})` : formatted;
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

/** Server/email formatting in event venue timezone with an explicit label. */
export function formatEventDateRangeInTimezone(
    eventDate: string,
    eventEndDate: string,
    timeZone: string = CLUB_TIMEZONE,
): string {
    const start = parseInstant(eventDate);
    const end = parseInstant(eventEndDate);
    if (!start || !end) return "—";
    const label = getTimezoneLabel(timeZone);
    const options = { timeZone, withTimeZoneLabel: true, timeZoneLabel: label };
    if (start.toLocaleDateString("en-US", { timeZone }) === end.toLocaleDateString("en-US", { timeZone })) {
        return `${formatDate(start, options)} · ${formatTime(start, options)} – ${formatTime(end, options)}`;
    }
    return `${formatDateTime(start, options)} – ${formatDateTime(end, options)}`;
}

/** @deprecated Use formatEventDateRangeInTimezone */
export function formatEventDateRangeInClubTimezone(eventDate: string, eventEndDate: string): string {
    return formatEventDateRangeInTimezone(eventDate, eventEndDate, CLUB_TIMEZONE);
}

export { formatEventDateRange, formatRegistrationDeadline } from "./eventDateTime";
