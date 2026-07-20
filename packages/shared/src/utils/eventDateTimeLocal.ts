import { combineEventLocalDateTime, extractEventLocalTime, toEventDayString } from "./eventLocal";
import { isDateTimeLocalValue } from "./datetimeLocal";

/** Format a UTC instant for `<input type="datetime-local">` as event wall-clock. */
export function toEventDateTimeLocalValue(value: string | Date, timeZone: string): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const day = toEventDayString(date, timeZone);
    const time = extractEventLocalTime(date, timeZone);
    if (!day || !time) return "";
    return `${day}T${time}`;
}

/** Convert event wall-clock datetime-local string → UTC ISO for API payloads. */
export function fromEventDateTimeLocalValue(local: string, timeZone: string): string | null {
    const trimmed = local.trim();
    if (!trimmed) return null;
    if (!isDateTimeLocalValue(trimmed)) return null;

    const [day, hhmm] = trimmed.split("T");
    return combineEventLocalDateTime(day, hhmm, timeZone);
}
