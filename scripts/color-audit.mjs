#!/usr/bin/env node
/**
 * Lists color literals (#hex, rgb()/rgba(), PDF rgb(x/255), Excel argb) outside the
 * token definitions in each app's globals.css :root. See docs/css-standards.md §13.
 *
 *   pnpm color:audit            summary by file
 *   pnpm color:audit --strict   exit 1 if any literal remains (for CI once migrated)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');

const SCAN_DIRS = [
    'members-portal/src',
    'members-portal/public',
    'members-portal/worker',
    'public-website/src',
    'public-website/public',
    'backend/services',
    'backend/lib',
    'backend/routes',
    'backend/scripts',
    'packages/shared/src',
];
const EXTENSIONS = new Set(['.css', '.ts', '.tsx', '.js', '.mjs', '.json', '.html']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'out', '__tests__', 'generated']);

const PATTERNS = [
    /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
    /rgba?\(\s*\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}[^)]*\)/g,
    /rgb\(\s*\d{1,3}\s*\/\s*255[^)]*\)/g,
    /argb\s*:\s*['"][0-9a-fA-F]{8}['"]/g,
];
const TOKEN_DEFINITION = /^\s*--[\w-]+\s*:/;

function* walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
        } else if (EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.min.js')) {
            yield path.join(dir, entry.name);
        }
    }
}

const byFile = new Map();
let total = 0;

for (const scanDir of SCAN_DIRS) {
    for (const file of walk(path.join(root, scanDir))) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        const isGlobals = rel.endsWith('app/globals.css');
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
            if (isGlobals && TOKEN_DEFINITION.test(line)) return;
            for (const pattern of PATTERNS) {
                for (const match of line.matchAll(pattern)) {
                    total += 1;
                    if (!byFile.has(rel)) byFile.set(rel, []);
                    byFile.get(rel).push(`${index + 1}: ${match[0]}`);
                }
            }
        });
    }
}

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [file, hits] of sorted) {
    console.log(`${String(hits.length).padStart(4)}  ${file}`);
}
console.log(`\n${total} color literal(s) in ${byFile.size} file(s) outside token definitions.`);

if (strict && total > 0) {
    process.exit(1);
}
