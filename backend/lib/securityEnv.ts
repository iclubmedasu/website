/**
 * Resolve secrets and auth-related env with fail-closed behavior in production.
 */

const DEV_ONLY_JWT_FALLBACK = "dev-only-insecure-jwt-secret-change-me";

export function isProductionEnv(): boolean {
    return process.env.NODE_ENV === "production";
}

/**
 * JWT signing secret. Required in production; refuses to start with a missing value.
 * Non-production falls back to a clearly insecure default so local tests can run.
 */
export function resolveJwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (secret) {
        return secret;
    }
    if (isProductionEnv()) {
        throw new Error(
            "FATAL: JWT_SECRET environment variable is required when NODE_ENV=production",
        );
    }
    return DEV_ONLY_JWT_FALLBACK;
}

export type DeveloperCredentials = {
    email: string;
    password: string;
};

/**
 * Optional developer backdoor. Only enabled when both env vars are set.
 * Disabled in production unless ALLOW_DEVELOPER_BACKDOOR=true (fail closed by default).
 * No hardcoded credential fallbacks.
 */
export function resolveDeveloperCredentials(): DeveloperCredentials | null {
    if (isProductionEnv() && process.env.ALLOW_DEVELOPER_BACKDOOR !== "true") {
        return null;
    }

    const email = process.env.DEVELOPER_EMAIL?.trim();
    const password = process.env.DEVELOPER_PASSWORD;
    if (!email || !password) {
        return null;
    }
    return { email, password };
}
