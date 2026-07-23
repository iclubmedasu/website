import { Resend } from 'resend';

const DEFAULT_FROM_EMAIL = 'asu.medicine.iclub@gmail.com';
const RATE_LIMIT_BACKOFFS_MS = [500, 1500] as const;

let resendClient: Resend | null = null;

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

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
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

    const client = getResendClient();
    const replyTo = input.replyTo?.trim() || getReplyToEmail();
    const attachments = input.attachments?.map((attachment) => ({
        content: attachment.content,
        filename: attachment.filename,
        contentType: attachment.contentType ?? 'image/png',
        ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
    }));
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
