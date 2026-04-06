'use client'

import { useState, useEffect } from 'react'
import './PWAInstallPrompt.css'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false
    return /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream !== undefined
}

function isInStandaloneMode(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

type PromptState = 'hidden' | 'android' | 'ios'

export function PWAInstallPrompt() {
    const [promptState, setPromptState] = useState<PromptState>('hidden')
    const [installEvent, setInstallEvent] =
        useState<BeforeInstallPromptEvent | null>(null)
    const [iosStep, setIosStep] = useState(1)

    useEffect(() => {
        // Already installed — never show
        if (isInStandaloneMode()) return

        // Already dismissed this session
        if (sessionStorage.getItem('pwa-prompt-dismissed')) return

        // iOS — show manual guide after a delay
        if (isIOS()) {
            const timer = setTimeout(() => {
                setPromptState('ios')
            }, 5000) // Show after 5 seconds
            return () => clearTimeout(timer)
        }

        // Android/Chrome — listen for native prompt
        const handler = (e: Event) => {
            e.preventDefault()
            setInstallEvent(e as BeforeInstallPromptEvent)
            setPromptState('android')
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleAndroidInstall = async () => {
        if (!installEvent) return
        await installEvent.prompt()
        const { outcome } = await installEvent.userChoice
        if (outcome === 'accepted') {
            setPromptState('hidden')
        }
        setInstallEvent(null)
    }

    const handleDismiss = () => {
        setPromptState('hidden')
        sessionStorage.setItem('pwa-prompt-dismissed', 'true')
    }

    if (promptState === 'hidden') return null

    // Android prompt
    if (promptState === 'android') {
        return (
            <div className="pwa-prompt pwa-prompt--android" role="dialog"
                aria-label="Install iClub app">
                <div className="pwa-prompt-content">
                    <div className="pwa-prompt-icon">📱</div>
                    <div className="pwa-prompt-text">
                        <p className="pwa-prompt-title">Install iClub Portal</p>
                        <p className="pwa-prompt-subtitle">
                            Add to your home screen for quick access
                        </p>
                    </div>
                    <div className="pwa-prompt-actions">
                        <button
                            className="pwa-btn pwa-btn--primary"
                            onClick={handleAndroidInstall}
                            type="button"
                        >
                            Install
                        </button>
                        <button
                            className="pwa-btn pwa-btn--dismiss"
                            onClick={handleDismiss}
                            type="button"
                        >
                            Not now
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // iOS manual guide
    return (
        <div className="pwa-prompt pwa-prompt--ios" role="dialog"
            aria-label="Add iClub to home screen">
            <div className="pwa-prompt-ios-header">
                <p className="pwa-prompt-title">Add to Home Screen</p>
                <button
                    className="pwa-prompt-close"
                    onClick={handleDismiss}
                    type="button"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            <div className="pwa-prompt-ios-steps">
                <div
                    className={`pwa-ios-step ${iosStep === 1 ? 'active' : ''}`}
                    onClick={() => setIosStep(1)}
                >
                    <div className="pwa-ios-step-num">1</div>
                    <div className="pwa-ios-step-content">
                        <p className="pwa-ios-step-title">
                            Tap the Share button
                        </p>
                        <p className="pwa-ios-step-hint">
                            The <strong>□↑</strong> icon at the bottom of Safari
                        </p>
                    </div>
                </div>

                <div
                    className={`pwa-ios-step ${iosStep === 2 ? 'active' : ''}`}
                    onClick={() => setIosStep(2)}
                >
                    <div className="pwa-ios-step-num">2</div>
                    <div className="pwa-ios-step-content">
                        <p className="pwa-ios-step-title">
                            Tap &ldquo;Add to Home Screen&rdquo;
                        </p>
                        <p className="pwa-ios-step-hint">
                            Scroll down in the share menu to find it
                        </p>
                    </div>
                </div>

                <div
                    className={`pwa-ios-step ${iosStep === 3 ? 'active' : ''}`}
                    onClick={() => setIosStep(3)}
                >
                    <div className="pwa-ios-step-num">3</div>
                    <div className="pwa-ios-step-content">
                        <p className="pwa-ios-step-title">
                            Tap &ldquo;Add&rdquo;
                        </p>
                        <p className="pwa-ios-step-hint">
                            iClub Portal will appear on your home screen
                        </p>
                    </div>
                </div>
            </div>

            <button
                className="pwa-btn pwa-btn--dismiss pwa-btn--full"
                onClick={handleDismiss}
                type="button"
            >
                Maybe later
            </button>
        </div>
    )
}
