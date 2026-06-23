import { Resend } from 'resend';

const DEFAULT_FROM_EMAIL = 'asu.medicine.iclub@gmail.com';

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
    contentId: string;
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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
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
        contentId: attachment.contentId,
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
        throw new Error(error.message || 'Failed to send email');
    }

    if (!data?.id) {
        throw new Error('Failed to send email');
    }

    return { id: data.id };
}
