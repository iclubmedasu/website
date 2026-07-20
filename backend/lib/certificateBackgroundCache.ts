import path from "path";
import { downloadFile } from "../services/githubStorageService";

type CacheEntry = {
    buffer: Buffer;
    contentType: string;
};

/** Small in-process LRU keyed by path + sha so portal/verify skip GitHub within one process. */
const MAX_ENTRIES = 32;
const cache = new Map<string, CacheEntry>();

function cacheKey(githubPath: string, githubSha: string | null | undefined): string {
    return `${githubPath}\0${githubSha ?? ""}`;
}

export function contentTypeForBackgroundPath(
    githubPath: string,
    fallback?: string | null,
): string {
    const ext = path.extname(githubPath).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".gif") return "image/gif";
    if (ext === ".webp") return "image/webp";
    if (ext === ".svg") return "image/svg+xml";
    return fallback || "application/octet-stream";
}

export function getCachedCertificateBackground(
    githubPath: string,
    githubSha: string | null | undefined,
): CacheEntry | null {
    const key = cacheKey(githubPath, githubSha);
    const entry = cache.get(key);
    if (!entry) return null;
    // Refresh LRU order (Map insertion order).
    cache.delete(key);
    cache.set(key, entry);
    return entry;
}

export function setCachedCertificateBackground(
    githubPath: string,
    githubSha: string | null | undefined,
    buffer: Buffer,
    contentType: string,
): void {
    const key = cacheKey(githubPath, githubSha);
    if (cache.has(key)) cache.delete(key);
    cache.set(key, { buffer, contentType });
    while (cache.size > MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
    }
}

export function invalidateCachedCertificateBackground(
    githubPath: string | null | undefined,
    githubSha: string | null | undefined,
): void {
    if (!githubPath) return;
    cache.delete(cacheKey(githubPath, githubSha));
}

/**
 * Return background bytes from LRU or GitHub (then cache).
 */
export async function loadCertificateBackground(
    githubPath: string,
    githubSha: string | null | undefined,
): Promise<CacheEntry & { cacheHit: boolean }> {
    const cached = getCachedCertificateBackground(githubPath, githubSha);
    if (cached) {
        return { ...cached, cacheHit: true };
    }

    const ghResponse = await downloadFile(githubPath);
    const contentType = contentTypeForBackgroundPath(
        githubPath,
        ghResponse.headers.get("content-type"),
    );
    const buffer = Buffer.from(await ghResponse.arrayBuffer());
    setCachedCertificateBackground(githubPath, githubSha, buffer, contentType);
    return { buffer, contentType, cacheHit: false };
}
