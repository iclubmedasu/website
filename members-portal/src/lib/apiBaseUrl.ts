/**
 * Resolve the members-portal browser/API base URL.
 *
 * TEMPORARY — HF direct API (default): browser → backend `/api` with Bearer
 * (like the public site). Set `NEXT_PUBLIC_PORTAL_USE_BFF=true` to restore
 * same-origin `/backend-api` (BFF) when HF Space→Space throttle is fixed.
 *
 * BFF path kept for reversal: Spaces edge OPTIONS often strips
 * Access-Control-Allow-Credentials, which breaks cookie CORS.
 */

export function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Path the Next.js BFF proxy mounts on (must not collide with /api/health). */
export const PORTAL_BACKEND_API_PREFIX = "/backend-api";

/**
 * Opt-in BFF mode. Default is direct browser→backend (temporary HF bypass).
 * Set `NEXT_PUBLIC_PORTAL_USE_BFF=true` and rebuild to restore cookie BFF.
 */
export function isPortalBffEnabled(): boolean {
    return process.env.NEXT_PUBLIC_PORTAL_USE_BFF === "true";
}

function defaultBackendOrigin(): string {
    return (
        process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() ||
        "https://iclubmedasu-backend.hf.space"
    );
}

/**
 * True when the configured API lives on a different origin than the page,
 * so credentialed browser CORS preflights would hit a remote host.
 */
export function isCrossOriginApiUrl(apiUrl: string, pageOrigin: string): boolean {
    try {
        const absolute = new URL(apiUrl, pageOrigin);
        return absolute.origin !== new URL(pageOrigin).origin;
    } catch {
        return false;
    }
}

/**
 * Resolve browsing API base:
 * - Explicit `/backend-api` → same-origin BFF path
 * - Cross-origin absolute API → BFF only when {@link isPortalBffEnabled}; else direct backend URL
 * - Localhost/LAN → direct Express (unchanged)
 */
export function resolveApiBaseUrl(options?: {
    configuredApiUrl?: string | undefined;
    pageOrigin?: string | undefined;
    /** Hostname-only loopback rewrite (LAN mobile testing). */
    pageHostname?: string | undefined;
}): string {
    const configured =
        options?.configuredApiUrl ?? process.env.NEXT_PUBLIC_API_URL?.trim();
    const pageOrigin = options?.pageOrigin;
    const pageHostname = options?.pageHostname;

    if (configured) {
        // Explicit same-origin proxy path (absolute or relative).
        if (
            configured === PORTAL_BACKEND_API_PREFIX ||
            configured.startsWith(`${PORTAL_BACKEND_API_PREFIX}/`) ||
            configured.endsWith(PORTAL_BACKEND_API_PREFIX)
        ) {
            if (pageOrigin) {
                try {
                    return new URL(
                        configured.startsWith("/")
                            ? configured
                            : PORTAL_BACKEND_API_PREFIX,
                        pageOrigin,
                    )
                        .toString()
                        .replace(/\/$/, "");
                } catch {
                    return `${pageOrigin.replace(/\/$/, "")}${PORTAL_BACKEND_API_PREFIX}`;
                }
            }
            return configured.startsWith("/")
                ? configured.replace(/\/$/, "")
                : PORTAL_BACKEND_API_PREFIX;
        }

        if (pageOrigin) {
            try {
                const parsed = new URL(configured, pageOrigin);

                // Loopback API URL on a non-loopback page → rewrite host for LAN.
                if (
                    pageHostname &&
                    isLoopbackHost(parsed.hostname) &&
                    !isLoopbackHost(pageHostname)
                ) {
                    parsed.hostname = pageHostname;
                    return parsed.toString().replace(/\/$/, "");
                }

                // Cross-origin absolute API: BFF remap only when flag enabled.
                // Keep direct localhost/LAN API for dev (Express CORS allowlists those).
                if (isCrossOriginApiUrl(configured, pageOrigin)) {
                    if (isLoopbackHost(parsed.hostname)) {
                        return parsed.toString().replace(/\/$/, "");
                    }
                    if (isPortalBffEnabled()) {
                        return `${pageOrigin.replace(/\/$/, "")}${PORTAL_BACKEND_API_PREFIX}`;
                    }
                    return parsed.toString().replace(/\/$/, "");
                }

                return parsed.toString().replace(/\/$/, "");
            } catch {
                // Relative non-proxy path
                if (configured.startsWith("/")) {
                    return configured.replace(/\/$/, "");
                }
            }
        }

        return configured.replace(/\/$/, "");
    }

    if (pageOrigin) {
        try {
            const { hostname, protocol } = new URL(pageOrigin);
            if (!isLoopbackHost(hostname)) {
                if (isPortalBffEnabled()) {
                    return `${pageOrigin.replace(/\/$/, "")}${PORTAL_BACKEND_API_PREFIX}`;
                }
                return `${defaultBackendOrigin()}/api`;
            }
            return `${protocol}//${hostname}:3000/api`;
        } catch {
            return isPortalBffEnabled()
                ? `${PORTAL_BACKEND_API_PREFIX}`
                : `${defaultBackendOrigin()}/api`;
        }
    }

    return "http://localhost:3000/api";
}

