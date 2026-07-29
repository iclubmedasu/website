'use client'

import { useEffect, useRef, useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import './PushNotificationPrompt.css'

const hasVapidKey = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim())

export function PushNotificationPrompt() {
    const {
        isSupported,
        permission,
        isSubscribing,
        subscribe,
        refreshPermission,
    } = usePushSubscription()
    const [subscribeError, setSubscribeError] = useState<string | null>(null)
    const autoSubscribeStarted = useRef(false)

    useEffect(() => {
        if (!isSupported || !hasVapidKey) return
        if (permission !== 'granted') return
        if (autoSubscribeStarted.current) return

        autoSubscribeStarted.current = true
        void subscribe().then((ok) => {
            if (!ok) {
                autoSubscribeStarted.current = false
                setSubscribeError('Could not register notifications. Please try again.')
            } else {
                setSubscribeError(null)
            }
        })
    }, [isSupported, permission, subscribe])

    if (!isSupported || !hasVapidKey) return null
    if (permission === 'granted' && !subscribeError) return null

    const isDenied = permission === 'denied'

    const handleEnable = async () => {
        setSubscribeError(null)
        const ok = await subscribe()
        if (!ok) {
            setSubscribeError('Could not enable notifications. Please try again.')
        }
    }

    const handleTryAgain = async () => {
        setSubscribeError(null)
        refreshPermission()
        const current = Notification.permission
        if (current === 'denied') {
            setSubscribeError(
                'Notifications are still blocked. Allow them in your browser settings, then try again.',
            )
            return
        }
        const ok = await subscribe()
        if (!ok) {
            setSubscribeError('Could not enable notifications. Please try again.')
        }
    }

    return (
        <div
            className="push-gate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-gate-title"
            aria-describedby="push-gate-desc"
        >
            <div className="push-gate-card">
                <h2 id="push-gate-title" className="push-gate-title">
                    {isDenied ? 'Notifications are blocked' : 'Enable notifications to continue'}
                </h2>
                <p id="push-gate-desc" className="push-gate-subtitle">
                    {isDenied
                        ? 'Club announcements and updates require browser notifications. Open your browser or site settings, allow notifications for this site, then tap Try again.'
                        : 'Notifications are required so you receive club announcements and important updates. Enable them to use the members portal.'}
                </p>
                {subscribeError ? (
                    <p className="push-gate-error" role="alert">{subscribeError}</p>
                ) : null}
                <div className="push-gate-actions">
                    {isDenied ? (
                        <button
                            className="push-btn push-btn--primary"
                            onClick={() => void handleTryAgain()}
                            type="button"
                            disabled={isSubscribing}
                        >
                            {isSubscribing ? 'Checking…' : 'Try again'}
                        </button>
                    ) : (
                        <button
                            className="push-btn push-btn--primary"
                            onClick={() => void handleEnable()}
                            type="button"
                            disabled={isSubscribing}
                        >
                            {isSubscribing ? 'Enabling…' : 'Enable notifications'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
