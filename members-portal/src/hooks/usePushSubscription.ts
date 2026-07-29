'use client'

import { useCallback, useEffect, useState } from 'react'
import { pushSubscriptionsAPI } from '@/services/api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

function isPushSupported(): boolean {
    return (
        typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window
    )
}

export function usePushSubscription() {
    const [isSupported, setIsSupported] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [isSubscribing, setIsSubscribing] = useState(false)

    useEffect(() => {
        const supported = isPushSupported()
        setIsSupported(supported)
        if (supported) {
            setPermission(Notification.permission)
        }
    }, [])

    const refreshPermission = useCallback(() => {
        if (!isPushSupported()) return
        setPermission(Notification.permission)
    }, [])

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isPushSupported()) return false

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
        if (!vapidPublicKey) {
            console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
            return false
        }

        setIsSubscribing(true)
        try {
            const registration = await navigator.serviceWorker.ready
            const existing = await registration.pushManager.getSubscription()
            const pushSubscription = existing
                || await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
                })

            const json = pushSubscription.toJSON()
            const endpoint = json.endpoint
            const p256dh = json.keys?.p256dh
            const auth = json.keys?.auth

            if (!endpoint || !p256dh || !auth) {
                throw new Error('Incomplete push subscription keys')
            }

            await pushSubscriptionsAPI.subscribe({
                endpoint,
                keys: { p256dh, auth },
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            })

            setPermission(Notification.permission)
            return true
        } catch (error) {
            console.error('Push subscribe failed', error)
            setPermission(Notification.permission)
            return false
        } finally {
            setIsSubscribing(false)
        }
    }, [])

    return {
        isSupported,
        permission,
        isSubscribing,
        subscribe,
        refreshPermission,
    }
}
