const DEFAULT_PUBLIC_WEBSITE_URL = "http://localhost:3002";

let cachedOrigin: string | null = null;
let resolvePromise: Promise<string> | null = null;

function isLoopbackHost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function derivePublicWebsiteOriginFromHfHostname(hostname: string): string | null {
    if (!hostname.endsWith(".hf.space")) {
        return null;
    }
    if (hostname.includes("members-portal")) {
        const publicHost = hostname.replace("members-portal", "public-website");
        return `https://${publicHost}`;
    }
    return null;
}

function getConfiguredOrigin(): string | null {
    const configured = process.env.NEXT_PUBLIC_PUBLIC_WEBSITE_URL?.trim();
    if (!configured) {
        return null;
    }
    return configured.replace(/\/$/, "");
}

function getSyncPublicWebsiteOrigin(): string {
    const configured = getConfiguredOrigin();
    if (configured) {
        return configured;
    }

    if (typeof window !== "undefined") {
        const derived = derivePublicWebsiteOriginFromHfHostname(window.location.hostname);
        if (derived) {
            return derived;
        }
    }

    return DEFAULT_PUBLIC_WEBSITE_URL;
}

function resolveApiBaseUrl(): string {
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (configuredApiUrl) {
        if (typeof window !== "undefined") {
            try {
                const parsed = new URL(configuredApiUrl);
                if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(window.location.hostname)) {
                    parsed.hostname = window.location.hostname;
                    return parsed.toString();
                }
            } catch {
                // Keep configured value when it's not an absolute URL.
            }
        }

        return configuredApiUrl;
    }

    if (typeof window !== "undefined") {
        return `${window.location.protocol}//${window.location.hostname}:3000/api`;
    }

    return "http://localhost:3000/api";
}

async function fetchPublicWebsiteOriginFromApi(): Promise<string | null> {
    try {
        const response = await fetch(`${resolveApiBaseUrl()}/public/site-config`);
        if (!response.ok) {
            return null;
        }
        const data = (await response.json()) as { publicWebsiteUrl?: string };
        const url = data.publicWebsiteUrl?.trim();
        return url ? url.replace(/\/$/, "") : null;
    } catch {
        return null;
    }
}

/** Synchronous best-effort origin (env or HF hostname). May be localhost until resolvePublicWebsiteOrigin runs. */
export function getPublicWebsiteOrigin(): string {
    if (cachedOrigin) {
        return cachedOrigin;
    }
    return getSyncPublicWebsiteOrigin();
}

/** Resolves production URL from env, HF hostname, or backend PUBLIC_WEBSITE_URL. */
export async function resolvePublicWebsiteOrigin(): Promise<string> {
    if (cachedOrigin) {
        return cachedOrigin;
    }

    if (!resolvePromise) {
        resolvePromise = (async () => {
            const syncOrigin = getSyncPublicWebsiteOrigin();
            if (syncOrigin !== DEFAULT_PUBLIC_WEBSITE_URL) {
                cachedOrigin = syncOrigin;
                return syncOrigin;
            }

            const fromApi = await fetchPublicWebsiteOriginFromApi();
            if (fromApi) {
                cachedOrigin = fromApi;
                return fromApi;
            }

            cachedOrigin = syncOrigin;
            return syncOrigin;
        })();
    }

    return resolvePromise;
}

export async function buildPublicEventUrl(eventSlugOrId: number | string): Promise<string> {
    const origin = await resolvePublicWebsiteOrigin();
    return `${origin}/events/${eventSlugOrId}`;
}

export async function buildPublicProjectUrl(projectSlugOrId: number | string): Promise<string> {
    const origin = await resolvePublicWebsiteOrigin();
    return `${origin}/projects/${projectSlugOrId}`;
}
