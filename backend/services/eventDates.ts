function toLocalDayString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDayString(value: Date | string): string | null {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return toLocalDayString(value);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return toLocalDayString(parsed);
}

export function getEventDayRange(
    start?: Date | string | null,
    end?: Date | string | null,
): { startDay: string; endDay: string } | null {
    const startDay = start != null ? toDayString(start) : null;
    if (!startDay) return null;
    const endDay = end != null ? toDayString(end) : startDay;
    if (!endDay) return null;
    return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

export function isWithinEventDays(
    start?: Date | string | null,
    end?: Date | string | null,
    referenceDate: Date = new Date(),
): boolean {
    const range = getEventDayRange(start, end);
    if (!range) return false;
    const today = toLocalDayString(referenceDate);
    return today >= range.startDay && today <= range.endDay;
}
