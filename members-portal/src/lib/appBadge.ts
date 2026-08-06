/**
 * Sync the installed PWA home-screen badge with the Badging API.
 * Unsupported browsers (and non-installed Safari tabs) no-op safely.
 */
export function syncAppBadge(count: number): void {
    if (typeof navigator === 'undefined') return;
    if (!('setAppBadge' in navigator)) return;

    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n > 0) {
        void navigator.setAppBadge(n);
    } else {
        void navigator.clearAppBadge?.();
    }
}
