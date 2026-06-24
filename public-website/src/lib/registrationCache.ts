const CACHE_PREFIX = "iclub:event-registration:";

export interface CachedRegistration {
    confirmationCode: string;
    fullName: string;
    email: string;
    savedAt: string;
}

function cacheKey(eventId: number): string {
    return `${CACHE_PREFIX}${eventId}`;
}

export function saveRegistrationCache(
    eventId: number,
    data: Pick<CachedRegistration, "confirmationCode" | "fullName" | "email">,
): void {
    if (typeof window === "undefined") return;

    const payload: CachedRegistration = {
        ...data,
        savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(cacheKey(eventId), JSON.stringify(payload));
}

export function readRegistrationCache(eventId: number): CachedRegistration | null {
    if (typeof window === "undefined") return null;

    const raw = window.localStorage.getItem(cacheKey(eventId));
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as CachedRegistration;
        if (!parsed?.confirmationCode || !parsed.fullName || !parsed.email) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function clearRegistrationCache(eventId: number): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(cacheKey(eventId));
}
