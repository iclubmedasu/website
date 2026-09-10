import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const sharedAlias = {
    '@': resolve(__dirname, 'members-portal/src'),
    '~': resolve(__dirname, 'members-portal/src')
}

const sharedExclude = [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/coverage/**',
    '**/generated/**',
    'e2e/**'
]

export default defineConfig({
    // Vite 8 / Vitest 4 use Oxc for transforms; esbuild.jsx is ignored.
    oxc: {
        jsx: {
            runtime: 'automatic'
        }
    },
    resolve: {
        alias: sharedAlias
    },
    test: {
        globals: true,
        setupFiles: ['./test-setup.ts'],
        exclude: sharedExclude,
        // Vitest 4 removed environmentMatchGlobs — use projects instead.
        projects: [
            {
                resolve: { alias: sharedAlias },
                test: {
                    name: 'backend',
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./test-setup.ts'],
                    include: ['backend/**/*.{test,spec}.{ts,tsx}'],
                    exclude: sharedExclude
                }
            },
            {
                oxc: {
                    jsx: {
                        runtime: 'automatic'
                    }
                },
                resolve: { alias: sharedAlias },
                test: {
                    name: 'frontend',
                    environment: 'jsdom',
                    globals: true,
                    setupFiles: ['./test-setup.ts'],
                    include: [
                        'members-portal/**/*.{test,spec}.{ts,tsx}',
                        'packages/**/*.{test,spec}.{ts,tsx}',
                        'public-website/**/*.{test,spec}.{ts,tsx}'
                    ],
                    exclude: sharedExclude
                }
            }
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'html', 'lcov'],
            exclude: [
                '**/*.d.ts',
                '**/__tests__/**',
                '**/*.test.*',
                '**/*.spec.*',
                'backend/generated/**',
                'members-portal/src/main.*',
                'e2e/**'
            ],
            thresholds: {
                lines: 60,
                functions: 60,
                statements: 60,
                branches: 50
            }
        }
    }
})
