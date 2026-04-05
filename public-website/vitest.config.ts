import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        passWithNoTests: true,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**']
    }
})
