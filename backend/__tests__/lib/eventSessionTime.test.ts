import { describe, expect, it } from 'vitest';
import { isSessionEndedAt } from '../../lib/eventSessionTime';

describe('isSessionEndedAt', () => {
    it('returns true for instant sessions after endDateTime', () => {
        const session = {
            startDateTime: '2026-07-01T10:00:00.000Z',
            endDateTime: '2026-07-01T12:00:00.000Z',
        };
        const afterEnd = new Date('2026-07-01T12:00:00.000Z');
        expect(isSessionEndedAt(session, afterEnd)).toBe(true);
    });

    it('returns false for instant sessions before endDateTime', () => {
        const session = {
            startDateTime: '2026-07-01T10:00:00.000Z',
            endDateTime: '2026-07-01T12:00:00.000Z',
        };
        const beforeEnd = new Date('2026-07-01T11:00:00.000Z');
        expect(isSessionEndedAt(session, beforeEnd)).toBe(false);
    });

    it('returns false for in-progress instant sessions', () => {
        const session = {
            startDateTime: '2026-07-01T10:00:00.000Z',
            endDateTime: '2026-07-01T12:00:00.000Z',
        };
        const duringSession = new Date('2026-07-01T10:30:00.000Z');
        expect(isSessionEndedAt(session, duringSession)).toBe(false);
    });

    it('returns true for legacy date/time sessions after end time', () => {
        const session = {
            sessionDate: '2026-07-01',
            startTime: '10:00',
            endTime: '12:00',
        };
        const afterEnd = new Date('2026-07-01T14:00:00.000Z');
        expect(isSessionEndedAt(session, afterEnd, 'Africa/Cairo')).toBe(true);
    });

    it('returns false for legacy date/time sessions before end time', () => {
        const session = {
            sessionDate: '2026-07-01',
            startTime: '10:00',
            endTime: '12:00',
        };
        const beforeEnd = new Date('2026-07-01T08:00:00.000Z');
        expect(isSessionEndedAt(session, beforeEnd, 'Africa/Cairo')).toBe(false);
    });

    it('returns false when session times cannot be parsed', () => {
        const session = {
            sessionDate: 'invalid',
            startTime: 'bad',
            endTime: 'data',
        };
        expect(isSessionEndedAt(session, new Date())).toBe(false);
    });
});
