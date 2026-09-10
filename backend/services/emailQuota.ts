import { prisma } from '../db';

const DEFAULT_EMAIL_DAILY_LIMIT = 100;
const DEFAULT_EMAIL_MONTHLY_LIMIT = 3000;

/** Match finance.ts startOfDay — local wall-clock midnight. */
function startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function startOfMonth(date: Date): Date {
    const copy = startOfDay(date);
    copy.setDate(1);
    return copy;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}

export function getEmailDailyLimit(): number {
    return parsePositiveInt(process.env.EMAIL_DAILY_LIMIT, DEFAULT_EMAIL_DAILY_LIMIT);
}

export function getEmailMonthlyLimit(): number {
    return parsePositiveInt(process.env.EMAIL_MONTHLY_LIMIT, DEFAULT_EMAIL_MONTHLY_LIMIT);
}

export type EmailQuotaStatus = {
    dailyLimit: number;
    monthlyLimit: number;
    dailyUsed: number;
    monthlyUsed: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    dayStart: Date;
    monthStart: Date;
};

export async function getQuotaStatus(now: Date = new Date()): Promise<EmailQuotaStatus> {
    const dayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const dailyLimit = getEmailDailyLimit();
    const monthlyLimit = getEmailMonthlyLimit();

    const [dailyUsed, monthlyUsed] = await Promise.all([
        prisma.emailOutbox.count({
            where: {
                sentAt: { not: null, gte: dayStart },
            },
        }),
        prisma.emailOutbox.count({
            where: {
                sentAt: { not: null, gte: monthStart },
            },
        }),
    ]);

    return {
        dailyLimit,
        monthlyLimit,
        dailyUsed,
        monthlyUsed,
        dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
        monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
        dayStart,
        monthStart,
    };
}

export async function hasQuotaRemaining(
    count = 1,
    now: Date = new Date(),
): Promise<boolean> {
    const needed = Math.max(1, Math.floor(count));
    const status = await getQuotaStatus(now);
    return status.dailyRemaining >= needed && status.monthlyRemaining >= needed;
}

/**
 * Detect Resend account quota / daily / monthly limit errors (distinct from transient 429 rate limits).
 * Generic rate-limit messages without quota wording are NOT treated as quota.
 */
export function isEmailQuotaError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const message =
        error instanceof Error
            ? error.message
            : 'message' in error && typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : '';
    const lower = message.toLowerCase();

    if (
        lower.includes('daily quota')
        || lower.includes('monthly quota')
        || lower.includes('quota exceeded')
        || lower.includes('email quota')
        || (lower.includes('quota') && (lower.includes('daily') || lower.includes('monthly')))
        || lower.includes('daily limit')
        || lower.includes('monthly limit')
        || lower.includes('sending limit')
    ) {
        return true;
    }

    const name =
        'name' in error && typeof (error as { name?: unknown }).name === 'string'
            ? (error as { name: string }).name.toLowerCase()
            : '';
    return name.includes('quota') || (name.includes('validation_error') && lower.includes('limit'));
}
