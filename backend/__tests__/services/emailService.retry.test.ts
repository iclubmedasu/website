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

describe('emailService sendEmail attachment mapping', () => {
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.RESEND_FROM_EMAIL;

    beforeEach(() => {
        vi.resetModules();
        sendMock.mockReset();
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'from@example.com';
    });

    afterEach(() => {
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

    it('maps contentId attachments with contentId and string filename', async () => {
        sendMock.mockResolvedValueOnce({
            data: { id: 'email-cid' },
            error: null,
        });

        const { sendEmail } = await import('../../services/emailService');
        await sendEmail({
            to: 'ada@example.com',
            subject: 'Ticket',
            html: '<img src="cid:logo" />',
            attachments: [
                {
                    filename: 'logo.png',
                    content: 'base64logo',
                    contentId: 'logo',
                    contentType: 'image/png',
                },
            ],
        });

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                attachments: [
                    {
                        content: 'base64logo',
                        filename: 'logo.png',
                        contentType: 'image/png',
                        contentId: 'logo',
                    },
                ],
            }),
        );
    });

    it('keeps PDF attachments as named files without contentId', async () => {
        sendMock.mockResolvedValueOnce({
            data: { id: 'email-pdf' },
            error: null,
        });

        const { sendEmail } = await import('../../services/emailService');
        await sendEmail({
            to: 'ada@example.com',
            subject: 'Certificate',
            html: '<p>Your certificate</p>',
            attachments: [
                {
                    filename: 'certificate-AB12.pdf',
                    content: 'base64pdf',
                    contentType: 'application/pdf',
                },
            ],
        });

        const payload = sendMock.mock.calls[0][0] as {
            attachments: Array<Record<string, unknown>>;
        };
        expect(payload.attachments).toEqual([
            {
                content: 'base64pdf',
                filename: 'certificate-AB12.pdf',
                contentType: 'application/pdf',
            },
        ]);
        expect(payload.attachments[0]).not.toHaveProperty('contentId');
    });
});
