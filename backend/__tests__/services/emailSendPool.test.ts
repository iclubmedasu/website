import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getEmailSendConcurrency,
    mapWithEmailConcurrency,
    runEmailJob,
} from '../../services/emailSendPool';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe('emailSendPool', () => {
    const originalConcurrency = process.env.EMAIL_SEND_CONCURRENCY;

    beforeEach(() => {
        process.env.EMAIL_SEND_CONCURRENCY = '2';
    });

    afterEach(() => {
        if (originalConcurrency === undefined) {
            delete process.env.EMAIL_SEND_CONCURRENCY;
        } else {
            process.env.EMAIL_SEND_CONCURRENCY = originalConcurrency;
        }
    });

    it('clamps EMAIL_SEND_CONCURRENCY between 1 and 20', () => {
        process.env.EMAIL_SEND_CONCURRENCY = '0';
        expect(getEmailSendConcurrency()).toBe(1);

        process.env.EMAIL_SEND_CONCURRENCY = '99';
        expect(getEmailSendConcurrency()).toBe(20);

        delete process.env.EMAIL_SEND_CONCURRENCY;
        expect(getEmailSendConcurrency()).toBe(8);
    });

    it('never exceeds configured concurrency for concurrent jobs', async () => {
        let inFlight = 0;
        let maxInFlight = 0;

        await mapWithEmailConcurrency([1, 2, 3, 4, 5, 6], async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await delay(30);
            inFlight -= 1;
        });

        expect(maxInFlight).toBe(2);
        expect(inFlight).toBe(0);
    });

    it('preserves result order and per-item failures via mapper', async () => {
        const results = await mapWithEmailConcurrency(
            ['a', 'b', 'c'],
            async (item) => {
                if (item === 'b') {
                    return { ok: false as const, item };
                }
                await delay(10);
                return { ok: true as const, item };
            },
        );

        expect(results).toEqual([
            { ok: true, item: 'a' },
            { ok: false, item: 'b' },
            { ok: true, item: 'c' },
        ]);
    });

    it('runEmailJob shares the same concurrency cap', async () => {
        let inFlight = 0;
        let maxInFlight = 0;

        await Promise.all(
            [1, 2, 3, 4].map((n) =>
                runEmailJob(async () => {
                    inFlight += 1;
                    maxInFlight = Math.max(maxInFlight, inFlight);
                    await delay(25);
                    inFlight -= 1;
                    return n;
                }),
            ),
        );

        expect(maxInFlight).toBe(2);
    });
});
