/**
 * GitHub-based profile photo storage.
 *
 * Stores member profile photos in the `user-data` repository under:
 *   members/{memberId}/profile-photo.{jpg|png|webp}
 *
 * Environment variables:
 *   GITHUB_USER_DATA_TOKEN  – Personal Access Token with `repo` scope
 *   GITHUB_USER_DATA_OWNER  – GitHub org/user owning the repo  (e.g. iclubmedasu)
 *   GITHUB_USER_DATA_REPO   – Repository name (default: user-data)
 */

const GITHUB_TOKEN = process.env.GITHUB_USER_DATA_TOKEN;
const GITHUB_ORG = process.env.GITHUB_USER_DATA_OWNER;
const GITHUB_USER_DATA_REPO = process.env.GITHUB_USER_DATA_REPO || 'user-data';

const API_BASE = `https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_USER_DATA_REPO}/contents`;

const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

const ALL_EXTS = ['.jpg', '.png', '.webp'];

function headers() {
    return {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

/**
 * Try to find an existing profile photo for the given member (any supported extension).
 * Returns { path, sha, ext } if found, otherwise null.
 */
async function findExistingPhoto(memberId) {
    for (const ext of ALL_EXTS) {
        const path = `members/${memberId}/profile-photo${ext}`;
        const res = await fetch(`${API_BASE}/${path}`, { headers: headers() });
        if (res.ok) {
            const data = await res.json();
            return { path, sha: data.sha, ext };
        }
        // 404 means not found, continue; other errors we also skip silently
    }
    return null;
}

/**
 * Upload (create or overwrite) a member's profile photo.
 *
 * @param {number} memberId
 * @param {Buffer} fileBuffer
 * @param {string} mimeType  – one of image/jpeg, image/png, image/webp
 * @returns {Promise<string>} Raw GitHub URL with cache-busting query param
 */
async function uploadProfilePhoto(memberId, fileBuffer, mimeType) {
    const ext = MIME_TO_EXT[mimeType];
    if (!ext) {
        throw new Error(`Unsupported image type: ${mimeType}. Only JPEG, PNG, and WebP are allowed.`);
    }

    // Check for existing file (any extension) so we can update/replace
    const existing = await findExistingPhoto(memberId);

    // If existing file has a different extension, delete it first
    if (existing && existing.ext !== ext) {
        await fetch(`${API_BASE}/${existing.path}`, {
            method: 'DELETE',
            headers: headers(),
            body: JSON.stringify({
                message: `Delete old profile photo for member ${memberId}`,
                sha: existing.sha,
            }),
        });
    }

    const filePath = `members/${memberId}/profile-photo${ext}`;
    const body = {
        message: `Update profile photo for member ${memberId}`,
        content: fileBuffer.toString('base64'),
    };

    // Include sha to update in-place (same extension, or freshly uploaded)
    if (existing && existing.ext === ext) {
        body.sha = existing.sha;
    }

    const res = await fetch(`${API_BASE}/${filePath}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub upload failed (${res.status}): ${err}`);
    }

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/${GITHUB_USER_DATA_REPO}/main/${filePath}?t=${Date.now()}`;
    return rawUrl;
}

/**
 * Delete the member's profile photo from the repo.
 * Resolves silently if no photo exists.
 *
 * @param {number} memberId
 * @returns {Promise<void>}
 */
async function deleteProfilePhoto(memberId) {
    const existing = await findExistingPhoto(memberId);
    if (!existing) return; // nothing to delete

    const res = await fetch(`${API_BASE}/${existing.path}`, {
        method: 'DELETE',
        headers: headers(),
        body: JSON.stringify({
            message: `Delete profile photo for member ${memberId}`,
            sha: existing.sha,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`GitHub delete failed (${res.status}): ${err}`);
    }
}

// ── In-memory cache for profile photo proxy ──
const _photoCache = new Map();
const PHOTO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Download a member's profile photo via the GitHub API (works for private repos).
 * Returns { buffer, contentType } or null if no photo exists.
 *
 * @param {number} memberId
 * @returns {Promise<{ buffer: Buffer, contentType: string } | null>}
 */
async function downloadProfilePhoto(memberId) {
    // Check in-memory cache first
    const cached = _photoCache.get(memberId);
    if (cached && Date.now() - cached.ts < PHOTO_CACHE_TTL) {
        return { buffer: cached.buffer, contentType: cached.contentType };
    }

    const existing = await findExistingPhoto(memberId);
    if (!existing) return null;

    const res = await fetch(`${API_BASE}/${existing.path}`, {
        headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.raw+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType =
        existing.ext === '.jpg' ? 'image/jpeg'
            : existing.ext === '.png' ? 'image/png'
                : 'image/webp';

    // Store in cache
    _photoCache.set(memberId, { buffer, contentType, ts: Date.now() });

    return { buffer, contentType };
}

/**
 * Invalidate the in-memory photo cache for a member (call after upload/delete).
 * @param {number} memberId
 */
function invalidatePhotoCache(memberId) {
    _photoCache.delete(memberId);
}

module.exports = { uploadProfilePhoto, deleteProfilePhoto, downloadProfilePhoto, invalidatePhotoCache };
