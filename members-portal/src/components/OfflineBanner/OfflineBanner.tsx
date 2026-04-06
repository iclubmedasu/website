'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import './OfflineBanner.css'

export function OfflineBanner() {
    const isOnline = useOnlineStatus()

    if (isOnline) return null

    return (
        <div className="offline-banner" role="alert" aria-live="polite">
            <span className="offline-banner-icon">📡</span>
            <span className="offline-banner-text">
                You are offline — some features may be unavailable
            </span>
        </div>
    )
}
