import { describe, expect, it } from 'vitest';
import {
    nextWsReconnectDelayMs,
    WS_RECONNECT_INITIAL_MS,
    WS_RECONNECT_MAX_MS,
} from '@/context/RealtimeContext';

describe('WS reconnect backoff', () => {
    it('doubles from 2s and caps at 30s', () => {
        const schedule: number[] = [];
        let delay = WS_RECONNECT_INITIAL_MS;
        for (let i = 0; i < 6; i++) {
            schedule.push(delay);
            delay = nextWsReconnectDelayMs(delay);
        }

        expect(schedule).toEqual([2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
        expect(WS_RECONNECT_MAX_MS).toBe(30_000);
        expect(nextWsReconnectDelayMs(WS_RECONNECT_MAX_MS)).toBe(WS_RECONNECT_MAX_MS);
    });
});
