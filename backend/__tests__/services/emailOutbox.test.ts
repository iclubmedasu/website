import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    emailOutboxFindFirst: vi.fn(),
    emailOutboxCreate: vi.fn(),
    emailOutboxUpdate: vi.fn(),
    emailOutboxUpdateMany: vi.fn(),
    emailOutboxGroupBy: vi.fn(),
    emailOutboxCount: vi.fn(),
    transaction: vi.fn(),
    queryRaw: vi.fn(),
}));

const sendMocks = vi.hoisted(() => ({
    sendEventTicketEmail: vi.fn(),
    sendEventReminderEmail: vi.fn(),
    sendCertificateEmail: vi.fn(),
}));

const emailServiceMocks = vi.hoisted(() => ({
    sendEmailBatch: vi.fn(),
}));

const quotaMocks = vi.hoisted(() => ({
    getQuotaStatus: vi.fn(),
    isEmailQuotaError: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        emailOutbox: {
            findFirst: prismaMocks.emailOutboxFindFirst,
            create: prismaMocks.emailOutboxCreate,
            update: prismaMocks.emailOutboxUpdate,
            updateMany: prismaMocks.emailOutboxUpdateMany,
            groupBy: prismaMocks.emailOutboxGroupBy,
            count: prismaMocks.emailOutboxCount,
        },
        $transaction: prismaMocks.transaction,
        $queryRaw: prismaMocks.queryRaw,
    },
}));

vi.mock('../../services/eventTicketEmailService', () => ({
    sendEventTicketEmail: sendMocks.sendEventTicketEmail,
    sendEventReminderEmail: sendMocks.sendEventReminderEmail,
    queueTicketEmail: vi.fn(),
    queueReminderEmail: vi.fn(),
    enqueueTicketEmails: vi.fn(),
    enqueueReminderEmails: vi.fn(),
}));

vi.mock('../../services/certificateEmailService', () => ({
    sendCertificateEmail: sendMocks.sendCertificateEmail,
    queueCertificateEmail: vi.fn(),
    enqueueCertificateEmails: vi.fn(),
}));

