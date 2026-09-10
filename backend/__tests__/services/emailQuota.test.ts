import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    emailOutboxCount: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        emailOutbox: {
            count: prismaMocks.emailOutboxCount,
        },
    },
}));

import {
    getEmailDailyLimit,
    getEmailMonthlyLimit,
    getQuotaStatus,
    hasQuotaRemaining,
    isEmailQuotaError,
} from '../../services/emailQuota';

describe('emailQuota', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.EMAIL_DAILY_LIMIT = '100';
        process.env.EMAIL_MONTHLY_LIMIT = '3000';
        prismaMocks.emailOutboxCount.mockReset();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    it('defaults daily/monthly limits to 100/3000', () => {
        delete process.env.EMAIL_DAILY_LIMIT;
        delete process.env.EMAIL_MONTHLY_LIMIT;
        expect(getEmailDailyLimit()).toBe(100);
        expect(getEmailMonthlyLimit()).toBe(3000);
    });

    it('uses finance-matched local day/month bounds when counting sentAt', async () => {
        const now = new Date(2026, 8, 10, 15, 30, 0); // local Sep 10 2026 15:30
        const expectedDayStart = new Date(2026, 8, 10, 0, 0, 0, 0);
        const expectedMonthStart = new Date(2026, 8, 1, 0, 0, 0, 0);

        prismaMocks.emailOutboxCount
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(400);

        const status = await getQuotaStatus(now);

        expect(status.dayStart).toEqual(expectedDayStart);
        expect(status.monthStart).toEqual(expectedMonthStart);
        expect(status.dailyUsed).toBe(12);
        expect(status.monthlyUsed).toBe(400);
        expect(status.dailyRemaining).toBe(88);
        expect(status.monthlyRemaining).toBe(2600);

        expect(prismaMocks.emailOutboxCount).toHaveBeenNthCalledWith(1, {
            where: { sentAt: { not: null, gte: expectedDayStart } },
        });
        expect(prismaMocks.emailOutboxCount).toHaveBeenNthCalledWith(2, {
            where: { sentAt: { not: null, gte: expectedMonthStart } },
        });
    });

    it('hasQuotaRemaining requires both day and month headroom', async () => {
        const now = new Date(2026, 8, 10, 12, 0, 0);
        prismaMocks.emailOutboxCount
            .mockResolvedValueOnce(99)
            .mockResolvedValueOnce(2999)
            .mockResolvedValueOnce(99)
            .mockResolvedValueOnce(2999);

        await expect(hasQuotaRemaining(1, now)).resolves.toBe(true);
        await expect(hasQuotaRemaining(2, now)).resolves.toBe(false);
    });

    it('reports zero remaining when over limit', async () => {
        const now = new Date(2026, 8, 10, 8, 0, 0);
        prismaMocks.emailOutboxCount
            .mockResolvedValueOnce(150)
            .mockResolvedValueOnce(5000)
            .mockResolvedValueOnce(150)
            .mockResolvedValueOnce(5000);

        const status = await getQuotaStatus(now);
        expect(status.dailyRemaining).toBe(0);
        expect(status.monthlyRemaining).toBe(0);
        await expect(hasQuotaRemaining(1, now)).resolves.toBe(false);
    });

    it('detects quota errors separately from generic rate limits', () => {
        expect(isEmailQuotaError(new Error('Monthly quota exceeded'))).toBe(true);
        expect(isEmailQuotaError(new Error('Daily limit reached'))).toBe(true);
        expect(isEmailQuotaError(new Error('Too many requests'))).toBe(false);
        expect(isEmailQuotaError(Object.assign(new Error('rate limit'), { statusCode: 429 }))).toBe(false);
    });
});
