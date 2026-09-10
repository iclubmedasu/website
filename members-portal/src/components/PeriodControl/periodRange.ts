import { toClubDayString } from '@iclub/shared/utils';

export type PeriodPreset =
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'this_year'
    | 'custom';

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
];

export type PeriodRange = {
    startDate: string;
    endDate: string;
};

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function formatDay(year: number, month: number, day: number): string {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseClubDay(day: string): { year: number; month: number; day: number } | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
    if (!match) return null;
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const dayNum = Number.parseInt(match[3], 10);
    if (!year || month < 1 || month > 12 || dayNum < 1 || dayNum > 31) return null;
    return { year, month, day: dayNum };
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True when both YYYY-MM-DD values are present and from <= to. */
export function isValidCustomRange(from: string, to: string): boolean {
    if (!from || !to) return false;
    if (!parseClubDay(from) || !parseClubDay(to)) return false;
    return from <= to;
}

/**
 * Resolve a period preset to club-calendar YYYY-MM-DD bounds.
 * Custom returns null until both dates are valid and ordered.
 */
export function resolvePeriodRange(
    preset: PeriodPreset,
    customFrom = '',
    customTo = '',
    now: Date = new Date(),
): PeriodRange | null {
    if (preset === 'custom') {
        if (!isValidCustomRange(customFrom, customTo)) return null;
        return { startDate: customFrom, endDate: customTo };
    }

    const today = toClubDayString(now);
    if (!today) return null;
    const parsed = parseClubDay(today);
    if (!parsed) return null;
    const { year, month } = parsed;

    switch (preset) {
        case 'this_month':
            return { startDate: formatDay(year, month, 1), endDate: today };
        case 'last_month': {
            let lastYear = year;
            let lastMonth = month - 1;
            if (lastMonth < 1) {
                lastYear -= 1;
                lastMonth = 12;
            }
            const lastDay = daysInMonth(lastYear, lastMonth);
            return {
                startDate: formatDay(lastYear, lastMonth, 1),
                endDate: formatDay(lastYear, lastMonth, lastDay),
            };
        }
        case 'this_quarter': {
            const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
            return {
                startDate: formatDay(year, quarterStartMonth, 1),
                endDate: today,
            };
        }
        case 'this_year':
            return { startDate: formatDay(year, 1, 1), endDate: today };
        default:
            return null;
    }
}

export function parsePeriodPreset(value: string | null | undefined): PeriodPreset | null {
    if (!value) return null;
    const match = PERIOD_OPTIONS.find((option) => option.value === value);
    return match ? match.value : null;
}

export function buildPeriodQuery(range: PeriodRange, preset: PeriodPreset): string {
    const params = new URLSearchParams();
    params.set('startDate', range.startDate);
    params.set('endDate', range.endDate);
    params.set('period', preset);
    return params.toString();
}
