/** Client-side id for UI elements. Falls back when crypto.randomUUID is missing (non-secure contexts). */
export function createUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
