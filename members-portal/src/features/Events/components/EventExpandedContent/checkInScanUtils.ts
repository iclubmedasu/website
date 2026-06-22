/** Matches backend/services/eventCode.ts CONFIRMATION_ALPHABET */
export const CONFIRMATION_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

const CONFIRMATION_CODE_TOKEN = /[A-HJ-NP-Z2-9]{6}/;

const URL_CODE_PARAMS = ['code', 'confirmationCode', 'confirmation'] as const;

function normalizeCode(value: string): string {
    return value.trim().toUpperCase();
}

function isValidConfirmationCode(value: string): boolean {
    return CONFIRMATION_CODE_PATTERN.test(normalizeCode(value));
}

function extractFromUrl(raw: string): string | null {
    try {
        const url = new URL(raw);
        for (const param of URL_CODE_PARAMS) {
            const value = url.searchParams.get(param);
            if (value && isValidConfirmationCode(value)) {
                return normalizeCode(value);
            }
        }

        const segments = url.pathname.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && isValidConfirmationCode(lastSegment)) {
            return normalizeCode(lastSegment);
        }
    } catch {
        // Not a URL — fall through to other strategies.
    }

    return null;
}

function extractToken(raw: string): string | null {
    const match = raw.toUpperCase().match(CONFIRMATION_CODE_TOKEN);
    return match ? match[0] : null;
}

/** Parse a QR / scanner payload into a 6-character confirmation code. */
export function parseScannedPayload(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const direct = normalizeCode(trimmed);
    if (isValidConfirmationCode(direct)) {
        return direct;
    }

    const fromUrl = extractFromUrl(trimmed);
    if (fromUrl) {
        return fromUrl;
    }

    return extractToken(trimmed);
}
