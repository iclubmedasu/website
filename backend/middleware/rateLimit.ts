import rateLimit from "express-rate-limit";

/** Shared limiter factory — trust proxy is already set on the Express app. */
function createLimiter(options: {
    windowMs: number;
    max: number;
    message: string;
}) {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: options.message },
    });
}

/**
 * Read-only identity checks (typing during sign-in / setup).
 * Separate from credential POSTs so checks never starve login.
 */
export const identityCheckLimiter = createLimiter({
    windowMs: 5 * 60 * 1000,
    max: 60,
    message: "Too many lookup attempts. Please wait a few minutes and try again.",
});

/**
 * Login and account-setup credential POSTs.
 */
export const credentialPostLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: "Too many authentication attempts. Please wait a few minutes and try again.",
});

/**
 * Password reset endpoints (costly email sends) — isolated bucket.
 */
export const passwordResetLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many password reset attempts. Please wait a few minutes and try again.",
});

/** @deprecated Prefer the tiered limiters above; alias kept for any external imports. */
export const authPostLimiter = credentialPostLimiter;

/** Public contact form. */
export const contactPostLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many contact submissions. Please try again later.",
});

/** Public incident reports. */
export const incidentReportPostLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many incident report submissions. Please try again later.",
});

/** Public event registration. */
export const registrationPostLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: "Too many registration attempts. Please try again later.",
});

/** Unauthenticated certificate list / verify reads. */
export const publicCertificateReadLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: "Too many certificate requests. Please try again later.",
});

/** Authenticated certificate email resend. */
export const certificateEmailResendLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many certificate email resend attempts. Please try again later.",
});
