import { describe, expect, it, vi } from "vitest";
import {
    applyBffIdentityHeaders,
    extractClientIp,
    fetchUpstreamWithOptionalRetry,
    retryAfterWaitMs,
    shouldRetryUpstreamOnce,
} from "../bffProxy";

function mockUpstream(
    status: number,
    contentType: string | null,
    extraHeaders: Record<string, string> = {},
): Response {
    const headers = new Headers(extraHeaders);
    if (contentType) headers.set("content-type", contentType);
    return new Response(status === 204 ? null : "body", { status, headers });
}

describe("extractClientIp", () => {
    it("uses the first X-Forwarded-For hop", () => {
        const headers = new Headers({
            "x-forwarded-for": "203.0.113.9, 10.0.0.1",
            "x-real-ip": "10.0.0.1",
        });
        expect(extractClientIp(headers)).toBe("203.0.113.9");
    });

    it("falls back to X-Real-IP", () => {
        const headers = new Headers({ "x-real-ip": "198.51.100.7" });
        expect(extractClientIp(headers)).toBe("198.51.100.7");
    });
});

describe("applyBffIdentityHeaders", () => {
    it("sets client IP always and BFF secret only when configured", () => {
        const inbound = new Headers({ "x-forwarded-for": "203.0.113.1" });
        const withSecret = new Headers();
        applyBffIdentityHeaders(withSecret, inbound, "  abc  ");
        expect(withSecret.get("X-Iclub-Client-Ip")).toBe("203.0.113.1");
        expect(withSecret.get("X-Iclub-Bff")).toBe("abc");

        const withoutSecret = new Headers();
        applyBffIdentityHeaders(withoutSecret, inbound, undefined);
        expect(withoutSecret.get("X-Iclub-Client-Ip")).toBe("203.0.113.1");
        expect(withoutSecret.get("X-Iclub-Bff")).toBeNull();
    });
});

describe("shouldRetryUpstreamOnce", () => {
    it("retries non-JSON 429 (HF interstitial) and 502/503", () => {
        expect(shouldRetryUpstreamOnce(429, "text/html")).toBe(true);
        expect(shouldRetryUpstreamOnce(429, null)).toBe(true);
        expect(shouldRetryUpstreamOnce(502, "text/html")).toBe(true);
        expect(shouldRetryUpstreamOnce(503, "application/json")).toBe(true);
    });

    it("does not retry Express JSON 429", () => {
        expect(shouldRetryUpstreamOnce(429, "application/json")).toBe(false);
        expect(
            shouldRetryUpstreamOnce(429, "application/json; charset=utf-8"),
        ).toBe(false);
    });

    it("does not retry other statuses", () => {
        expect(shouldRetryUpstreamOnce(401, "text/html")).toBe(false);
        expect(shouldRetryUpstreamOnce(500, "text/html")).toBe(false);
    });
});

describe("retryAfterWaitMs", () => {
    it("parses seconds and caps at 10s", () => {
        expect(retryAfterWaitMs("2")).toBe(2000);
        expect(retryAfterWaitMs("30")).toBe(10_000);
    });

    it("defaults when header missing", () => {
        expect(retryAfterWaitMs(null)).toBe(1000);
    });

    it("parses HTTP-date and caps", () => {
        const now = Date.parse("Wed, 21 Oct 2015 07:28:00 GMT");
        const later = "Wed, 21 Oct 2015 07:28:05 GMT";
        expect(retryAfterWaitMs(later, now)).toBe(5000);
        const far = "Wed, 21 Oct 2015 07:29:00 GMT";
        expect(retryAfterWaitMs(far, now)).toBe(10_000);
    });
});

describe("fetchUpstreamWithOptionalRetry", () => {
    it("passes through Express JSON 429 without a second fetch", async () => {
        const first = mockUpstream(429, "application/json");
        const fetchFn = vi.fn().mockResolvedValue(first);
        const sleepFn = vi.fn().mockResolvedValue(undefined);

        const result = await fetchUpstreamWithOptionalRetry(
            "https://backend.example/api/auth/login",
            { method: "POST" },
            { fetchFn, sleepFn },
        );

        expect(result).toBe(first);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
    });

    it("retries HTML 429 once after waiting", async () => {
        const first = mockUpstream(429, "text/html", { "retry-after": "2" });
        const second = mockUpstream(200, "application/json");
        const fetchFn = vi
            .fn()
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce(second);
        const sleepFn = vi.fn().mockResolvedValue(undefined);

        const result = await fetchUpstreamWithOptionalRetry(
            "https://backend.example/api/auth/check-email",
            { method: "POST" },
            { fetchFn, sleepFn },
        );

        expect(result).toBe(second);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).toHaveBeenCalledWith(2000);
    });

    it("does not retry a third time when the second response is also HTML 429", async () => {
        const first = mockUpstream(429, "text/html");
        const second = mockUpstream(429, "text/html");
        const fetchFn = vi
            .fn()
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce(second);
        const sleepFn = vi.fn().mockResolvedValue(undefined);

        const result = await fetchUpstreamWithOptionalRetry(
            "https://backend.example/api/auth/me",
            { method: "GET" },
            { fetchFn, sleepFn },
        );

        expect(result).toBe(second);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});
