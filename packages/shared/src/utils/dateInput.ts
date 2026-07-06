function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

/** Format an ISO instant for `<input type="date">` using the local calendar day. */
export function toDateInputValue(value: string | Date): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate()),
    ].join("-");
}

/** Convert a date input value (local calendar day) to a UTC ISO instant at local midnight. */
export function fromDateInputValue(local: string): string | null {
    const trimmed = local.trim();
    if (!trimmed) return null;
    const date = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

/** Local calendar day key `YYYY-MM-DD` for timeline indexing in the browser. */
export function toLocalDayKey(value: string | Date): string {
    return toDateInputValue(value);
}
