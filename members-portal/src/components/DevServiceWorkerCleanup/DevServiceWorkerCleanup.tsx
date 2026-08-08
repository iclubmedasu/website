'use client'

import { useEffect } from 'react'

/**
 * Development-only: if a leftover production service worker is still registered
 * for this origin (e.g. after `next build` + `next start` on the same port as
 * `next dev`), unregister it and wipe Cache Storage so the page stops serving
 * stale precached JS/CSS. Does nothing in production builds.
 */
export function DevServiceWorkerCleanup() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return
        if (!('serviceWorker' in navigator)) return

        void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
            if (registrations.length === 0) return

            await Promise.all(registrations.map((registration) => registration.unregister()))

            if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map((key) => caches.delete(key)))
            }

            window.location.reload()
        })
    }, [])

    return null
}
