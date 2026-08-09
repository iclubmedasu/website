/**
 * Resolve the members-portal browser/API base URL.
 *
 * On HF Spaces (and any cross-origin portal → API host setup), credentialed
 * fetch is broken by Spaces edge OPTIONS stripping Access-Control-Allow-Credentials.
 * Prefer same-origin `/backend-api` (BFF proxy) in that case.
 */

export function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Path the Next.js BFF proxy mounts on (must not collide with /api/health). */
export const PORTAL_BACKEND_API_PREFIX = "/backend-api";

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
 * Prefer same-origin BFF when:
 * - caller set a relative `/backend-api` path, or
 * - browser page origin differs from configured absolute API host.
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

                // Cross-origin absolute API → use portal BFF (HF CORS workaround).
                // Keep direct localhost/LAN API for dev (Express CORS allowlists those).
                if (isCrossOriginApiUrl(configured, pageOrigin)) {
                    if (isLoopbackHost(parsed.hostname)) {
                        return parsed.toString().replace(/\/$/, "");
                    }
                    return `${pageOrigin.replace(/\/$/, "")}${PORTAL_BACKEND_API_PREFIX}`;
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
                // Production host without config: assume BFF.
                return `${pageOrigin.replace(/\/$/, "")}${PORTAL_BACKEND_API_PREFIX}`;
            }
            return `${protocol}//${hostname}:3000/api`;
        } catch {
            return `${PORTAL_BACKEND_API_PREFIX}`;
        }
    }

    return "http://localhost:3000/api";
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
