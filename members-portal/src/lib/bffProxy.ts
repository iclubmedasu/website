/**
 * Helpers for the same-origin `/backend-api` BFF proxy.
 * Keep pure so unit tests can cover client-IP forwarding and HF interstitial retry.
 */

const RETRY_AFTER_CAP_MS = 10_000;
const DEFAULT_RETRY_WAIT_MS = 1_000;

/** First hop from X-Forwarded-For, else X-Real-IP. */
export function extractClientIp(headers: Headers): string | null {
    const xff = headers.get("x-forwarded-for");
    if (xff) {
        const first = xff.split(",")[0]?.trim();
        if (first) return first;
    }
    const realIp = headers.get("x-real-ip")?.trim();
    return realIp || null;
}

/**
 * Attach trusted BFF headers for Express rate limiting.
 * Only sets `X-Iclub-Bff` when `BFF_PROXY_SECRET` is configured (both Spaces).
 */
export function applyBffIdentityHeaders(
    headers: Headers,
    inbound: Headers,
    secret: string | undefined,
): void {
    const clientIp = extractClientIp(inbound);
    if (clientIp) {
        headers.set("X-Iclub-Client-Ip", clientIp);
    }
    const trimmed = secret?.trim();
    if (trimmed) {
        headers.set("X-Iclub-Bff", trimmed);
    }
}

/** Express JSON 429 must pass through; HF HTML interstitials / gateway errors may retry once. */
export function shouldRetryUpstreamOnce(status: number, contentType: string | null): boolean {
    if (status === 502 || status === 503) return true;
    if (status !== 429) return false;
    const ct = (contentType || "").toLowerCase();
    return !ct.includes("application/json");
}

/** Parse Retry-After (seconds or HTTP-date), capped at ~10s. */
export function retryAfterWaitMs(retryAfterHeader: string | null, nowMs = Date.now()): number {
    if (!retryAfterHeader?.trim()) return DEFAULT_RETRY_WAIT_MS;
    const raw = retryAfterHeader.trim();
    const asSeconds = Number(raw);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
        return Math.min(asSeconds * 1000, RETRY_AFTER_CAP_MS);
    }
    const asDate = Date.parse(raw);
    if (!Number.isNaN(asDate)) {
        return Math.min(Math.max(0, asDate - nowMs), RETRY_AFTER_CAP_MS);
    }
    return DEFAULT_RETRY_WAIT_MS;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetch upstream once; on HF HTML 429 / 502 / 503, wait and retry once.
 * Express JSON 429 is returned immediately (no second request).
 */
export async function fetchUpstreamWithOptionalRetry(
    url: string,
    init: RequestInit,
    deps: {
        fetchFn?: FetchLike;
        sleepFn?: (ms: number) => Promise<void>;
    } = {},
): Promise<Response> {
    const fetchFn = deps.fetchFn ?? fetch;
    const sleepFn = deps.sleepFn ?? sleep;

    let upstream = await fetchFn(url, init);
    if (
        !shouldRetryUpstreamOnce(
            upstream.status,
            upstream.headers.get("content-type"),
        )
    ) {
        return upstream;
    }

    const waitMs = retryAfterWaitMs(upstream.headers.get("retry-after"));
    try {
        await upstream.body?.cancel();
    } catch {
        // ignore cancel failures
    }
    await sleepFn(waitMs);
    return fetchFn(url, init);
}
