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

/** Login / credential-check endpoints — tighter to slow brute force. */
export const authPostLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many authentication attempts. Please try again later.",
});

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
