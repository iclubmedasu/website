import { CLUB_TIMEZONE } from "./constants";
import { getTimezoneLabel } from "./eventLocal";
import { formatDate, formatDateTime, formatTime } from "./formatInstant";

function parseInstant(value: string | Date): Date | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

/** Format a session window for display in the viewer's local timezone. */
export function formatSessionRange(startDateTime: string | Date, endDateTime: string | Date): string {
    const start = parseInstant(startDateTime);
    const end = parseInstant(endDateTime);
    if (!start || !end) return "—";
    if (start.toDateString() === end.toDateString()) {
        return `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)}`;
    }
    return `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

/** Server/email formatting in event venue timezone with an explicit label. */
export function formatSessionRangeInTimezone(
    startDateTime: string | Date,
    endDateTime: string | Date,
    timeZone: string = CLUB_TIMEZONE,
): string {
    const label = getTimezoneLabel(timeZone);
    const options = { timeZone };
    const start = parseInstant(startDateTime);
    const end = parseInstant(endDateTime);
    if (!start || !end) return "—";
    if (start.toLocaleDateString("en-US", { timeZone }) === end.toLocaleDateString("en-US", { timeZone })) {
        return `${formatDate(start, options)} · ${formatTime(start, options)}–${formatTime(end, options)} (${label})`;
    }
    return `${formatDateTime(start, { ...options, withTimeZoneLabel: true, timeZoneLabel: label })} – ${formatDateTime(end, { ...options, withTimeZoneLabel: true, timeZoneLabel: label })}`;
}

/** @deprecated Use formatSessionRangeInTimezone */
export function formatSessionRangeInClubTimezone(
    startDateTime: string | Date,
    endDateTime: string | Date,
): string {
    return formatSessionRangeInTimezone(startDateTime, endDateTime, CLUB_TIMEZONE);
}
