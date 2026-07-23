const DEFAULT_PUBLIC_API_URL = 'http://localhost:3000/api';

/** Absolute API base used in public email links (e.g. certificate PDF download). */
export function getPublicApiUrl(): string {
    const configured =
        process.env.API_PUBLIC_URL?.trim()
        || process.env.PUBLIC_API_URL?.trim();
    if (!configured) {
        return DEFAULT_PUBLIC_API_URL;
    }
    return configured.replace(/\/$/, '');
}
