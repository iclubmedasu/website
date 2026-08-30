/** Reject absurdly large bodies pretending to be JWTs. */
export const MAX_TOKEN_LENGTH = 4096;

/** Accept only non-empty JWT-shaped strings (three non-empty segments). */
export function isValidSessionToken(token: unknown): token is string {
    if (typeof token !== "string") return false;
    const trimmed = token.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) return false;
    const parts = trimmed.split(".");
    return parts.length === 3 && parts.every((part) => part.length > 0);
}
