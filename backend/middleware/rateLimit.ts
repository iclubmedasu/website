import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Shared limiter factory — trust proxy is already set on the Express app. */
function createLimiter(options: {
    windowMs: number;
    max: number;
    message: string;
    /** Skip counting this request toward the limit (authenticated staff, etc.). */
    skip?: (req: Request) => boolean;
}) {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: options.message },
        skip: options.skip,
    });
}

/** True when a session cookie / Bearer already authenticated the member. */
function hasAuthenticatedUser(req: Request): boolean {
    return Boolean(req.user?.memberId || req.user?.isDeveloper);
}

/**
 * Read-only identity checks (typing during sign-in / setup).
 * Separate from credential POSTs so checks never starve login.
 * Generous: multiple retries / tab refreshes during busy login don't trip it.
 */
export const identityCheckLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: "Too many lookup attempts. Please wait a few minutes and try again.",
});

/**
 * Login and account-setup credential POSTs.
 * High enough for real people fat-fingering passwords; low enough to slow bots.
 */
export const credentialPostLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: "Too many authentication attempts. Please wait a few minutes and try again.",
});

/**
 * Password reset endpoints (costly email sends) — isolated bucket.
 * Slightly higher than before; still modest to limit mailbox spam.
 */
export const passwordResetLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many password reset attempts. Please wait a few minutes and try again.",
});

/** @deprecated Prefer the tiered limiters above; alias kept for any external imports. */
export const authPostLimiter = credentialPostLimiter;

/** Public contact form (anonymous spam surface — keep tight). */
export const contactPostLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 15,
    message: "Too many contact submissions. Please try again later.",
});

/** Public incident reports. */
export const incidentReportPostLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many incident report submissions. Please try again later.",
});

/**
 * Public (and anonymous) event registration writes.
 * Must be mounted AFTER optionalAuthenticateToken so staff sessions can skip.
 * Anonymous / public walk-up traffic still has a high per-IP ceiling for event rush.
 */
export const registrationPostLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 250,
    message: "Too many registration attempts. Please wait a few minutes and try again.",
    // Logged-in portal users (check-in, walk-ins, officer tools) must never share
    // the public visitor bucket — venue Wi‑Fi NATs many phones onto one IP.
    skip: hasAuthenticatedUser,
});

/** Unauthenticated certificate list / verify reads. */
export const publicCertificateReadLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many certificate requests. Please try again later.",
});

/**
 * Authenticated certificate email resend (staff workflow during / after events).
 * Ceiling is high so bulk follow-ups do not stall; still stops accidental loops.
 */
export const certificateEmailResendLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: "Too many certificate email resend attempts. Please wait a few minutes and try again.",
});
