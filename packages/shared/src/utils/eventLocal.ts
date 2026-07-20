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

const TIMEZONE_LABELS: Record<string, string> = {
    "Africa/Cairo": "Cairo",
    "Europe/London": "London",
    "Asia/Dubai": "Dubai",
    "Asia/Riyadh": "Riyadh",
    "UTC": "UTC",
    "America/New_York": "New York",
    "America/Los_Angeles": "Los Angeles",
    "Europe/Paris": "Paris",
    "Asia/Singapore": "Singapore",
};

/** Short human label for an IANA timezone (emails / public venue line). */
export function getTimezoneLabel(timeZone: string): string {
    const trimmed = timeZone.trim();
    if (TIMEZONE_LABELS[trimmed]) return TIMEZONE_LABELS[trimmed];
    const segment = trimmed.split("/").pop()?.replace(/_/g, " ");
    return segment || trimmed;
}

export function isValidIanaTimezone(timeZone: string): boolean {
    const trimmed = timeZone.trim();
    if (!trimmed) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: trimmed });
        return true;
    } catch {
        return false;
    }
}

/** Extract YYYY-MM-DD calendar day from an instant in the given timezone. */
export function toEventDayString(value: string | Date, timeZone: string): string | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
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

/** Combine calendar day + HH:mm wall-clock in timezone → UTC ISO instant. */
export function combineEventLocalDateTime(day: string, hhmm: string, timeZone: string): string | null {
    const trimmedDay = day.trim().slice(0, 10);
    const trimmedTime = hhmm.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDay)) return null;
    if (!/^\d{2}:\d{2}$/.test(trimmedTime)) return null;

    const [year, month, dayOfMonth] = trimmedDay.split("-").map((part) => Number.parseInt(part, 10));
    const [hour, minute] = trimmedTime.split(":").map((part) => Number.parseInt(part, 10));
    const utcGuess = new Date(Date.UTC(year, month - 1, dayOfMonth, hour, minute, 0));
    const offset = getTimeZoneOffsetMs(timeZone, utcGuess);
    return new Date(utcGuess.getTime() - offset).toISOString();
}

export function extractEventLocalTime(value: string | Date, timeZone: string): string | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!hour || !minute) return null;
    return `${pad2(Number.parseInt(hour, 10))}:${pad2(Number.parseInt(minute, 10))}`;
}

export const COMMON_EVENT_TIMEZONES = [
    { id: "Africa/Cairo", label: "Cairo (Egypt)" },
    { id: "Europe/London", label: "London (UK)" },
    { id: "Asia/Dubai", label: "Dubai (UAE)" },
    { id: "Asia/Riyadh", label: "Riyadh (Saudi Arabia)" },
    { id: "UTC", label: "UTC" },
    { id: "America/New_York", label: "New York (US Eastern)" },
    { id: "Europe/Paris", label: "Paris (Central Europe)" },
    { id: "Asia/Singapore", label: "Singapore" },
] as const;
