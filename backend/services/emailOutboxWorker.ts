import { runEmailJob } from './emailSendPool';
import {
    claimPendingEmailJobs,
    markEmailJobFailure,
    markEmailJobSent,
    releaseEmailJobWithoutAttempt,
    resetStuckProcessingJobs,
    setEmailOutboxNudge,
} from './emailOutbox';
import { getQuotaStatus, isEmailQuotaError } from './emailQuota';
import { sendEmailBatch, type SendEmailInput } from './emailService';
import type { EmailOutbox } from '@prisma/client';

const IDLE_POLL_MS = 2000;
const RETRY_BACKOFF_BASE_MS = 750;
const ANNOUNCEMENT_BATCH_MAX = 100;

let started = false;
let wakeResolver: (() => void) | null = null;
let wasQuotaPaused = false;

function signalWake(): void {
    const resolve = wakeResolver;
    wakeResolver = null;
    resolve?.();
}

function waitForWake(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            if (wakeResolver === finish) {
                wakeResolver = null;
            }
            clearTimeout(timer);
            resolve();
        };
        wakeResolver = finish;
        const timer = setTimeout(finish, timeoutMs);
    });
}

type AnnouncementContext = {
    email: string;
    subject: string;
    htmlBody: string;
};

function parseAnnouncementContext(raw: string): AnnouncementContext {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid announcement outbox context JSON');
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid announcement outbox context');
    }
    const email =
        'email' in parsed && typeof (parsed as { email?: unknown }).email === 'string'
            ? (parsed as { email: string }).email.trim()
            : '';
    const subject =
        'subject' in parsed && typeof (parsed as { subject?: unknown }).subject === 'string'
            ? (parsed as { subject: string }).subject
            : '';
    const htmlBody =
        'htmlBody' in parsed && typeof (parsed as { htmlBody?: unknown }).htmlBody === 'string'
            ? (parsed as { htmlBody: string }).htmlBody
            : '';
    if (!email) {
        throw new Error('Announcement outbox context missing email');
    }
    return { email, subject, htmlBody };
}

async function dispatchTransactionalEmailJob(job: EmailOutbox): Promise<{ id?: string } | void> {
    if (job.kind === 'TICKET') {
        const { sendEventTicketEmail } = await import('./eventTicketEmailService.js');
        return sendEventTicketEmail(job.entityId);
    }
    if (job.kind === 'REMINDER') {
        const { sendEventReminderEmail } = await import('./eventTicketEmailService.js');
        return sendEventReminderEmail(job.entityId);
    }
    if (job.kind === 'CERTIFICATE') {
        const { sendCertificateEmail } = await import('./certificateEmailService.js');
        return sendCertificateEmail(job.entityId);
    }
    throw new Error(`Unsupported transactional email outbox kind: ${job.kind}`);
}

async function processClaimedTransactionalJob(job: EmailOutbox): Promise<void> {
    try {
        const result = await dispatchTransactionalEmailJob(job);
        const resendMessageId =
            result && typeof result === 'object' && typeof result.id === 'string'
                ? result.id
                : undefined;
        await markEmailJobSent(job.id, { resendMessageId });
    } catch (error) {
        if (isEmailQuotaError(error)) {
            await releaseEmailJobWithoutAttempt(job, error);
            console.error(
                `Email outbox job ${job.id} (${job.kind}/${job.entityId}) hit Resend quota; left PENDING without consuming an attempt:`,
                error,
            );
            signalWake();
            return;
        }

        const status = await markEmailJobFailure(job, error);
        console.error(
            `Email outbox job ${job.id} (${job.kind}/${job.entityId}, ${job.context}) ${status === 'FAILED' ? 'failed permanently' : 'will retry'}:`,
            error,
        );
        if (status === 'PENDING') {
            const delay = Math.min(15_000, RETRY_BACKOFF_BASE_MS * (job.attempts + 1));
            setTimeout(() => signalWake(), delay);
        }
    }
}

