import { afterEach, describe, expect, it, vi } from "vitest";

describe("securityEnv", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("uses JWT_SECRET from the environment when set", async () => {
        vi.stubEnv("JWT_SECRET", "unit-test-secret");
        vi.stubEnv("NODE_ENV", "development");
        const { resolveJwtSecret } = await import("../../lib/securityEnv");
        expect(resolveJwtSecret()).toBe("unit-test-secret");
    });

    it("fails closed in production when JWT_SECRET is missing", async () => {
        vi.stubEnv("JWT_SECRET", "");
        vi.stubEnv("NODE_ENV", "production");
        const { resolveJwtSecret } = await import("../../lib/securityEnv");
        expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
    });

    it("allows a non-production fallback when JWT_SECRET is missing", async () => {
        vi.stubEnv("JWT_SECRET", "");
        vi.stubEnv("NODE_ENV", "test");
        const { resolveJwtSecret } = await import("../../lib/securityEnv");
        expect(resolveJwtSecret()).toContain("dev-only");
    });

    it("does not enable developer credentials without both env vars", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("DEVELOPER_EMAIL", "");
        vi.stubEnv("DEVELOPER_PASSWORD", "");
        const { resolveDeveloperCredentials } = await import("../../lib/securityEnv");
        expect(resolveDeveloperCredentials()).toBeNull();
    });

    it("enables developer credentials in non-production when both env vars are set", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("DEVELOPER_EMAIL", "dev@example.com");
        vi.stubEnv("DEVELOPER_PASSWORD", "strong-pass");
        const { resolveDeveloperCredentials } = await import("../../lib/securityEnv");
        expect(resolveDeveloperCredentials()).toEqual({
            email: "dev@example.com",
            password: "strong-pass",
        });
    });

    it("disables developer credentials in production unless explicitly allowed", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DEVELOPER_EMAIL", "dev@example.com");
        vi.stubEnv("DEVELOPER_PASSWORD", "strong-pass");
        vi.stubEnv("ALLOW_DEVELOPER_BACKDOOR", "");
        const { resolveDeveloperCredentials } = await import("../../lib/securityEnv");
        expect(resolveDeveloperCredentials()).toBeNull();
    });

    it("allows developer credentials in production when ALLOW_DEVELOPER_BACKDOOR=true", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DEVELOPER_EMAIL", "dev@example.com");
        vi.stubEnv("DEVELOPER_PASSWORD", "strong-pass");
        vi.stubEnv("ALLOW_DEVELOPER_BACKDOOR", "true");
        const { resolveDeveloperCredentials } = await import("../../lib/securityEnv");
        expect(resolveDeveloperCredentials()).toEqual({
            email: "dev@example.com",
            password: "strong-pass",
        });
    });
});
