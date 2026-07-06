import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    fromDateTimeLocalValue,
    isDateTimeLocalValue,
    toDateTimeLocalValue,
} from './datetimeLocal';

const ORIGINAL_TZ = process.env.TZ;

describe('datetimeLocal', () => {
    beforeEach(() => {
        process.env.TZ = 'Africa/Cairo';
    });

    afterEach(() => {
        if (ORIGINAL_TZ === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = ORIGINAL_TZ;
        }
    });

    it('detects datetime-local formatted strings', () => {
        expect(isDateTimeLocalValue('2026-07-01T00:00')).toBe(true);
        expect(isDateTimeLocalValue('2026-07-01T00:00:00.000Z')).toBe(false);
    });

    it('formats UTC ISO as local datetime-local value in UTC+3', () => {
        expect(toDateTimeLocalValue('2026-06-30T21:00:00.000Z')).toBe('2026-07-01T00:00');
    });

    it('round-trips local datetime-local value to UTC ISO', () => {
        expect(fromDateTimeLocalValue('2026-07-01T00:00')).toBe('2026-06-30T21:00:00.000Z');
    });

    it('returns null for empty or invalid local values', () => {
        expect(fromDateTimeLocalValue('')).toBeNull();
        expect(fromDateTimeLocalValue('not-a-date')).toBeNull();
    });

    it('returns empty string for invalid toDateTimeLocalValue input', () => {
        expect(toDateTimeLocalValue('')).toBe('');
        expect(toDateTimeLocalValue('invalid')).toBe('');
    });
});
