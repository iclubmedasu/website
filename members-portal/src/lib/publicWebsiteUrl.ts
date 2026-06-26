const DEFAULT_PUBLIC_WEBSITE_URL = "http://localhost:3002";

export function getPublicWebsiteOrigin(): string {
    const configured = process.env.NEXT_PUBLIC_PUBLIC_WEBSITE_URL?.trim();
    if (!configured) {
        return DEFAULT_PUBLIC_WEBSITE_URL;
    }
    return configured.replace(/\/$/, "");
}

export function buildPublicEventUrl(eventId: number | string): string {
    return `${getPublicWebsiteOrigin()}/events/${eventId}`;
}
