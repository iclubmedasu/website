import { afterEach, describe, expect, it } from "vitest";
import { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { resolveRateLimitKey } from "../../middleware/rateLimit";

function mockReq(overrides: {
    ip?: string;
    headers?: Record<string, string | undefined>;
}): Request {
    const headers = overrides.headers ?? {};
    return {
        ip: overrides.ip ?? "203.0.113.10",
        get(name: string) {
            const key = name.toLowerCase();
            for (const [k, v] of Object.entries(headers)) {
                if (k.toLowerCase() === key) return v;
            }
            return undefined;
        },
    } as Request;
}

describe("resolveRateLimitKey", () => {
    const prev = process.env.BFF_PROXY_SECRET;

    afterEach(() => {
        if (prev === undefined) delete process.env.BFF_PROXY_SECRET;
        else process.env.BFF_PROXY_SECRET = prev;
    });

    it("uses req.ip when BFF_PROXY_SECRET is unset (ignores spoofable headers)", () => {
        delete process.env.BFF_PROXY_SECRET;
        const key = resolveRateLimitKey(
            mockReq({
                ip: "198.51.100.1",
                headers: {
                    "x-iclub-bff": "forged",
                    "x-iclub-client-ip": "1.2.3.4",
                },
            }),
        );
        expect(key).toBe(ipKeyGenerator("198.51.100.1"));
    });

    it("uses X-Iclub-Client-Ip when secret matches", () => {
        process.env.BFF_PROXY_SECRET = "shared-secret-value";
        const key = resolveRateLimitKey(
            mockReq({
                ip: "198.51.100.1",
                headers: {
                    "x-iclub-bff": "shared-secret-value",
                    "x-iclub-client-ip": "203.0.113.55",
                },
            }),
        );
        expect(key).toBe(ipKeyGenerator("203.0.113.55"));
    });

    it("falls back to req.ip when secret mismatches", () => {
        process.env.BFF_PROXY_SECRET = "shared-secret-value";
        const key = resolveRateLimitKey(
            mockReq({
                ip: "198.51.100.1",
                headers: {
                    "x-iclub-bff": "wrong",
                    "x-iclub-client-ip": "203.0.113.55",
                },
            }),
        );
        expect(key).toBe(ipKeyGenerator("198.51.100.1"));
    });

    it("falls back to req.ip when client IP header is missing or invalid", () => {
        process.env.BFF_PROXY_SECRET = "shared-secret-value";
        expect(
            resolveRateLimitKey(
                mockReq({
                    ip: "198.51.100.1",
                    headers: {
                        "x-iclub-bff": "shared-secret-value",
                    },
                }),
            ),
        ).toBe(ipKeyGenerator("198.51.100.1"));

        expect(
            resolveRateLimitKey(
                mockReq({
                    ip: "198.51.100.1",
                    headers: {
                        "x-iclub-bff": "shared-secret-value",
                        "x-iclub-client-ip": "not-an-ip",
                    },
                }),
            ),
        ).toBe(ipKeyGenerator("198.51.100.1"));
    });
});
