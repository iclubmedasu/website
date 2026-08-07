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

export async function buildPublicVerifyUrl(verificationCode: string): Promise<string> {
    const origin = await resolvePublicWebsiteOrigin();
    return `${origin}/verify/${encodeURIComponent(verificationCode)}`;
}

export async function buildPublicEmbedLoaderUrl(): Promise<string> {
    const origin = await resolvePublicWebsiteOrigin();
    return `${origin}/embed/loader.js`;
}

export interface EmbedSnippetOptions {
    eventSlugOrId: number | string;
    primaryColor?: string | null;
    accentColor?: string | null;
    borderRadius?: string | null;
    fontFamily?: string | null;
    layout?: "default" | "compact" | "spacious" | null;
    customCssUrl?: string | null;
}

/** Ready-to-paste HTML snippet for per-event websites. */
export async function buildRegistrationEmbedSnippet(
    options: EmbedSnippetOptions,
): Promise<string> {
    const origin = await resolvePublicWebsiteOrigin();
    const loaderUrl = `${origin}/embed/loader.js`;
    const event = String(options.eventSlugOrId);

    const attrs: string[] = [
        'id="iclub-register"',
        'data-iclub-register',
        `data-event="${escapeHtmlAttr(event)}"`,
    ];

    if (options.primaryColor) {
        attrs.push(`data-primary-color="${escapeHtmlAttr(options.primaryColor)}"`);
    }
    if (options.accentColor) {
        attrs.push(`data-accent-color="${escapeHtmlAttr(options.accentColor)}"`);
    }
    if (options.borderRadius) {
        attrs.push(`data-border-radius="${escapeHtmlAttr(options.borderRadius)}"`);
    }
    if (options.fontFamily) {
        attrs.push(`data-font-family="${escapeHtmlAttr(options.fontFamily)}"`);
    }
    if (options.layout && options.layout !== "default") {
        attrs.push(`data-layout="${escapeHtmlAttr(options.layout)}"`);
    }
    if (options.customCssUrl) {
        attrs.push(`data-custom-css-url="${escapeHtmlAttr(options.customCssUrl)}"`);
    }

    return [
        `<div`,
        `  ${attrs.join("\n  ")}`,
        `></div>`,
        `<script src="${escapeHtmlAttr(loaderUrl)}" async></script>`,
    ].join("\n");
}

function escapeHtmlAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
