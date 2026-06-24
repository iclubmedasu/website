/**
 * Detect and collapse exact repeated digit chunks (e.g. tripled Egyptian numbers).
 */
export function looksLikePhone(value: unknown): value is string {
    if (!value || typeof value !== 'string') return false;
    const stripped = value.replace(/\s/g, '');
    return /^[+\d][\d\s\-().]{6,}$/.test(stripped) && !stripped.includes('@');
}

export function dedupeRepeatedPhoneDigits(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^[+\d]+$/.test(trimmed)) return trimmed;

    for (let chunkLength = 8; chunkLength <= Math.min(15, Math.floor(trimmed.length / 2)); chunkLength += 1) {
        if (trimmed.length % chunkLength !== 0) continue;

        const chunk = trimmed.slice(0, chunkLength);
        const repetitions = trimmed.length / chunkLength;

        if (repetitions < 2) continue;
        if (chunk.repeat(repetitions) === trimmed) {
            return chunk;
        }
    }

    return trimmed;
}

/**
 * Normalize a phone number to canonical storage form (E.164-style with leading +).
 */
export function normalizePhone(raw: string): string {
    if (!raw || typeof raw !== 'string') return raw;
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
        cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
    } else {
        cleaned = cleaned.replace(/\+/g, '');
    }
    const digits = cleaned.replace(/\+/g, '');
    if (cleaned.startsWith('+20')) {
        return cleaned;
    }
    if (!cleaned.startsWith('+') && digits.startsWith('20') && digits.length === 12) {
        return '+' + digits;
    }
    if (digits.startsWith('0') && digits.length === 11) {
        return '+20' + digits.slice(1);
    }
    if (digits.startsWith('1') && digits.length === 10) {
        return '+20' + digits;
    }
    return cleaned.startsWith('+') ? cleaned : cleaned;
}

/**
 * Dedupe repeated chunks and normalize for database storage.
 * Preserves placeholder phones (pending-*).
 */
export function sanitizePhoneForStorage(raw: unknown): string {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('pending-')) return trimmed;
    return normalizePhone(dedupeRepeatedPhoneDigits(trimmed));
}

export function sanitizeOptionalPhoneForStorage(raw: unknown): string | null {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
    const sanitized = sanitizePhoneForStorage(raw);
    return sanitized || null;
}

export function validateStoredPhone(value: string): { valid: boolean; error?: string } {
    if (!value) {
        return { valid: false, error: 'Phone number is required' };
    }
    if (value.startsWith('pending-')) {
        return { valid: true };
    }
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10) {
        return { valid: false, error: 'Phone number is too short' };
    }
    if (digits.length > 15) {
        return { valid: false, error: 'Phone number is invalid' };
    }
    return { valid: true };
}
