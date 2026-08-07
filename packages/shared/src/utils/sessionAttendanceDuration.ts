/**
 * Session attendance segment duration helpers.
 * Closed segments use checkedOutAt; open segments are capped at session end (virtual cap).
 */

export interface SessionAttendanceSegmentInput {
    joinedAt: string | Date;
    checkedOutAt?: string | Date | null;
    sessionEndDateTime?: string | Date | null;
}

export interface SegmentDurationResult {
    durationMinutes: number;
    isOpen: boolean;
    wasVirtuallyCapped: boolean;
    effectiveEnd: Date;
}

function toDate(value: string | Date | null | undefined): Date | null {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function getSegmentDuration(
    segment: SessionAttendanceSegmentInput,
    now: Date = new Date(),
): SegmentDurationResult {
    const joinedAt = toDate(segment.joinedAt) ?? now;
    const checkedOutAt = toDate(segment.checkedOutAt ?? null);
    const sessionEnd = toDate(segment.sessionEndDateTime ?? null);
    const isOpen = !checkedOutAt;

    let effectiveEnd: Date;
    let wasVirtuallyCapped = false;

    if (checkedOutAt) {
        effectiveEnd = checkedOutAt;
    } else if (sessionEnd && now.getTime() > sessionEnd.getTime()) {
        effectiveEnd = sessionEnd;
        wasVirtuallyCapped = true;
    } else {
        effectiveEnd = now;
    }

    // Guard against negative if clocks / data are off.
    const ms = Math.max(0, effectiveEnd.getTime() - joinedAt.getTime());
    const durationMinutes = Math.floor(ms / 60_000);

    return {
        durationMinutes,
        isOpen,
        wasVirtuallyCapped,
        effectiveEnd,
    };
}

export function sumSegmentDurations(
    segments: SessionAttendanceSegmentInput[],
    now: Date = new Date(),
): { totalMinutes: number; hasOpen: boolean; wasVirtuallyCapped: boolean } {
    let totalMinutes = 0;
    let hasOpen = false;
    let wasVirtuallyCapped = false;
    for (const segment of segments) {
        const result = getSegmentDuration(segment, now);
        totalMinutes += result.durationMinutes;
        if (result.isOpen) hasOpen = true;
        if (result.wasVirtuallyCapped) wasVirtuallyCapped = true;
    }
    return { totalMinutes, hasOpen, wasVirtuallyCapped };
}

/** Human-readable "42m" / "1h 15m" / "2h". */
export function formatDurationMinutes(totalMinutes: number): string {
    const minutes = Math.max(0, Math.floor(totalMinutes));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (rest === 0) return `${hours}h`;
    return `${hours}h ${rest}m`;
}
