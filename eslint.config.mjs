import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
    {
        linterOptions: {
            reportUnusedDisableDirectives: false
        }
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true }
            }
        },
        plugins: {
            '@typescript-eslint': typescript,
            'react': reactPlugin,
            'react-hooks': reactHooks
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'error',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'off',
            'no-console': 'off'
        }
    },
    {
        ignores: [
            '**/node_modules/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/.git/**',
            '**/generated/**',
            '**/prisma/migrations/**'
        ]
    }
]
