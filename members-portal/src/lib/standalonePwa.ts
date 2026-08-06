/**
 * True when the portal is running as an installed PWA
 * (display-mode standalone or iOS navigator.standalone).
 */
export function isStandalonePwa(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch {
        // ignore
    }
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type ClientSurface = 'pwa' | 'web';

export function getClientSurface(): ClientSurface {
    return isStandalonePwa() ? 'pwa' : 'web';
}