/**
 * Direct backend `/api` base for unauthenticated auth POSTs (check-email, login, …).
 *
 * When browsing uses BFF (`NEXT_PUBLIC_PORTAL_USE_BFF=true`), auth POSTs still go
 * straight to the backend Space to avoid HF Space→Space 429s. When direct mode
 * (default), this matches {@link resolveApiBaseUrl}.
 */
export function resolveDirectBackendApiUrl(options?: {
    configuredApiUrl?: string | undefined;
    pageOrigin?: string | undefined;
    pageHostname?: string | undefined;
}): string {
    const browsingApi = resolveApiBaseUrl(options);
    const usesBff =
        browsingApi === PORTAL_BACKEND_API_PREFIX ||
        browsingApi.endsWith(PORTAL_BACKEND_API_PREFIX) ||
        browsingApi.includes(`${PORTAL_BACKEND_API_PREFIX}/`) ||
        /\/backend-api(?:\/|$)/.test(browsingApi);

    if (!usesBff) {
        return browsingApi;
    }

    const fromBackendOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
    if (fromBackendOrigin) {
        return `${fromBackendOrigin.replace(/\/$/, "")}/api`;
    }

    const configured =
        options?.configuredApiUrl ?? process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        try {
            const pageOrigin = options?.pageOrigin ?? "http://localhost";
            const absolute = new URL(configured, pageOrigin);
            if (
                !absolute.pathname.includes("backend-api") &&
                !isLoopbackHost(absolute.hostname)
            ) {
                const path = absolute.pathname.replace(/\/$/, "");
                if (path && path !== "/") {
                    return absolute.toString().replace(/\/$/, "");
                }
                return `${absolute.origin}/api`;
            }
        } catch {
            // fall through
        }
    }

    return `${defaultBackendOrigin()}/api`;
}

/** Direct backend origin for WebSocket (not proxied by Next). */
export function resolveBackendOriginForWebSocket(options?: {
    pageOrigin?: string;
    configuredApiUrl?: string;
}): string {
    const fromEnv = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
    if (fromEnv) {
        return fromEnv.replace(/\/$/, "");
    }

    const configured =
        options?.configuredApiUrl ?? process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configured) {
        try {
            const pageOrigin = options?.pageOrigin ?? "http://localhost";
            const absolute = new URL(configured, pageOrigin);
            // If configured is already .../api, origin is the backend host.
            if (!absolute.pathname.includes("backend-api")) {
                // When client remaps to /backend-api, configured absolute may still be backend.
                if (
                    options?.pageOrigin &&
                    isCrossOriginApiUrl(configured, options.pageOrigin)
                ) {
                    return absolute.origin;
                }
                if (!absolute.pathname.startsWith(PORTAL_BACKEND_API_PREFIX)) {
                    return absolute.origin;
                }
            }
        } catch {
            // fall through
        }
    }

    return defaultBackendOrigin();
}
