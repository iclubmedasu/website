import { formatDate } from '@iclub/shared/utils';

export type AvailabilityMode = 'days' | 'periods';

export interface AvailabilityPeriod {
    start: string;
    end: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_MODE_MIN_SPAN_DAYS = 32; // inclusive span > 31 → period mode for events

export function toUtcDayString(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (ISO_DAY.test(trimmed)) return trimmed;
        const sliced = trimmed.slice(0, 10);
        if (ISO_DAY.test(sliced)) {
            const date = new Date(`${sliced}T00:00:00.000Z`);
            if (!Number.isNaN(date.getTime()) && toUtcDayKey(date) === sliced) return sliced;
        }
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return toUtcDayKey(date);
}

const HAS_TZ_SUFFIX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const LOCAL_DATETIME_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Local calendar day for assignment UI ranges (event task days, schedule slots, etc.).
 * Date-only and datetime-local strings stay as their date prefix; Date / ISO instants use local Y-M-D.
 * Do not use for API/UTC-midnight period normalization — use toUtcDayString for that.
 */
export function toAssignmentDayString(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (ISO_DAY.test(trimmed)) return trimmed;
        const sliced = trimmed.slice(0, 10);
        if (
            ISO_DAY.test(sliced) &&
            LOCAL_DATETIME_PREFIX.test(trimmed) &&
            !HAS_TZ_SUFFIX.test(trimmed)
        ) {
            return sliced;
        }
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return toLocalDayKey(date);
}

function toUtcDayKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function toLocalDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Inclusive day count between two ISO day strings (or dates). */
export function spanDays(
    startRaw: string | Date | null | undefined,
    endRaw: string | Date | null | undefined,
): number | null {
    const start = toUtcDayString(startRaw);
    const end = toUtcDayString(endRaw);
    if (!start || !end || start > end) return null;
    const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
    return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

export function enumerateInclusiveDays(
    startRaw: string | Date | null | undefined,
    endRaw: string | Date | null | undefined,
    maxDays = 31,
): string[] | null {
    const start = toUtcDayString(startRaw);
    const end = toUtcDayString(endRaw);
    if (!start || !end || start > end) return null;

    const days: string[] = [];
    const cursor = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);

    while (cursor.getTime() <= endDate.getTime() && days.length < maxDays) {
        const day = toUtcDayKey(cursor);
        days.push(day);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days.length > 0 ? days : null;
}

export function usesPeriodMode(args: {
    targetType: 'NONE' | 'EVENT' | 'PROJECT';
    eventDate?: string | null;
    eventEndDate?: string | null;
    projectStartDate?: string | null;
    projectDueDate?: string | null;
}): boolean {
    if (args.targetType === 'PROJECT') return true;
    if (args.targetType !== 'EVENT') return false;
    const span = spanDays(args.eventDate, args.eventEndDate ?? args.eventDate);
    return span != null && span >= PERIOD_MODE_MIN_SPAN_DAYS;
}

export function targetWindow(args: {
    targetType: 'NONE' | 'EVENT' | 'PROJECT';
    eventDate?: string | null;
    eventEndDate?: string | null;
    projectStartDate?: string | null;
    projectDueDate?: string | null;
}): { start: string; end: string } | null {
    if (args.targetType === 'EVENT' && args.eventDate) {
        const start = toUtcDayString(args.eventDate);
        const end = toUtcDayString(args.eventEndDate ?? args.eventDate);
        if (!start || !end || start > end) return null;
        return { start, end };
    }
    if (args.targetType === 'PROJECT') {
        const start = toUtcDayString(args.projectStartDate);
        const end = toUtcDayString(args.projectDueDate);
        if (!start || !end || start > end) return null;
        return { start, end };
    }
    return null;
}

export function formatPeriod(period: AvailabilityPeriod): string {
    const start = toUtcDayString(period.start);
    const end = toUtcDayString(period.end);
    if (!start || !end) return '—';
    if (start === end) {
        return formatDate(start, { timeZone: 'UTC' });
    }
    return `${formatDate(start, { timeZone: 'UTC' })} – ${formatDate(end, { timeZone: 'UTC' })}`;
}

export function formatPeriods(periods: AvailabilityPeriod[]): string {
    const merged = mergePeriodUnion(periods);
    if (!merged.length) return '';
    return merged.map(formatPeriod).join(', ');
}

export function normalizePeriods(
    periods: Array<{ start?: string | Date | null; end?: string | Date | null }>,
): AvailabilityPeriod[] {
    return periods
        .map((p) => {
            const start = toUtcDayString(p.start ?? null);
            const end = toUtcDayString(p.end ?? null);
            if (!start || !end) return null;
            return { start, end };
        })
        .filter((p): p is AvailabilityPeriod => p !== null)
        .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export function validatePeriods(
    periods: AvailabilityPeriod[],
    window: { start: string; end: string } | null,
): string | null {
    const normalized = normalizePeriods(periods);

    for (const period of normalized) {
        if (period.start > period.end) {
            return 'Each period must have start on or before end';
        }
        if (window && (period.start < window.start || period.end > window.end)) {
            return `Periods must fall between ${formatDate(window.start, { timeZone: 'UTC' })} and ${formatDate(window.end, { timeZone: 'UTC' })}`;
        }
    }

    for (let i = 1; i < normalized.length; i++) {
        const prev = normalized[i - 1];
        const curr = normalized[i];
        if (curr.start <= prev.end) {
            return 'Periods must not overlap';
        }
    }

    return null;
}

export function daysToPeriods(days: string[]): AvailabilityPeriod[] {
    return mergePeriodUnion(normalizePeriods(days.map((day) => ({ start: day, end: day }))));
}

export function periodsToDaySet(periods: AvailabilityPeriod[]): string[] {
    const days = new Set<string>();
    for (const period of periods) {
        const enumerated = enumerateInclusiveDays(period.start, period.end, 366);
        if (enumerated) {
            for (const day of enumerated) days.add(day);
        }
    }
    return Array.from(days).sort();
}

export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type AvailabilityConflict = 'none' | 'unavailable' | 'outside_periods' | 'partial';
export type AvailabilityChipTone = 'neutral' | 'available' | 'unavailable' | 'partial';

export interface AvailabilityResponseLike {
    status: string;
    periods?: Array<{
        startDate?: string | Date | null;
        endDate?: string | Date | null;
        start?: string | Date | null;
        end?: string | Date | null;
    }> | null;
}

export interface AvailabilitySummary {
    status: AvailabilityStatus;
    label: string;
    conflict: AvailabilityConflict;
    periodsLabel: string;
    conflictNote: string | null;
}

function normalizeResponsePeriods(
    periods: AvailabilityResponseLike['periods'],
): AvailabilityPeriod[] {
    if (!periods?.length) return [];
    return mergePeriodUnion(
        normalizePeriods(
            periods.map((period) => ({
                start: period.startDate ?? period.start ?? null,
                end: period.endDate ?? period.end ?? null,
            })),
        ),
    );
}

function rangesOverlap(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string,
): boolean {
    return aStart <= bEnd && aEnd >= bStart;
}

function addUtcDays(day: string, days: number): string {
    const date = new Date(`${day}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return toUtcDayKey(date);
}

/** Merge overlapping/adjacent periods into a sorted union. */
export function mergePeriodUnion(periods: AvailabilityPeriod[]): AvailabilityPeriod[] {
    const sorted = normalizePeriods(periods);
    if (!sorted.length) return [];

    const merged: AvailabilityPeriod[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const curr = sorted[i];
        const nextAfterLast = addUtcDays(last.end, 1);
        if (curr.start <= nextAfterLast) {
            if (curr.end > last.end) last.end = curr.end;
        } else {
            merged.push({ ...curr });
        }
    }
    return merged;
}

/** True when every day in [rangeStart, rangeEnd] falls inside the period union. */
export function isRangeFullyCoveredByPeriods(
    rangeStart: string,
    rangeEnd: string,
    periods: AvailabilityPeriod[],
): boolean {
    if (rangeStart > rangeEnd) return false;
    const merged = mergePeriodUnion(periods);
    let cursor = rangeStart;
    for (const period of merged) {
        if (period.end < cursor) continue;
        if (period.start > cursor) return false;
        if (period.end >= rangeEnd) return true;
        cursor = addUtcDays(period.end, 1);
    }
    return false;
}

/** Soft-conflict summary for assignment UIs. Returns null when there is no response. */
export function summarizeAvailability(
    response: AvailabilityResponseLike | null | undefined,
    dateRange?: { start?: string | Date | null; end?: string | Date | null } | null,
): AvailabilitySummary | null {
    if (!response) return null;
    if (response.status !== 'AVAILABLE' && response.status !== 'UNAVAILABLE') return null;

    const periods = normalizeResponsePeriods(response.periods);
    const periodsLabel = formatPeriods(periods);
    const status = response.status as AvailabilityStatus;

    if (status === 'UNAVAILABLE') {
        return {
            status,
            label: 'Not available',
            conflict: 'unavailable',
            periodsLabel,
            conflictNote: 'Marked unavailable',
        };
    }

    const rangeStart = toAssignmentDayString(dateRange?.start ?? null);
    const rangeEnd = toAssignmentDayString(dateRange?.end ?? dateRange?.start ?? null);

    if (periods.length > 0 && rangeStart && rangeEnd && rangeStart <= rangeEnd) {
        const overlaps = periods.some((period) =>
            rangesOverlap(rangeStart, rangeEnd, period.start, period.end),
        );
        if (!overlaps) {
            return {
                status,
                label: 'Not available',
                conflict: 'outside_periods',
                periodsLabel,
                conflictNote: 'Outside available periods',
            };
        }
        if (!isRangeFullyCoveredByPeriods(rangeStart, rangeEnd, periods)) {
            return {
                status,
                label: 'Partial',
                conflict: 'partial',
                periodsLabel,
                conflictNote: null,
            };
        }
    }

    return {
        status,
        label: 'Available',
        conflict: 'none',
        periodsLabel,
        conflictNote: null,
    };
}

/** Chip color tone for assignment UIs. Null/unanswered → neutral. */
export function chipTone(summary: AvailabilitySummary | null | undefined): AvailabilityChipTone {
    if (!summary) return 'neutral';
    if (summary.conflict === 'partial') return 'partial';
    if (summary.conflict === 'unavailable' || summary.conflict === 'outside_periods') {
        return 'unavailable';
    }
    if (summary.status === 'AVAILABLE') return 'available';
    return 'neutral';
}

/** Sort rank: Available → Partial → Neutral → Unavailable. */
export function availabilitySortRank(tone: AvailabilityChipTone): number {
    if (tone === 'available') return 0;
    if (tone === 'partial') return 1;
    if (tone === 'neutral') return 2;
    return 3;
}

/** Tooltip text for availability chips / hints. */
export function availabilityChipTitle(
    summary: AvailabilitySummary | null | undefined,
    announcementTitle?: string | null,
): string {
    if (!summary) return '';
    const tone = chipTone(summary);
    const statusLabel =
        tone === 'partial' ? 'Partial'
            : tone === 'unavailable'
                ? (summary.conflictNote || 'Not available')
                : 'Available';
    return [
        announcementTitle ? `From: ${announcementTitle}` : null,
        statusLabel,
        summary.periodsLabel || null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/** Short status-only suffix for native <option> labels (periods belong under the select). */
export function availabilityOptionSuffix(summary: AvailabilitySummary | null): string {
    if (!summary) return '';
    const tone = chipTone(summary);
    if (tone === 'unavailable') return ' · Not available';
    if (tone === 'partial') return ' · Partial';
    if (tone === 'available') return ' · Available';
    return '';
}
