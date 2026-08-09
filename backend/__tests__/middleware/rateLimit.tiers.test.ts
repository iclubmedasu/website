import { describe, expect, it } from "vitest";
import * as rateLimitModule from "../../middleware/rateLimit";

describe("auth rate limit tiers", () => {
    it("exports distinct limiters for identity, credentials, and password reset", () => {
        expect(rateLimitModule.identityCheckLimiter).toBeTypeOf("function");
        expect(rateLimitModule.credentialPostLimiter).toBeTypeOf("function");
        expect(rateLimitModule.passwordResetLimiter).toBeTypeOf("function");
        expect(rateLimitModule.identityCheckLimiter).not.toBe(rateLimitModule.credentialPostLimiter);
        expect(rateLimitModule.credentialPostLimiter).not.toBe(rateLimitModule.passwordResetLimiter);
        expect(rateLimitModule.identityCheckLimiter).not.toBe(rateLimitModule.passwordResetLimiter);
        // Deprecated alias tracks credential posts
        expect(rateLimitModule.authPostLimiter).toBe(rateLimitModule.credentialPostLimiter);
    });

    it("exports a registration limiter that can skip authenticated users", () => {
        expect(rateLimitModule.registrationPostLimiter).toBeTypeOf("function");
    });
});
