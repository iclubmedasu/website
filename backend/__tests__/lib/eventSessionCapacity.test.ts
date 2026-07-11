import { describe, expect, it } from 'vitest';
import {
    buildSessionCapacityStats,
    parseSessionMaxCapacity,
    splitSessionsForTicket,
} from '../../lib/eventSessionCapacity';

describe('parseSessionMaxCapacity', () => {
    it('treats empty/null as unlimited', () => {
        expect(parseSessionMaxCapacity(null)).toEqual({ ok: true, value: null });
        expect(parseSessionMaxCapacity('')).toEqual({ ok: true, value: null });
        expect(parseSessionMaxCapacity(undefined)).toEqual({ ok: true, value: null });
    });

    it('accepts positive integers', () => {
        expect(parseSessionMaxCapacity(40)).toEqual({ ok: true, value: 40 });
        expect(parseSessionMaxCapacity('43')).toEqual({ ok: true, value: 43 });
    });

    it('rejects zero and non-integers', () => {
        expect(parseSessionMaxCapacity(0).ok).toBe(false);
        expect(parseSessionMaxCapacity(-1).ok).toBe(false);
        expect(parseSessionMaxCapacity('abc').ok).toBe(false);
    });
});

describe('buildSessionCapacityStats', () => {
    it('marks unlimited sessions as not full', () => {
        expect(buildSessionCapacityStats(null, 100)).toEqual({
            registeredCount: 100,
            spotsRemaining: null,
            isFull: false,
        });
    });

    it('computes spots and full state for limited sessions', () => {
        expect(buildSessionCapacityStats(40, 37)).toEqual({
            registeredCount: 37,
            spotsRemaining: 3,
            isFull: false,
        });
        expect(buildSessionCapacityStats(40, 40)).toEqual({
            registeredCount: 40,
            spotsRemaining: 0,
            isFull: true,
        });
        expect(buildSessionCapacityStats(40, 45)).toEqual({
            registeredCount: 45,
            spotsRemaining: 0,
            isFull: true,
        });
    });
});

describe('splitSessionsForTicket', () => {
    const sessions = [
        { id: 1, maxCapacity: 10 },
        { id: 2, maxCapacity: null },
        { id: 3, maxCapacity: 5 },
        { id: 4, maxCapacity: null },
    ];

    it('puts selected sessions in waitingForYou regardless of capacity', () => {
        const { waitingForYou, dontMissOut } = splitSessionsForTicket(sessions, [1, 2]);
        expect(waitingForYou.map((s) => s.id)).toEqual([1, 2]);
        expect(dontMissOut.map((s) => s.id)).toEqual([4]);
    });

    it('omits limited unselected sessions from dontMissOut', () => {
        const { waitingForYou, dontMissOut } = splitSessionsForTicket(sessions, []);
        expect(waitingForYou).toEqual([]);
        expect(dontMissOut.map((s) => s.id)).toEqual([2, 4]);
    });

    it('hides limited unselected when some other sessions are selected', () => {
        const { waitingForYou, dontMissOut } = splitSessionsForTicket(sessions, [3]);
        expect(waitingForYou.map((s) => s.id)).toEqual([3]);
        expect(dontMissOut.map((s) => s.id)).toEqual([2, 4]);
    });
});