vi.mock('../../services/emailSendPool', () => ({
    getEmailSendConcurrency: () => 8,
    runEmailJob: async <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock('../../services/emailService', () => ({
    sendEmailBatch: emailServiceMocks.sendEmailBatch,
    sendEmail: vi.fn(),
}));

vi.mock('../../services/emailQuota', () => ({
    getQuotaStatus: quotaMocks.getQuotaStatus,
    isEmailQuotaError: quotaMocks.isEmailQuotaError,
    hasQuotaRemaining: vi.fn(),
}));

import {
    enqueueEmailJobs,
    getEmailOutboxBatchStatus,
    queueAnnouncementBroadcast,
    resetStuckProcessingJobs,
} from '../../services/emailOutbox';
import {
    drainEmailOutboxOnceForTests,
    resetEmailOutboxWorkerQuotaPauseForTests,
} from '../../services/emailOutboxWorker';

function quotaOk(overrides: Partial<{
    dailyRemaining: number;
    monthlyRemaining: number;
    dailyLimit: number;
    monthlyLimit: number;
}> = {}) {
    return {
        dailyLimit: overrides.dailyLimit ?? 100,
        monthlyLimit: overrides.monthlyLimit ?? 3000,
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyRemaining: overrides.dailyRemaining ?? 100,
        monthlyRemaining: overrides.monthlyRemaining ?? 3000,
        dayStart: new Date(),
        monthStart: new Date(),
    };
}

describe('emailOutbox', () => {
    beforeEach(() => {
        resetEmailOutboxWorkerQuotaPauseForTests();
        quotaMocks.getQuotaStatus.mockResolvedValue(quotaOk());
        quotaMocks.isEmailQuotaError.mockReturnValue(false);
        prismaMocks.transaction.mockImplementation(async (fn: (tx: {
            emailOutbox: {
                findFirst: typeof prismaMocks.emailOutboxFindFirst;
                create: typeof prismaMocks.emailOutboxCreate;
                update: typeof prismaMocks.emailOutboxUpdate;
            };
        }) => Promise<unknown>) => fn({
            emailOutbox: {
                findFirst: prismaMocks.emailOutboxFindFirst,
                create: prismaMocks.emailOutboxCreate,
                update: prismaMocks.emailOutboxUpdate,
            },
        }));
        prismaMocks.emailOutboxFindFirst.mockResolvedValue(null);
        prismaMocks.emailOutboxCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: 1,
            ...data,
        }));
        prismaMocks.emailOutboxUpdate.mockResolvedValue({});
        prismaMocks.emailOutboxUpdateMany.mockResolvedValue({ count: 0 });
        sendMocks.sendEventTicketEmail.mockResolvedValue(undefined);
        sendMocks.sendEventReminderEmail.mockResolvedValue(undefined);
        sendMocks.sendCertificateEmail.mockResolvedValue(undefined);
        emailServiceMocks.sendEmailBatch.mockResolvedValue({ ids: [] });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('enqueues PENDING outbox rows with a shared batchId', async () => {
        const result = await enqueueEmailJobs({
            kind: 'TICKET',
            entityIds: [10, 11],
            context: 'test-bulk',
        });

        expect(result.queued).toBe(2);
        expect(result.batchId).toBeTruthy();
        expect(prismaMocks.emailOutboxCreate).toHaveBeenCalledTimes(2);
        expect(prismaMocks.emailOutboxCreate.mock.calls[0][0].data).toEqual(
            expect.objectContaining({
                batchId: result.batchId,
                kind: 'TICKET',
                entityId: 10,
                context: 'test-bulk',
                status: 'PENDING',
            }),
        );
        expect(prismaMocks.emailOutboxCreate.mock.calls[1][0].data.entityId).toBe(11);
        expect(prismaMocks.emailOutboxCreate.mock.calls[1][0].data.batchId).toBe(result.batchId);
    });

    it('reuses existing PENDING/PROCESSING rows and reassigns batchId', async () => {
        prismaMocks.emailOutboxFindFirst.mockResolvedValueOnce({
            id: 55,
            kind: 'TICKET',
            entityId: 10,
            status: 'PENDING',
        });

        const result = await enqueueEmailJobs({
            kind: 'TICKET',
            entityIds: [10],
            context: 'retry-bulk',
            batchId: 'shared-batch',
        });

        expect(result).toEqual({ batchId: 'shared-batch', queued: 1 });
        expect(prismaMocks.emailOutboxCreate).not.toHaveBeenCalled();
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 55 },
            data: { batchId: 'shared-batch', context: 'retry-bulk' },
        });
    });

    it('queueAnnouncementBroadcast inserts one row per recipient without kind+entityId dedupe', async () => {
        const result = await queueAnnouncementBroadcast({
            announcementId: 42,
            recipients: [
                { email: 'a@example.com' },
                { email: 'b@example.com' },
                { email: '  c@example.com  ' },
            ],
            subject: 'Hello',
            htmlBody: '<p>Hi</p>',
        });

        expect(result.queued).toBe(3);
        expect(result.batchId).toBeTruthy();
        expect(prismaMocks.emailOutboxFindFirst).not.toHaveBeenCalled();
        expect(prismaMocks.emailOutboxCreate).toHaveBeenCalledTimes(3);

        const contexts = prismaMocks.emailOutboxCreate.mock.calls.map(
            (call: [{ data: { context: string; batchId: string; kind: string; entityId: number } }]) =>
                JSON.parse(call[0].data.context) as { email: string },
        );
        expect(contexts.map((c) => c.email)).toEqual([
            'a@example.com',
            'b@example.com',
            'c@example.com',
        ]);
        for (const call of prismaMocks.emailOutboxCreate.mock.calls) {
            expect(call[0].data).toEqual(
                expect.objectContaining({
                    batchId: result.batchId,
                    kind: 'ANNOUNCEMENT',
                    entityId: 42,
                    status: 'PENDING',
                }),
            );
        }
    });

    it('TICKET enqueue still dedupes by kind+entityId after announcement path exists', async () => {
        prismaMocks.emailOutboxFindFirst.mockResolvedValueOnce({
            id: 77,
            kind: 'TICKET',
            entityId: 10,
            status: 'PENDING',
        });

        await enqueueEmailJobs({
            kind: 'TICKET',
            entityIds: [10],
            context: 'still-dedupe',
            batchId: 't-batch',
        });

        expect(prismaMocks.emailOutboxCreate).not.toHaveBeenCalled();
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 77 },
            data: { batchId: 't-batch', context: 'still-dedupe' },
        });
    });

    it('worker marks claimed jobs SENT with sentAt and resendMessageId', async () => {
        prismaMocks.queryRaw.mockResolvedValueOnce([
            {
                id: 7,
                batchId: 'b1',
                kind: 'TICKET',
                entityId: 101,
                context: 'test',
                status: 'PROCESSING',
                attempts: 0,
                lastError: null,
                resendMessageId: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        sendMocks.sendEventTicketEmail.mockResolvedValueOnce({ id: 're_msg_abc' });

        const processed = await drainEmailOutboxOnceForTests();

        expect(processed).toBe(1);
        expect(sendMocks.sendEventTicketEmail).toHaveBeenCalledWith(101);
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 7 },
            data: expect.objectContaining({
                status: 'SENT',
                lastError: null,
                resendMessageId: 're_msg_abc',
                sentAt: expect.any(Date),
            }),
        });
    });

    it('claims zero jobs when quota is exhausted and logs pause once', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        quotaMocks.getQuotaStatus.mockResolvedValue(quotaOk({ dailyRemaining: 0, monthlyRemaining: 50 }));

        const first = await drainEmailOutboxOnceForTests();
        const second = await drainEmailOutboxOnceForTests();

        expect(first).toBe(0);
        expect(second).toBe(0);
        expect(prismaMocks.queryRaw).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toMatch(/paused — quota exhausted/);
        warnSpy.mockRestore();
    });

    it('caps claim size by remaining quota', async () => {
        quotaMocks.getQuotaStatus.mockResolvedValue(quotaOk({ dailyRemaining: 2, monthlyRemaining: 100 }));
        prismaMocks.queryRaw.mockResolvedValueOnce([]);

        await drainEmailOutboxOnceForTests();

        // claimPendingEmailJobs receives min(concurrency=8, remaining=2)
        const sqlChunks = prismaMocks.queryRaw.mock.calls[0];
        expect(sqlChunks).toBeTruthy();
        // Tagged template args: strings + values; limit is last interpolated value
        const values = sqlChunks.slice(1);
        expect(values).toContain(2);
    });

    it('releases quota errors to PENDING without incrementing attempts', async () => {
        prismaMocks.queryRaw.mockResolvedValueOnce([
            {
                id: 9,
                batchId: 'b1',
                kind: 'TICKET',
                entityId: 202,
                context: 'test',
                status: 'PROCESSING',
                attempts: 2,
                lastError: null,
                resendMessageId: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        sendMocks.sendEventTicketEmail.mockRejectedValueOnce(new Error('Monthly quota exceeded'));
        quotaMocks.isEmailQuotaError.mockReturnValue(true);

        const processed = await drainEmailOutboxOnceForTests();

        expect(processed).toBe(1);
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 9 },
            data: {
                status: 'PENDING',
                lastError: 'Monthly quota exceeded',
            },
        });
        expect(prismaMocks.emailOutboxUpdate).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ attempts: expect.anything() }),
            }),
        );
    });

    it('sends ANNOUNCEMENT jobs via sendEmailBatch and marks per-index ids', async () => {
        prismaMocks.queryRaw.mockResolvedValueOnce([
            {
                id: 1,
                batchId: 'ann-1',
                kind: 'ANNOUNCEMENT',
                entityId: 42,
                context: JSON.stringify({ email: 'a@x.com', subject: 'S', htmlBody: '<p>A</p>' }),
                status: 'PROCESSING',
                attempts: 0,
                lastError: null,
                resendMessageId: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 2,
                batchId: 'ann-1',
                kind: 'ANNOUNCEMENT',
                entityId: 42,
                context: JSON.stringify({ email: 'b@x.com', subject: 'S', htmlBody: '<p>B</p>' }),
                status: 'PROCESSING',
                attempts: 0,
                lastError: null,
                resendMessageId: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        emailServiceMocks.sendEmailBatch.mockResolvedValueOnce({ ids: ['id-a', 'id-b'] });

        const processed = await drainEmailOutboxOnceForTests();

        expect(processed).toBe(2);
        expect(emailServiceMocks.sendEmailBatch).toHaveBeenCalledWith([
            { to: 'a@x.com', subject: 'S', html: '<p>A</p>' },
            { to: 'b@x.com', subject: 'S', html: '<p>B</p>' },
        ]);
        expect(sendMocks.sendEventTicketEmail).not.toHaveBeenCalled();
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 1 },
            data: expect.objectContaining({
                status: 'SENT',
                resendMessageId: 'id-a',
                sentAt: expect.any(Date),
            }),
        });
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 2 },
            data: expect.objectContaining({
                status: 'SENT',
                resendMessageId: 'id-b',
                sentAt: expect.any(Date),
            }),
        });
    });

    it('on ANNOUNCEMENT batch HTTP failure retries whole chunk via attempts++', async () => {
        prismaMocks.queryRaw.mockResolvedValueOnce([
            {
                id: 3,
                batchId: 'ann-2',
                kind: 'ANNOUNCEMENT',
                entityId: 42,
                context: JSON.stringify({ email: 'a@x.com', subject: 'S', htmlBody: '<p>A</p>' }),
                status: 'PROCESSING',
                attempts: 0,
                lastError: null,
                resendMessageId: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 4,
                batchId: 'ann-2',
                kind: 'ANNOUNCEMENT',
                entityId: 42,
                context: JSON.stringify({ email: 'b@x.com', subject: 'S', htmlBody: '<p>B</p>' }),
                status: 'PROCESSING',
                attempts: 1,
                lastError: null,
                resendMessageId: null,
                sentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        emailServiceMocks.sendEmailBatch.mockRejectedValueOnce(new Error('Invalid batch payload'));
        quotaMocks.isEmailQuotaError.mockReturnValue(false);

        await drainEmailOutboxOnceForTests();

        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 3 },
            data: expect.objectContaining({
                status: 'PENDING',
                attempts: 1,
                lastError: 'Invalid batch payload',
            }),
        });
        expect(prismaMocks.emailOutboxUpdate).toHaveBeenCalledWith({
            where: { id: 4 },
            data: expect.objectContaining({
                status: 'PENDING',
                attempts: 2,
                lastError: 'Invalid batch payload',
            }),
        });
    });

    it('resets stuck PROCESSING jobs to PENDING', async () => {
        prismaMocks.emailOutboxUpdateMany.mockResolvedValueOnce({ count: 3 });
        const count = await resetStuckProcessingJobs();
        expect(count).toBe(3);
        expect(prismaMocks.emailOutboxUpdateMany).toHaveBeenCalledWith({
            where: { status: 'PROCESSING' },
            data: { status: 'PENDING' },
        });
    });

    it('returns batch status counts', async () => {
        prismaMocks.emailOutboxGroupBy.mockResolvedValueOnce([
            { status: 'SENT', _count: { _all: 4 } },
            { status: 'FAILED', _count: { _all: 1 } },
            { status: 'PENDING', _count: { _all: 2 } },
            { status: 'PROCESSING', _count: { _all: 1 } },
        ]);

        const status = await getEmailOutboxBatchStatus('batch-xyz');
        expect(status).toEqual({
            batchId: 'batch-xyz',
            total: 8,
            sent: 4,
            failed: 1,
            pending: 2,
            processing: 1,
        });
    });

    it('returns null for unknown batch', async () => {
        prismaMocks.emailOutboxGroupBy.mockResolvedValueOnce([]);
        await expect(getEmailOutboxBatchStatus('missing')).resolves.toBeNull();
    });
});
