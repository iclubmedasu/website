import { randomUUID } from 'node:crypto';
import type { EmailOutbox, EmailOutboxKind, EmailOutboxStatus } from '@prisma/client';
import { prisma } from '../db';

export const EMAIL_OUTBOX_MAX_ATTEMPTS = 5;

/** Interactive txn limits for bulk enqueue (route caps at 2000 ids; remote DB latency). */
const ENQUEUE_TX_TIMEOUT_MS = 30_000;
const ENQUEUE_TX_MAX_WAIT_MS = 10_000;

/** Prisma createMany payloads stay manageable against Postgres parameter limits. */
const CREATE_MANY_CHUNK_SIZE = 500;

type NudgeFn = () => void;

let nudgeFn: NudgeFn = () => {};

export function setEmailOutboxNudge(fn: NudgeFn): void {
    nudgeFn = fn;
}

export function nudgeEmailOutboxWorker(): void {
    nudgeFn();
}

export type EmailOutboxBatchStatusCounts = {
    batchId: string;
    total: number;
    sent: number;
    failed: number;
    pending: number;
    processing: number;
};

export async function resetStuckProcessingJobs(): Promise<number> {
    const result = await prisma.emailOutbox.updateMany({
        where: { status: 'PROCESSING' },
        data: { status: 'PENDING' },
    });
    return result.count;
}

