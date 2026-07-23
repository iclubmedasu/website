import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
    Resend: vi.fn().mockImplementation(() => ({
        emails: {
            send: sendMock,
        },
    })),
}));

describe('emailService sendEmail rate-limit retry', () => {
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.RESEND_FROM_EMAIL;

    beforeEach(() => {
        vi.resetModules();
        sendMock.mockReset();
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'from@example.com';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        if (originalApiKey === undefined) {
            delete process.env.RESEND_API_KEY;
        } else {
            process.env.RESEND_API_KEY = originalApiKey;
        }
        if (originalFrom === undefined) {
            delete process.env.RESEND_FROM_EMAIL;
        } else {
            process.env.RESEND_FROM_EMAIL = originalFrom;
        }
    });

    it('retries on 429 then succeeds', async () => {
        sendMock
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'Too many requests', statusCode: 429 },
            })
            .mockResolvedValueOnce({
                data: { id: 'email-ok' },
                error: null,
            });

        const { sendEmail } = await import('../../services/emailService');
        const pending = sendEmail({
            to: 'ada@example.com',
            subject: 'Hello',
            html: '<p>Hi</p>',
        });

        await vi.advanceTimersByTimeAsync(500);
        const result = await pending;

        expect(result).toEqual({ id: 'email-ok' });
        expect(sendMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-rate-limit errors', async () => {
        sendMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'Invalid API key', statusCode: 401 },
        });

        const { sendEmail } = await import('../../services/emailService');
        await expect(
            sendEmail({
                to: 'ada@example.com',
                subject: 'Hello',
                html: '<p>Hi</p>',
            }),
        ).rejects.toThrow('Invalid API key');

        expect(sendMock).toHaveBeenCalledTimes(1);
    });
});
