import nextPlugin from '@next/eslint-plugin-next'

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
