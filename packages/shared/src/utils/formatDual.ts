import {
    formatEventDateRangeInTimezone,
} from "./formatInstant";
import { formatEventDateRange } from "./eventDateTime";
import { formatSessionRange, formatSessionRangeInTimezone } from "./formatSession";

function shouldShowDualViewer(startIso: string, endIso: string, eventTimezone: string): boolean {
    return formatEventDateRange(startIso, endIso, eventTimezone)
        !== formatEventDateRange(startIso, endIso);
}

/** Venue time (labeled) + viewer-local equivalent for public registration pages. */
export function formatEventDateRangeDual(
    eventDate: string,
    eventEndDate: string,
    eventTimezone: string,
): string {
    const venue = formatEventDateRangeInTimezone(eventDate, eventEndDate, eventTimezone);
    if (!shouldShowDualViewer(eventDate, eventEndDate, eventTimezone)) {
        return venue;
    }
    const viewer = formatEventDateRange(eventDate, eventEndDate);
    return `${venue} · ${viewer} your time`;
}

/** Venue session window + viewer-local equivalent. */
export function formatSessionRangeDual(
    startDateTime: string | Date,
    endDateTime: string | Date,
    eventTimezone: string,
): string {
    const startIso = startDateTime instanceof Date ? startDateTime.toISOString() : startDateTime;
    const endIso = endDateTime instanceof Date ? endDateTime.toISOString() : endDateTime;
    const venue = formatSessionRangeInTimezone(startDateTime, endDateTime, eventTimezone);
    if (!shouldShowDualViewer(startIso, endIso, eventTimezone)) {
        return venue;
    }
    const viewer = formatSessionRange(startDateTime, endDateTime);
    return `${venue} · ${viewer} your time`;
}
