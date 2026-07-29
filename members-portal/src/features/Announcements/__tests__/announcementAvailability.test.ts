import { describe, expect, it } from 'vitest';
import {
    chipTone,
    daysToPeriods,
    formatPeriods,
    summarizeAvailability,
    toAssignmentDayString,
    toUtcDayString,
} from '../announcementAvailability';

describe('merge adjacent periods', () => {
    it('merges consecutive single days Jul 6–8 into one period', () => {
        expect(daysToPeriods(['2026-07-06', '2026-07-07', '2026-07-08'])).toEqual([
            { start: '2026-07-06', end: '2026-07-08' },
        ]);
    });

    it('keeps non-adjacent days as separate periods', () => {
        expect(daysToPeriods(['2026-07-06', '2026-07-08'])).toEqual([
            { start: '2026-07-06', end: '2026-07-06' },
            { start: '2026-07-08', end: '2026-07-08' },
        ]);
    });

    it('formatPeriods aggregates adjacent day rows for display', () => {
        const label = formatPeriods([
            { start: '2026-07-06', end: '2026-07-06' },
            { start: '2026-07-07', end: '2026-07-07' },
            { start: '2026-07-08', end: '2026-07-08' },
        ]);
        expect(label).toBe(formatPeriods([{ start: '2026-07-06', end: '2026-07-08' }]));
    });

    it('formatPeriods keeps non-adjacent periods separate', () => {
        const label = formatPeriods([
            { start: '2026-07-06', end: '2026-07-06' },
            { start: '2026-07-08', end: '2026-07-08' },
        ]);
        expect(label).toBe(
            [
                formatPeriods([{ start: '2026-07-06', end: '2026-07-06' }]),
                formatPeriods([{ start: '2026-07-08', end: '2026-07-08' }]),
            ].join(', '),
        );
    });

    it('summarizeAvailability periodsLabel merges adjacent response rows', () => {
        const summary = summarizeAvailability({
            status: 'AVAILABLE',
            periods: [
                { startDate: '2026-07-06', endDate: '2026-07-06' },
                { startDate: '2026-07-07', endDate: '2026-07-07' },
                { startDate: '2026-07-08', endDate: '2026-07-08' },
            ],
        });
        expect(summary?.periodsLabel).toBe(
            formatPeriods([{ start: '2026-07-06', end: '2026-07-08' }]),
        );
    });
});

describe('toAssignmentDayString', () => {
    it('passes through YYYY-MM-DD', () => {
        expect(toAssignmentDayString('2026-06-22')).toBe('2026-06-22');
    });

    it('uses date prefix for datetime-local strings', () => {
        expect(toAssignmentDayString('2026-06-22T14:30')).toBe('2026-06-22');
        expect(toAssignmentDayString('2026-06-22T14:30:00')).toBe('2026-06-22');
    });

    it('uses local calendar day for Date values', () => {
        // Local midnight Jun 22 — in UTC+3 this instant is 2026-06-21T21:00:00Z
        const localJun22 = new Date(2026, 5, 22, 0, 0, 0, 0);
        expect(toAssignmentDayString(localJun22)).toBe('2026-06-22');
    });

    it('uses local calendar day for ISO instants (UTC+3 off-by-one)', () => {
        // Jun 22 00:00 in UTC+3
        const iso = '2026-06-21T21:00:00.000Z';
        const date = new Date(iso);
        // Only assert local day when the runtime offset matches UTC+3
        if (date.getTimezoneOffset() === -180) {
            expect(toAssignmentDayString(iso)).toBe('2026-06-22');
            expect(toAssignmentDayString(date)).toBe('2026-06-22');
            expect(toUtcDayString(date)).toBe('2026-06-21');
        } else {
            expect(toAssignmentDayString(date)).toBe(
                [
                    date.getFullYear(),
                    String(date.getMonth() + 1).padStart(2, '0'),
                    String(date.getDate()).padStart(2, '0'),
                ].join('-'),
            );
        }
    });
});

describe('summarizeAvailability dateRange day matching', () => {
    const availableOnJun21Only = {
        status: 'AVAILABLE' as const,
        periods: [{ startDate: '2026-06-21', endDate: '2026-06-21' }],
    };
    const availableOnJun22 = {
        status: 'AVAILABLE' as const,
        periods: [{ startDate: '2026-06-22', endDate: '2026-06-22' }],
    };

    it('treats local Jun 22 Date as outside Jun 21-only periods (UTC+3 off-by-one)', () => {
        const localJun22 = new Date(2026, 5, 22, 0, 0, 0, 0);
        // Regression: toUtcDayString(localJun22) in UTC+3 is 2026-06-21 and would false-match
        if (localJun22.getTimezoneOffset() === -180) {
            expect(toUtcDayString(localJun22)).toBe('2026-06-21');
        }

        const summary = summarizeAvailability(availableOnJun21Only, {
            start: localJun22,
            end: localJun22,
        });
        expect(summary?.conflict).toBe('outside_periods');
        expect(chipTone(summary)).toBe('unavailable');
    });

    it('treats local Jun 22 Date as available when day is inside periods', () => {
        const localJun22 = new Date(2026, 5, 22, 0, 0, 0, 0);
        const summary = summarizeAvailability(availableOnJun22, {
            start: localJun22,
            end: localJun22,
        });
        expect(summary?.conflict).toBe('none');
        expect(summary?.status).toBe('AVAILABLE');
        expect(chipTone(summary)).toBe('available');
    });

    it('keeps YYYY-MM-DD assignment ranges correct', () => {
        expect(
            summarizeAvailability(availableOnJun21Only, {
                start: '2026-06-22',
                end: '2026-06-22',
            })?.conflict,
        ).toBe('outside_periods');
        expect(
            chipTone(
                summarizeAvailability(availableOnJun22, {
                    start: '2026-06-22',
                    end: '2026-06-22',
                }),
            ),
        ).toBe('available');
    });
});
