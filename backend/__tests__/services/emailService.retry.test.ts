import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
const batchSendMock = vi.fn();

vi.mock('resend', () => ({
    Resend: vi.fn().mockImplementation(() => ({
        emails: {
            send: sendMock,
        },
        batch: {
            send: batchSendMock,
        },
    })),
}));

describe('emailService sendEmail rate-limit retry', () => {
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.RESEND_FROM_EMAIL;

    beforeEach(async () => {
        vi.resetModules();
        sendMock.mockReset();
        batchSendMock.mockReset();
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'from@example.com';
        vi.useFakeTimers();
        const { resetResendPacingForTests } = await import('../../services/emailService');
        resetResendPacingForTests();
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

        // rate-limit backoff 500ms + possible pacing remainder
        await vi.advanceTimersByTimeAsync(2000);
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

    beforeEach(async () => {
        vi.resetModules();
        sendMock.mockReset();
        batchSendMock.mockReset();
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'from@example.com';
        const { resetResendPacingForTests } = await import('../../services/emailService');
        resetResendPacingForTests();
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

describe('emailService sendEmailBatch and pacing', () => {
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.RESEND_FROM_EMAIL;

    beforeEach(async () => {
        vi.resetModules();
        sendMock.mockReset();
        batchSendMock.mockReset();
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'from@example.com';
        vi.useFakeTimers();
        const { resetResendPacingForTests } = await import('../../services/emailService');
        resetResendPacingForTests();
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

    it('sendEmailBatch returns per-index ids from Resend batch.send', async () => {
        batchSendMock.mockResolvedValueOnce({
            data: [{ id: 'b1' }, { id: 'b2' }],
            error: null,
        });

        const { sendEmailBatch } = await import('../../services/emailService');
        const result = await sendEmailBatch([
            { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
            { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
        ]);

        expect(result.ids).toEqual(['b1', 'b2']);
        expect(batchSendMock).toHaveBeenCalledTimes(1);
        expect(sendMock).not.toHaveBeenCalled();
    });

    it('enforces ≥550ms between Resend API calls', async () => {
        sendMock.mockResolvedValue({ data: { id: 's1' }, error: null });
        batchSendMock.mockResolvedValue({ data: [{ id: 'b1' }], error: null });

        const { sendEmail, sendEmailBatch, RESEND_MIN_INTERVAL_MS } = await import(
            '../../services/emailService'
        );

        const first = sendEmail({ to: 'a@example.com', subject: '1', html: '<p>1</p>' });
        await first;
        expect(sendMock).toHaveBeenCalledTimes(1);

        let batchDone = false;
        const second = sendEmailBatch([
            { to: 'b@example.com', subject: '2', html: '<p>2</p>' },
        ]).then((r) => {
            batchDone = true;
            return r;
        });

        await vi.advanceTimersByTimeAsync(RESEND_MIN_INTERVAL_MS - 1);
        expect(batchDone).toBe(false);
        expect(batchSendMock).toHaveBeenCalledTimes(0);

        await vi.advanceTimersByTimeAsync(1);
        await second;
        expect(batchSendMock).toHaveBeenCalledTimes(1);
    });
});
