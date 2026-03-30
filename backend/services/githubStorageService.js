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

async function uploadContentAtPath(contentBuffer, githubPath, message, existingSha) {
    const bodyObj = {
        content: contentBuffer.toString('base64'),
        message,
    };

    if (existingSha) {
        bodyObj.sha = existingSha;
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

    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${uuidv4()}-${safeName}`;

    let githubPath = replaceOpts.existingPath || `projects/${projectId}/${uniqueName}`;
    const message = replaceOpts.existingPath
        ? `Update ${originalFileName}`
        : `Upload ${originalFileName}`;

    return uploadContentAtPath(
        fileBuffer,
        githubPath,
        message,
        replaceOpts.existingSha,
    );
}

/**
 * Upload arbitrary content to an explicit GitHub path.
 * Useful for folder marker files such as .gitkeep.
 *
 * @param {Buffer} contentBuffer
 * @param {string} githubPath
 * @param {string} message
 * @param {string|undefined} existingSha
 * @returns {{ githubPath: string, githubSha: string }}
 */
async function uploadContent(contentBuffer, githubPath, message, existingSha) {
    return uploadContentAtPath(contentBuffer, githubPath, message, existingSha);
}

/**
 * Move a file to a new GitHub path by creating the new file and deleting the old one.
 * This updates the repository contents, but the file history remains path-based.
 * @param {string} fromGithubPath
 * @param {string} toGithubPath
 * @param {string} fromGithubSha
 * @param {string} message
 * @returns {{ githubPath: string, githubSha: string }}
 */
async function moveFile(fromGithubPath, toGithubPath, fromGithubSha, message) {
    if (fromGithubPath === toGithubPath) {
        return { githubPath: fromGithubPath, githubSha: fromGithubSha };
    }

    const downloadRes = await fetch(`${BASE}/${fromGithubPath}`, {
        headers: headers('application/vnd.github.raw+json'),
    });

    if (!downloadRes.ok) {
        const err = await downloadRes.text();
        throw new Error(`GitHub move source fetch failed (${downloadRes.status}): ${err}`);
    }

    const contentBuffer = Buffer.from(await downloadRes.arrayBuffer());
    const uploadRes = await fetch(`${BASE}/${toGithubPath}`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: contentBuffer.toString('base64'),
            message,
        }),
    });

    if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`GitHub move upload failed (${uploadRes.status}): ${err}`);
    }

    const uploadData = await uploadRes.json();
    const newSha = uploadData?.content?.sha;

    const deleteRes = await fetch(`${BASE}/${fromGithubPath}`, {
        method: 'DELETE',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Move ${fromGithubPath} to ${toGithubPath}`,
            sha: fromGithubSha,
        }),
    });

    if (!deleteRes.ok) {
        const err = await deleteRes.text();
        // Best-effort rollback to avoid leaving duplicate files in the repo.
        try {
            await fetch(`${BASE}/${toGithubPath}`, {
                method: 'DELETE',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Rollback failed move ${toGithubPath}`,
                    sha: newSha,
                }),
            });
        } catch {
            // ignore rollback errors; original delete failure will be reported below
        }
        throw new Error(`GitHub move delete failed (${deleteRes.status}): ${err}`);
    }

    return {
        githubPath: toGithubPath,
        githubSha: newSha,
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

module.exports = { uploadFile, uploadContent, moveFile, deleteFile, downloadFile, getFileHistory, downloadFileAtVersion, restoreDeletedFile };

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

/**
 * Restore a deleted file from GitHub repository history.
 * Finds the last version before deletion and re-creates the file at the same path.
 * @param {string} githubPath  e.g. "projects/42/uuid-filename.pdf"
 * @returns {{ githubSha: string }}
 */
async function restoreDeletedFile(githubPath) {
    // 1. Get commit history — includes all commits that touched this path, even after deletion
    const commits = await getFileHistory(githubPath);
    if (!commits || commits.length === 0) {
        throw new Error('No history found for this file — cannot restore');
    }

    // The most recent commit is the deletion; pick the one right after it for the last good version.
    // If there is only one commit (unlikely — that would be the deletion itself), we still try it.
    const restoreCommit = commits.length >= 2 ? commits[1] : commits[0];

    // 2. Fetch the file content at that commit (JSON mode to get base64 content)
    const contentUrl = `${BASE}/${githubPath}?ref=${restoreCommit.sha}`;
    const contentRes = await fetch(contentUrl, { headers: headers() });
    if (!contentRes.ok) {
        const err = await contentRes.text();
        throw new Error(`Failed to fetch file at commit ${restoreCommit.sha}: ${err}`);
    }
    const contentData = await contentRes.json();

    // 3. Re-create the file on GitHub (PUT without sha = create new file)
    const createRes = await fetch(`${BASE}/${githubPath}`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Restore ${githubPath}`,
            content: contentData.content.replace(/\n/g, ''), // strip line-breaks from base64
        }),
    });

    if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`GitHub restore failed (${createRes.status}): ${err}`);
    }

    const result = await createRes.json();
    return { githubSha: result.content.sha };
}
