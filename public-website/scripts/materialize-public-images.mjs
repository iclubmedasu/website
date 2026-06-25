import fs from "fs";
import path from "path";

const repo = process.env.GITHUB_REPO ?? "iclubmedasu/website";
const imagesDir = path.join("public-website", "public", "images");

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

    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${relPath}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }

    const data = Buffer.from(await response.arrayBuffer());
    if (!isPng(data)) {
        throw new Error(`${relPath} from GitHub is not a PNG (${data.length} bytes)`);
    }

    fs.writeFileSync(localPath, data);
    console.log(`Materialized ${relPath} (${data.length} bytes) from ${ref}`);
}
