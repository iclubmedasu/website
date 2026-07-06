import { CLUB_TIMEZONE } from "./constants";

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function getTimeZoneOffsetMs(timeZone: string, instant: Date): number {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(instant);
    const values = Object.fromEntries(
        parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
    );
    const asUtc = Date.UTC(
        Number.parseInt(values.year, 10),
        Number.parseInt(values.month, 10) - 1,
        Number.parseInt(values.day, 10),
        Number.parseInt(values.hour, 10),
        Number.parseInt(values.minute, 10),
        Number.parseInt(values.second, 10),
    );
    return asUtc - instant.getTime();
}

/** Extract YYYY-MM-DD calendar day from a Date in the club timezone. */
export function toClubDayString(value: string | Date): string | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: CLUB_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
}

/** Combine club calendar day + HH:mm wall-clock into a UTC ISO instant. */
export function combineClubLocalDateTime(day: string, hhmm: string): string | null {
    const trimmedDay = day.trim().slice(0, 10);
    const trimmedTime = hhmm.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDay)) return null;
    if (!/^\d{2}:\d{2}$/.test(trimmedTime)) return null;

    const [year, month, dayOfMonth] = trimmedDay.split("-").map((part) => Number.parseInt(part, 10));
    const [hour, minute] = trimmedTime.split(":").map((part) => Number.parseInt(part, 10));
    const utcGuess = new Date(Date.UTC(year, month - 1, dayOfMonth, hour, minute, 0));
    const offset = getTimeZoneOffsetMs(CLUB_TIMEZONE, utcGuess);
    return new Date(utcGuess.getTime() - offset).toISOString();
}

export function extractClubLocalTime(value: string | Date): string | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: CLUB_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!hour || !minute) return null;
    return `${pad2(Number.parseInt(hour, 10))}:${pad2(Number.parseInt(minute, 10))}`;
}
