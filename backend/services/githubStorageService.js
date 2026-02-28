const { v4: uuidv4 } = require('uuid');

const OWNER = process.env.GITHUB_STORAGE_OWNER;
const REPO = process.env.GITHUB_STORAGE_REPO;
const TOKEN = process.env.GITHUB_STORAGE_TOKEN;

const BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

// GitHub Contents API limit: 100 MB per file, but base64 inflates ~33%,
// so the practical raw-file ceiling is ~75 MB.  We cap at 25 MB to stay
// well within safe territory and keep uploads snappy.
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function headers(extraAccept) {
    return {
        Authorization: `Bearer ${TOKEN}`,
        Accept: extraAccept || 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

/**
 * Upload a file to the GitHub storage repo.
 * If `existingSha` is provided the file is updated in-place at `existingPath`.
 *
 * @param {Buffer} fileBuffer
 * @param {string} originalFileName  e.g. "report.pdf"
 * @param {string} mimeType          e.g. "application/pdf"
 * @param {number|string} projectId  e.g. 42
 * @param {{ existingPath?: string, existingSha?: string }} [replaceOpts]
 * @returns {{ githubPath: string, githubSha: string }}
 */
async function uploadFile(fileBuffer, originalFileName, mimeType, projectId, replaceOpts = {}) {
    if (fileBuffer.length > MAX_FILE_BYTES) {
        throw new Error(
            `File too large (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB). ` +
            `Maximum allowed size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`
        );
    }

    // If replacing, reuse the same GitHub path; otherwise create a fresh one
    let githubPath;
    const bodyObj = {
        content: fileBuffer.toString('base64'),
    };

    if (replaceOpts.existingPath && replaceOpts.existingSha) {
        githubPath = replaceOpts.existingPath;
        bodyObj.message = `Update ${originalFileName}`;
        bodyObj.sha = replaceOpts.existingSha; // required for update
    } else {
        const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${uuidv4()}-${safeName}`;
        githubPath = `projects/${projectId}/${uniqueName}`;
        bodyObj.message = `Upload ${originalFileName}`;
    }

    const res = await fetch(`${BASE}/${githubPath}`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub upload failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
        githubPath,
        githubSha: data.content.sha,
    };
}

/**
 * Delete a file from the GitHub storage repo.
 * @param {string} githubPath  e.g. "projects/42/uuid-filename.pdf"
 * @param {string} githubSha   Blob SHA
 */
async function deleteFile(githubPath, githubSha) {
    const body = JSON.stringify({
        message: `Delete ${githubPath}`,
        sha: githubSha,
    });

    const res = await fetch(`${BASE}/${githubPath}`, {
        method: 'DELETE',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body,
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`GitHub delete failed (${res.status}): ${err}`);
    }
}

/**
 * Download a file from the GitHub storage repo (raw bytes).
 * Returns the fetch Response so the caller can pipe it.
 * @param {string} githubPath
 * @returns {Response}
 */
async function downloadFile(githubPath) {
    const res = await fetch(`${BASE}/${githubPath}`, {
        headers: headers('application/vnd.github.raw+json'),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub download failed (${res.status}): ${err}`);
    }

    return res;
}

module.exports = { uploadFile, deleteFile, downloadFile, getFileHistory, downloadFileAtVersion };

/**
 * Get the commit history for a specific file.
 * Returns an array of commits (newest first).
 * @param {string} githubPath  e.g. "projects/42/uuid-filename.pdf"
 * @returns {Array<{ sha: string, message: string, date: string, author: string }>}
 */
async function getFileHistory(githubPath) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${encodeURIComponent(githubPath)}&per_page=50`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub history failed (${res.status}): ${err}`);
    }

    const commits = await res.json();
    return commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author.date,
        author: c.commit.author.name,
    }));
}

/**
 * Download a file at a specific commit version.
 * Returns the fetch Response so the caller can pipe it.
 * @param {string} githubPath
 * @param {string} commitSha
 * @returns {Response}
 */
async function downloadFileAtVersion(githubPath, commitSha) {
    const url = `${BASE}/${githubPath}?ref=${commitSha}`;
    const res = await fetch(url, {
        headers: headers('application/vnd.github.raw+json'),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub version download failed (${res.status}): ${err}`);
    }

    return res;
}
