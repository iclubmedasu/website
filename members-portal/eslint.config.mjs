import nextPlugin from '@next/eslint-plugin-next'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
    nextPlugin.flatConfig.coreWebVitals,
    {
        ignores: [
            '.next/**',
            'out/**',
            'build/**',
            'next-env.d.ts',
            'public/sw.js',
            'public/workbox-*.js',
            'public/fallback-*.js',
        ],
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-syntax': [
                'warn',
                {
                    selector: 'CallExpression[callee.property.name="toLocaleDateString"]',
                    message: 'Use formatDate from @iclub/shared/utils instead of toLocaleDateString.',
                },
                {
                    selector: 'CallExpression[callee.property.name="toLocaleString"][arguments.length>0]',
                    message: 'Use formatDateTime from @iclub/shared/utils instead of toLocaleString.',
                },
            ],
        },
    },
]
