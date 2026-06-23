import { describe, expect, it } from 'vitest';
import { shouldSendWalkInTicket } from '../../services/eventDates';

describe('shouldSendWalkInTicket', () => {
    it('returns false for single-day events', () => {
        const day = new Date('2026-06-22T12:00:00.000Z');
        expect(shouldSendWalkInTicket(day, day, day)).toBe(false);
    });

    it('returns false when walking in on the last event day', () => {
        const start = new Date('2026-06-20T10:00:00.000Z');
        const end = new Date('2026-06-24T18:00:00.000Z');
        const lastDay = new Date('2026-06-24T09:00:00.000Z');
        expect(shouldSendWalkInTicket(start, end, lastDay)).toBe(false);
    });

    it('returns true when walking in before the last event day', () => {
        const start = new Date('2026-06-20T10:00:00.000Z');
        const end = new Date('2026-06-24T18:00:00.000Z');
        const midEvent = new Date('2026-06-22T09:00:00.000Z');
        expect(shouldSendWalkInTicket(start, end, midEvent)).toBe(true);
    });

    it('returns false when reference date is outside the event range', () => {
        const start = new Date('2026-06-20T10:00:00.000Z');
        const end = new Date('2026-06-24T18:00:00.000Z');
        const beforeEvent = new Date('2026-06-19T09:00:00.000Z');
        expect(shouldSendWalkInTicket(start, end, beforeEvent)).toBe(false);
    });
});
