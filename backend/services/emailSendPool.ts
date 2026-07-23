const DEFAULT_EMAIL_SEND_CONCURRENCY = 8;
const MIN_EMAIL_SEND_CONCURRENCY = 1;
const MAX_EMAIL_SEND_CONCURRENCY = 20;

let activeCount = 0;
const waitQueue: Array<() => void> = [];

export function getEmailSendConcurrency(): number {
    const raw = Number.parseInt(process.env.EMAIL_SEND_CONCURRENCY ?? '', 10);
    if (!Number.isFinite(raw)) {
        return DEFAULT_EMAIL_SEND_CONCURRENCY;
    }
    return Math.min(
        MAX_EMAIL_SEND_CONCURRENCY,
        Math.max(MIN_EMAIL_SEND_CONCURRENCY, raw),
    );
}

async function acquireEmailSlot(): Promise<void> {
    if (activeCount < getEmailSendConcurrency()) {
        activeCount += 1;
        return;
    }

    await new Promise<void>((resolve) => {
        waitQueue.push(resolve);
    });
}

function releaseEmailSlot(): void {
    const next = waitQueue.shift();
    if (next) {
        next();
        return;
    }
    activeCount = Math.max(0, activeCount - 1);
}

/** Run a single email-related job under the shared concurrency cap. */
export async function runEmailJob<T>(fn: () => Promise<T>): Promise<T> {
    await acquireEmailSlot();
    try {
        return await fn();
    } finally {
        releaseEmailSlot();
    }
}

/**
 * Map an array with the shared email concurrency limit.
 * Rejects only if the mapper throws; callers should catch per-item to preserve success/failure.
 */
export async function mapWithEmailConcurrency<T, R>(
    items: readonly T[],
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const tasks: Array<Promise<R>> = items.map((item, index) =>
        runEmailJob(() => mapper(item, index)),
    );
    return Promise.all(tasks);
}
