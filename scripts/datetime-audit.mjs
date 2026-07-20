#!/usr/bin/env node
/**
 * CI-friendly grep for banned ad-hoc datetime patterns in app source.
 * Allowed in packages/shared/src/utils/** (canonical implementations).
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCANS = [
    {
        name: 'toLocaleDateString',
        pattern: 'toLocaleDateString',
    },
    {
        name: 'toLocaleString on Date',
        pattern: 'toLocaleString',
    },
    {
        name: 'toISOString().split',
        pattern: "toISOString\\(\\)\\.split\\('T'\\)",
    },
    {
        name: 'slice(0, 10) on strings',
        pattern: '\\.slice\\(0,\\s*10\\)',
    },
];

const SEARCH_ROOTS = [
    'members-portal/src',
    'public-website/src',
    'backend',
];

const ALLOWED_PREFIXES = [
    'packages/shared/src/utils/',
    'backend/lib/finance.ts',
];

function runRipgrep(pattern, searchPath) {
    try {
        const cmd = [
            'rg',
            '--no-heading',
            '--line-number',
            '--glob', '!**/node_modules/**',
            '--glob', '!**/.next/**',
            '--glob', '!**/dist/**',
            pattern,
            searchPath,
        ].join(' ');
        return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
}

function isAllowed(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/');
    return ALLOWED_PREFIXES.some((prefix) => normalized.includes(prefix));
}

let failed = false;

for (const scan of SCANS) {
    const hits = [];
    for (const searchRoot of SEARCH_ROOTS) {
        const output = runRipgrep(scan.pattern, searchRoot);
        if (!output) continue;
        for (const line of output.split('\n')) {
            const filePath = line.split(':')[0];
            if (!isAllowed(filePath)) {
                hits.push(line);
            }
        }
    }
    if (hits.length > 0) {
        failed = true;
        console.error(`\n❌ ${scan.name} — ${hits.length} violation(s):`);
        for (const hit of hits) {
            console.error(`  ${hit}`);
        }
    } else {
        console.log(`✓ ${scan.name}`);
    }
}

if (failed) {
    console.error('\nDatetime audit failed. Use helpers from @iclub/shared/utils — see .cursor/rules/datetime.mdc');
    process.exit(1);
}

console.log('\nDatetime audit passed.');