export async function enqueueEmailJobs(options: {
    kind: EmailOutboxKind;
    entityIds: number[];
    context: string;
    batchId?: string;
}): Promise<{ batchId: string; queued: number }> {
    const uniqueIds = [...new Set(options.entityIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (uniqueIds.length === 0) {
        return { batchId: options.batchId ?? randomUUID(), queued: 0 };
    }

    const batchId = options.batchId ?? randomUUID();

    const queued = await prisma.$transaction(
        async (tx) => {
            const active = await tx.emailOutbox.findMany({
                where: {
                    kind: options.kind,
                    entityId: { in: uniqueIds },
                    status: { in: ['PENDING', 'PROCESSING'] },
                },
                select: { entityId: true },
            });

            const activeEntityIds = [...new Set(active.map((row) => row.entityId))];

            if (activeEntityIds.length > 0) {
                await tx.emailOutbox.updateMany({
                    where: {
                        kind: options.kind,
                        entityId: { in: activeEntityIds },
                        status: { in: ['PENDING', 'PROCESSING'] },
                    },
                    data: {
                        batchId,
                        context: options.context,
                    },
                });
            }

            const activeSet = new Set(activeEntityIds);
            const missingIds = uniqueIds.filter((id) => !activeSet.has(id));

            for (let i = 0; i < missingIds.length; i += CREATE_MANY_CHUNK_SIZE) {
                const chunk = missingIds.slice(i, i + CREATE_MANY_CHUNK_SIZE);
                await tx.emailOutbox.createMany({
                    data: chunk.map((entityId) => ({
                        batchId,
                        kind: options.kind,
                        entityId,
                        context: options.context,
                        status: 'PENDING' as const,
                    })),
                });
            }

            return uniqueIds.length;
        },
        { maxWait: ENQUEUE_TX_MAX_WAIT_MS, timeout: ENQUEUE_TX_TIMEOUT_MS },
    );

    if (queued > 0) {
        nudgeEmailOutboxWorker();
    }

    return { batchId, queued };
}

export async function enqueueEmailJob(
    kind: EmailOutboxKind,
    entityId: number,
    context: string,
    batchId?: string,
): Promise<{ batchId: string; queued: number }> {
    return enqueueEmailJobs({ kind, entityIds: [entityId], context, batchId });
}

/**
 * Announcement broadcast: one outbox row per recipient.
 * Does NOT reuse PENDING/PROCESSING by (kind, entityId) — that would collapse all recipients into one row.
 */
export async function queueAnnouncementBroadcast(options: {
    announcementId: number;
    recipients: Array<{ email: string }>;
    subject: string;
    htmlBody: string;
    batchId?: string;
}): Promise<{ batchId: string; queued: number }> {
    const announcementId = options.announcementId;
    if (!Number.isFinite(announcementId) || announcementId <= 0) {
        return { batchId: options.batchId ?? randomUUID(), queued: 0 };
    }

    const recipients = options.recipients
        .map((r) => ({ email: r.email.trim() }))
        .filter((r) => r.email.length > 0);
    if (recipients.length === 0) {
        return { batchId: options.batchId ?? randomUUID(), queued: 0 };
    }

    const batchId = options.batchId ?? randomUUID();
    const subject = options.subject;
    const htmlBody = options.htmlBody;

    const queued = await prisma.$transaction(
        async (tx) => {
            const rows = recipients.map((recipient) => ({
                batchId,
                kind: 'ANNOUNCEMENT' as const,
                entityId: announcementId,
                context: JSON.stringify({
                    email: recipient.email,
                    subject,
                    htmlBody,
                }),
                status: 'PENDING' as const,
            }));

            for (let i = 0; i < rows.length; i += CREATE_MANY_CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CREATE_MANY_CHUNK_SIZE);
                await tx.emailOutbox.createMany({ data: chunk });
            }

            return rows.length;
        },
        { maxWait: ENQUEUE_TX_MAX_WAIT_MS, timeout: ENQUEUE_TX_TIMEOUT_MS },
    );

    if (queued > 0) {
        nudgeEmailOutboxWorker();
    }

    return { batchId, queued };
}

type ClaimedOutboxRow = {
    id: number;
    batchId: string;
    kind: EmailOutboxKind;
    entityId: number;
    context: string;
    status: EmailOutboxStatus;
    attempts: number;
    lastError: string | null;
    resendMessageId: string | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export async function claimPendingEmailJobs(limit: number): Promise<EmailOutbox[]> {
    const take = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = await prisma.$queryRaw<ClaimedOutboxRow[]>`
        UPDATE "EmailOutbox"
        SET
            status = 'PROCESSING'::"EmailOutboxStatus",
            "updatedAt" = NOW()
        WHERE id IN (
            SELECT id
            FROM "EmailOutbox"
            WHERE status = 'PENDING'::"EmailOutboxStatus"
            ORDER BY "createdAt" ASC
            LIMIT ${take}
            FOR UPDATE SKIP LOCKED
        )
        RETURNING
            id,
            "batchId",
            kind,
            "entityId",
            context,
            status,
            attempts,
            "lastError",
            "resendMessageId",
            "sentAt",
            "createdAt",
            "updatedAt"
    `;

    return rows as EmailOutbox[];
}

export async function markEmailJobSent(
    id: number,
    options?: { resendMessageId?: string | null },
): Promise<void> {
    await prisma.emailOutbox.update({
        where: { id },
        data: {
            status: 'SENT',
            lastError: null,
            sentAt: new Date(),
            ...(options?.resendMessageId
                ? { resendMessageId: options.resendMessageId }
                : {}),
        },
    });
}

export async function markEmailJobFailure(
    job: Pick<EmailOutbox, 'id' | 'attempts'>,
    error: unknown,
): Promise<'PENDING' | 'FAILED'> {
    const message = error instanceof Error ? error.message : String(error);
    const nextAttempts = job.attempts + 1;
    const status: EmailOutboxStatus =
        nextAttempts >= EMAIL_OUTBOX_MAX_ATTEMPTS ? 'FAILED' : 'PENDING';

    await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
            status,
            attempts: nextAttempts,
            lastError: message.slice(0, 2000),
        },
    });

    return status;
}

/** Release a PROCESSING job back to PENDING without consuming an attempt (quota/limit errors). */
export async function releaseEmailJobWithoutAttempt(
    job: Pick<EmailOutbox, 'id'>,
    error: unknown,
): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
            status: 'PENDING',
            lastError: message.slice(0, 2000),
        },
    });
}

export async function getEmailOutboxBatchStatus(
    batchId: string,
): Promise<EmailOutboxBatchStatusCounts | null> {
    const trimmed = batchId.trim();
    if (!trimmed) return null;

    const grouped = await prisma.emailOutbox.groupBy({
        by: ['status'],
        where: { batchId: trimmed },
        _count: { _all: true },
    });

    if (grouped.length === 0) {
        return null;
    }

    const counts: Record<EmailOutboxStatus, number> = {
        PENDING: 0,
        PROCESSING: 0,
        SENT: 0,
        FAILED: 0,
    };

    for (const row of grouped) {
        counts[row.status] = row._count._all;
    }

    const total = counts.PENDING + counts.PROCESSING + counts.SENT + counts.FAILED;

    return {
        batchId: trimmed,
        total,
        sent: counts.SENT,
        failed: counts.FAILED,
        pending: counts.PENDING,
        processing: counts.PROCESSING,
    };
}
