const DEFAULT_ORIGIN = "http://localhost:3002";

export function getPublicOrigin(): string {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return DEFAULT_ORIGIN;
}

export function buildPublicEventUrl(eventId: number | string, origin?: string): string {
    const base = (origin ?? getPublicOrigin()).replace(/\/$/, "");
    return `${base}/events/${eventId}`;
}

export function buildShareMessage(title: string, url: string): string {
    return `${title}\n${url}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through to legacy fallback
        }
    }

    if (typeof document === "undefined") {
        return false;
    }

    try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}

export function buildWhatsAppShareUrl(message: string): string {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildSmsShareUrl(message: string): string {
    return `sms:?body=${encodeURIComponent(message)}`;
}

export function buildEmailShareUrl(subject: string, body: string): string {
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function canUseNativeShare(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareViaNative(title: string, url: string): Promise<boolean> {
    if (!canUseNativeShare()) {
        return false;
    }

    try {
        await navigator.share({ title, url });
        return true;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return true;
        }
        return false;
    }
}
