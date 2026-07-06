const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

export function isDateTimeLocalValue(value: string): boolean {
    return DATE_TIME_LOCAL_PATTERN.test(value);
}

/** Format an ISO instant or Date for `<input type="datetime-local">` (local wall-clock). */
export function toDateTimeLocalValue(value: string | Date): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate()),
    ].join("-") + `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Convert a datetime-local string to a UTC ISO instant for API payloads. */
export function fromDateTimeLocalValue(local: string): string | null {
    const trimmed = local.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}
