const DEFAULT_PUBLIC_WEBSITE_URL = 'http://localhost:3002';

export function getPublicWebsiteUrl(): string {
    const configured = process.env.PUBLIC_WEBSITE_URL?.trim();
    if (!configured) {
        return DEFAULT_PUBLIC_WEBSITE_URL;
    }
    return configured.replace(/\/$/, '');
}
