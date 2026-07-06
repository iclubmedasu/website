import { CLUB_TIMEZONE, CLUB_TIMEZONE_LABEL } from "./constants";
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

/** Server/email formatting in club venue timezone with an explicit label. */
export function formatSessionRangeInClubTimezone(
    startDateTime: string | Date,
    endDateTime: string | Date,
): string {
    const options = { timeZone: CLUB_TIMEZONE };
    const start = parseInstant(startDateTime);
    const end = parseInstant(endDateTime);
    if (!start || !end) return "—";
    if (start.toLocaleDateString("en-US", { timeZone: CLUB_TIMEZONE })
        === end.toLocaleDateString("en-US", { timeZone: CLUB_TIMEZONE })) {
        return `${formatDate(start, options)} · ${formatTime(start, options)}–${formatTime(end, options)} (${CLUB_TIMEZONE_LABEL})`;
    }
    return `${formatDateTime(start, { ...options, withTimeZoneLabel: true })} – ${formatDateTime(end, { ...options, withTimeZoneLabel: true })}`;
}
