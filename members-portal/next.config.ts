import type { NextConfig } from 'next'
import withPWA from 'next-pwa'

const nextConfig: NextConfig = {
    images: {
        unoptimized: true,
    },
}

const pwaConfig = withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    // Disable PWA in development — service workers cause confusion
    disable: process.env.NODE_ENV === 'development',
    // Do not cache/intercept the start URL — server redirects (e.g. / → /login)
    // produce opaqueredirect responses that break NetworkFirst navigation caching.
    cacheStartUrl: false,
    dynamicStartUrl: false,
    // Serve offline.html only when a navigation truly fails (no network).
    fallbacks: {
        document: '/offline.html',
    },
    // Exclude build artifacts not served at runtime to avoid install failures.
    buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
    navigateFallbackDenylist: [
        /^\/favicon\.ico$/,
        /^\/icons\//,
        /^\/manifest\.json$/,
        /^\/sw\.js$/,
        /^\/workbox-.*\.js$/,
        /^\/fallback-.*\.js$/,
        /^\/offline\.html$/,
        /\.(?:png|ico|svg|webp|jpg|jpeg|gif|woff2?)$/i,
    ],
    runtimeCaching: [
        {
            // Cache public static assets (favicon, PWA icons, manifest)
            urlPattern: /\/(favicon\.ico|icons\/.*|manifest\.json|screenshots\/.*)$/,
            handler: 'CacheFirst',
            options: {
                cacheName: 'public-static',
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 365 * 24 * 60 * 60,
                },
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        {
            // Cache static assets aggressively
            urlPattern: /\/_next\/static\/.*/,
            handler: 'CacheFirst',
            options: {
                cacheName: 'static-assets',
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
            },
        },
        {
            // Cache fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
                cacheName: 'fonts-cache',
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 365 * 24 * 60 * 60,
                },
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        {
            // Profile photos — cache with revalidation
            urlPattern: /\/api\/members\/\d+\/profile-photo/,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'profile-photos',
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
            },
        },
        {
            // NEVER cache API calls — always use network for data
            urlPattern: /\/api\/.*/,
            handler: 'NetworkOnly',
            options: {
                cacheName: 'api-cache',
            },
        },
    ],
})

export default pwaConfig(nextConfig)
