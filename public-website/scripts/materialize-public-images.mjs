import fs from "fs";
import path from "path";

const repo = process.env.GITHUB_REPO ?? "iclubmedasu/website";
const imagesDir = path.join("public-website", "public", "images");
const retryDelaysMs = [2000, 4000, 8000, 16000, 32000];

function resolveGitRef() {
    if (process.env.SOURCE_GIT_REF?.trim()) {
        return process.env.SOURCE_GIT_REF.trim();
    }

    const refFile = path.join("public-website", "SOURCE_GIT_REF");
    if (fs.existsSync(refFile)) {
        return fs.readFileSync(refFile, "utf8").trim();
    }

    return "main";
}

function isPng(buffer) {
    return buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function parseRetryAfterMs(response) {
    const header = response.headers.get("retry-after");
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000;
    }
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
        return Math.max(dateMs - Date.now(), 0);
    }
    return null;
}

async function fetchWithRetry(url, init, label) {
    const attempts = retryDelaysMs.length + 1;
    let lastStatus = 0;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const response = await fetch(url, init);
        if (response.ok) {
            return response;
        }

        lastStatus = response.status;
        const retryable = response.status === 429 || response.status === 503;
        if (!retryable || attempt >= attempts - 1) {
            throw new Error(`Failed to fetch ${label}: HTTP ${response.status}`);
        }

        const waitMs = parseRetryAfterMs(response) ?? retryDelaysMs[attempt];
        console.warn(`Retrying ${label} after HTTP ${response.status} (attempt ${attempt + 2}/${attempts}, wait ${waitMs}ms)`);
        await sleep(waitMs);
    }

    throw new Error(`Failed to fetch ${label}: HTTP ${lastStatus}`);
}

async function fetchPngFromGitHubApi(relPath, ref, token) {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${relPath}?ref=${encodeURIComponent(ref)}`;
    const response = await fetchWithRetry(
        apiUrl,
        {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "iclub-materialize-public-images",
            },
        },
        `${relPath} (GitHub API)`,
    );

    const payload = await response.json();
    if (!payload?.content || payload.encoding !== "base64") {
        throw new Error(`${relPath} from GitHub API is not base64 content`);
    }

    return Buffer.from(payload.content.replace(/\n/g, ""), "base64");
}

async function fetchPngFromRawGitHub(relPath, ref) {
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${ref}/${relPath}`;
    const response = await fetchWithRetry(rawUrl, undefined, `${relPath} (raw.githubusercontent.com)`);
    return Buffer.from(await response.arrayBuffer());
}

async function materializePng(relPath, ref) {
    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) {
        try {
            return await fetchPngFromGitHubApi(relPath, ref, token);
        } catch (error) {
            console.warn(`GitHub API fetch failed for ${relPath}: ${error instanceof Error ? error.message : error}`);
        }
    }

    return fetchPngFromRawGitHub(relPath, ref);
}

const ref = resolveGitRef();
const pngFiles = fs.readdirSync(imagesDir).filter((file) => file.endsWith(".png"));

for (const file of pngFiles) {
    const relPath = `public-website/public/images/${file}`;
    const localPath = path.join(imagesDir, file);
    const existing = fs.readFileSync(localPath);

    if (isPng(existing)) {
        console.log(`OK ${relPath} (${existing.length} bytes)`);
        continue;
    }

    console.log(`Materializing ${relPath} from ${ref}...`);
    const data = await materializePng(relPath, ref);
    if (!isPng(data)) {
        throw new Error(`${relPath} from GitHub is not a PNG (${data.length} bytes)`);
    }

    fs.writeFileSync(localPath, data);
    console.log(`Materialized ${relPath} (${data.length} bytes) from ${ref}`);

    // Avoid burst rate limits when multiple pointer stubs need fetching.
    await sleep(500);
}
