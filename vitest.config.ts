import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    esbuild: {
        jsx: 'automatic'
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'members-portal/src'),
            '~': resolve(__dirname, 'members-portal/src')
        }
    },
    test: {
        environment: 'jsdom',
        environmentMatchGlobs: [
            ['backend/**', 'node']
        ],
        globals: true,
        setupFiles: ['./test-setup.ts'],
        include: ['**/*.{test,spec}.{ts,tsx}'],
        exclude: [
            '**/node_modules/**',
            '**/.next/**',
            '**/dist/**',
            '**/coverage/**',
            '**/generated/**',
            'e2e/**'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'html', 'lcov'],
            all: true,
            include: [
                'backend/**/*.ts',
                'members-portal/src/**/*.{ts,tsx}',
                'packages/shared/src/**/*.ts'
            ],
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
