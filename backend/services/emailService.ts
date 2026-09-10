import { Resend } from 'resend';

const DEFAULT_FROM_EMAIL = 'asu.medicine.iclub@gmail.com';
const RATE_LIMIT_BACKOFFS_MS = [500, 1500] as const;
/** Conservative gap between any Resend API calls (team rate limit). */
export const RESEND_MIN_INTERVAL_MS = 550;

let resendClient: Resend | null = null;
let lastResendCallAt = 0;
let pacingTail: Promise<void> = Promise.resolve();

function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
        console.warn('RESEND_API_KEY is not configured; email sending is disabled.');
        throw new Error('Email service is not configured');
    }

    if (!resendClient) {
        resendClient = new Resend(apiKey);
    }

    return resendClient;
}

function getFromEmail(): string {
    return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
}

function getReplyToEmail(): string | undefined {
    const replyTo = process.env.RESEND_REPLY_TO?.trim();
    return replyTo || undefined;
}

export interface EmailAttachment {
    filename: string;
    content: string;
    /** Omit for regular file attachments (e.g. PDF). Include for CID inline images. */
    contentId?: string;
    contentType?: string;
}

export interface SendEmailInput {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
}

export interface SendEmailResult {
    id: string;
}

export interface SendEmailBatchResult {
    ids: Array<string | null>;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/** Serialize Resend calls with ≥ RESEND_MIN_INTERVAL_MS between starts. */
async function withResendPacing<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const previous = pacingTail;
    pacingTail = gate;

    await previous;

    try {
        if (lastResendCallAt > 0) {
            const wait = Math.max(0, RESEND_MIN_INTERVAL_MS - (Date.now() - lastResendCallAt));
            if (wait > 0) {
                await delay(wait);
            }
        }
        lastResendCallAt = Date.now();
        return await fn();
    } finally {
        release();
    }
}

/** Exposed for tests. */
export function resetResendPacingForTests(): void {
    lastResendCallAt = 0;
    pacingTail = Promise.resolve();
    resendClient = null;
}

function isRateLimitError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const statusCode =
        'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
            ? (error as { statusCode: number }).statusCode
            : 'status' in error && typeof (error as { status?: unknown }).status === 'number'
                ? (error as { status: number }).status
                : undefined;
    if (statusCode === 429) {
        return true;
    }

    const message =
        error instanceof Error
            ? error.message
            : 'message' in error && typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : '';
    const lower = message.toLowerCase();
    return (
        lower.includes('429')
        || lower.includes('rate limit')
        || lower.includes('too many requests')
    );
}

function toEmailError(error: {
    message?: string | null;
    statusCode?: number | null;
    name?: string;
}): Error {
    const err = new Error(error.message || 'Failed to send email');
    if (typeof error.statusCode === 'number') {
        (err as Error & { statusCode: number }).statusCode = error.statusCode;
    }
    if (error.name) {
        err.name = error.name;
    }
    return err;
}

async function sendEmailOnce(input: SendEmailInput): Promise<SendEmailResult> {
    const to = input.to.trim();
    if (!to) {
        throw new Error('Recipient email is required');
    }

    return withResendPacing(async () => {
        const client = getResendClient();
        const replyTo = input.replyTo?.trim() || getReplyToEmail();
        const attachments = input.attachments?.map((attachment) => {
            if (attachment.contentId) {
                return {
                    content: attachment.content,
                    filename: attachment.filename,
                    contentType: attachment.contentType ?? 'image/png',
                    contentId: attachment.contentId,
                };
            }

            return {
                content: attachment.content,
                filename: attachment.filename,
                ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
            };
        });
        const { data, error } = await client.emails.send({
            from: getFromEmail(),
            to,
            subject: input.subject,
            html: input.html,
            ...(replyTo ? { replyTo } : {}),
            ...(attachments?.length ? { attachments } : {}),
        });

        if (error) {
            throw toEmailError(error);
        }

        if (!data?.id) {
            throw new Error('Failed to send email');
        }

        return { id: data.id };
    });
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFFS_MS.length; attempt += 1) {
        try {
            return await sendEmailOnce(input);
        } catch (error) {
            lastError = error;
            if (attempt >= RATE_LIMIT_BACKOFFS_MS.length || !isRateLimitError(error)) {
                throw error;
            }
            await delay(RATE_LIMIT_BACKOFFS_MS[attempt]);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to send email');
}

function normalizeBatchIds(data: unknown, expectedCount: number): Array<string | null> {
    const ids: Array<string | null> = Array.from({ length: expectedCount }, () => null);

    if (Array.isArray(data)) {
        data.forEach((item, index) => {
            if (index >= expectedCount) return;
            if (typeof item === 'string') {
                ids[index] = item;
                return;
            }
            if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
                ids[index] = (item as { id: string }).id;
            }
        });
        return ids;
    }

    if (
        data
        && typeof data === 'object'
        && Array.isArray((data as { data?: unknown }).data)
    ) {
        return normalizeBatchIds((data as { data: unknown[] }).data, expectedCount);
    }

    return ids;
}

async function sendEmailBatchOnce(inputs: SendEmailInput[]): Promise<SendEmailBatchResult> {
    if (inputs.length === 0) {
        return { ids: [] };
    }
    if (inputs.length > 100) {
        throw new Error('Email batch cannot exceed 100 messages');
    }

    for (const input of inputs) {
        if (!input.to.trim()) {
            throw new Error('Recipient email is required');
        }
    }

    return withResendPacing(async () => {
        const client = getResendClient();
        const defaultReplyTo = getReplyToEmail();
        const payload = inputs.map((input) => {
            const replyTo = input.replyTo?.trim() || defaultReplyTo;
            return {
                from: getFromEmail(),
                to: input.to.trim(),
                subject: input.subject,
                html: input.html,
                ...(replyTo ? { replyTo } : {}),
            };
        });

        const { data, error } = await client.batch.send(payload);

        if (error) {
            throw toEmailError(error);
        }

        const ids = normalizeBatchIds(data, inputs.length);
        if (ids.every((id) => !id)) {
            throw new Error('Failed to send email batch');
        }

        return { ids };
    });
}

/** Send up to 100 emails via Resend POST /emails/batch. No attachments. */
export async function sendEmailBatch(inputs: SendEmailInput[]): Promise<SendEmailBatchResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFFS_MS.length; attempt += 1) {
        try {
            return await sendEmailBatchOnce(inputs);
        } catch (error) {
            lastError = error;
            if (attempt >= RATE_LIMIT_BACKOFFS_MS.length || !isRateLimitError(error)) {
                throw error;
            }
            await delay(RATE_LIMIT_BACKOFFS_MS[attempt]);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to send email batch');
}