async function processAnnouncementJobs(jobs: EmailOutbox[]): Promise<void> {
    if (jobs.length === 0) return;

    let payloads: SendEmailInput[];
    try {
        payloads = jobs.map((job) => {
            const ctx = parseAnnouncementContext(job.context);
            return {
                to: ctx.email,
                subject: ctx.subject,
                html: ctx.htmlBody,
            };
        });
    } catch (error) {
        // Context parse failure is per-job permanent-ish; fail each independently.
        await Promise.all(jobs.map((job) => markEmailJobFailure(job, error)));
        return;
    }

    try {
        const { ids } = await sendEmailBatch(payloads);
        await Promise.all(
            jobs.map((job, index) =>
                markEmailJobSent(job.id, {
                    resendMessageId: ids[index] ?? undefined,
                }),
            ),
        );
    } catch (error) {
        if (isEmailQuotaError(error)) {
            await Promise.all(jobs.map((job) => releaseEmailJobWithoutAttempt(job, error)));
            console.error(
                `Email outbox announcement batch (${jobs.length} jobs) hit Resend quota; left PENDING without consuming attempts:`,
                error,
            );
            signalWake();
            return;
        }

        const statuses = await Promise.all(jobs.map((job) => markEmailJobFailure(job, error)));
        console.error(
            `Email outbox announcement batch (${jobs.length} jobs) failed; chunk returned to PENDING/FAILED with attempts incremented:`,
            error,
        );
        if (statuses.some((status) => status === 'PENDING')) {
            const delay = Math.min(15_000, RETRY_BACKOFF_BASE_MS);
            setTimeout(() => signalWake(), delay);
        }
    }
}

async function drainOnce(): Promise<number> {
    const quota = await getQuotaStatus();
    const quotaRemaining = Math.min(quota.dailyRemaining, quota.monthlyRemaining);
    const paused = quotaRemaining <= 0;

    if (paused) {
        if (!wasQuotaPaused) {
            console.warn(
                `Email outbox: paused — quota exhausted (daily remaining ${quota.dailyRemaining}/${quota.dailyLimit}, monthly remaining ${quota.monthlyRemaining}/${quota.monthlyLimit}). PENDING jobs left unclaimed.`,
            );
            wasQuotaPaused = true;
        }
        return 0;
    }

    if (wasQuotaPaused) {
        console.info(
            `Email outbox: resumed — quota available (daily remaining ${quota.dailyRemaining}, monthly remaining ${quota.monthlyRemaining}).`,
        );
        wasQuotaPaused = false;
    }

    // Claim enough for announcement batching (≤100) while still respecting quota.
    // Transactional jobs still run under the email send pool after claim.
    const effectiveClaimLimit = Math.min(ANNOUNCEMENT_BATCH_MAX, quotaRemaining);
    if (effectiveClaimLimit <= 0) {
        return 0;
    }

    const claimed = await claimPendingEmailJobs(effectiveClaimLimit);
    if (claimed.length === 0) {
        return 0;
    }

    const announcements = claimed.filter((job) => job.kind === 'ANNOUNCEMENT');
    const transactional = claimed.filter((job) => job.kind !== 'ANNOUNCEMENT');

    await Promise.all([
        processAnnouncementJobs(announcements),
        ...transactional.map((job) => runEmailJob(() => processClaimedTransactionalJob(job))),
    ]);

    return claimed.length;
}

async function workerLoop(): Promise<void> {
    for (;;) {
        try {
            const processed = await drainOnce();
            if (processed === 0) {
                await waitForWake(IDLE_POLL_MS);
            }
        } catch (error) {
            console.error('Email outbox worker loop error:', error);
            await waitForWake(IDLE_POLL_MS);
        }
    }
}

/** Reset stuck PROCESSING rows and start the in-process drain loop (idempotent). */
export async function startEmailOutboxWorker(): Promise<void> {
    setEmailOutboxNudge(signalWake);

    try {
        const resetCount = await resetStuckProcessingJobs();
        if (resetCount > 0) {
            console.log(`Email outbox: reset ${resetCount} stuck PROCESSING job(s) to PENDING`);
        }
    } catch (error) {
        console.error('Email outbox: failed to reset stuck PROCESSING jobs:', error);
    }

    if (started) {
        signalWake();
        return;
    }
    started = true;
    void workerLoop();
}

/** Exposed for tests — process currently PENDING jobs once. */
export async function drainEmailOutboxOnceForTests(): Promise<number> {
    return drainOnce();
}

/** Exposed for tests — reset in-memory quota-pause flag. */
export function resetEmailOutboxWorkerQuotaPauseForTests(): void {
    wasQuotaPaused = false;
}
