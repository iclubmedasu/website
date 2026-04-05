'use client';

import { useEffect, useState } from 'react';
import './PWAInstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
}

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
        if (isStandalone) {
            setVisible(false);
            return;
        }

        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            setVisible(true);
        };

        const handleAppInstalled = () => {
            setVisible(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleDismiss = () => {
        setVisible(false);
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setVisible(false);
        setDeferredPrompt(null);
    };

    if (!visible || !deferredPrompt) {
        return null;
    }

    return (
        <div className="pwa-install-banner" role="dialog" aria-live="polite" aria-label="Install app prompt">
            <div className="pwa-install-content">
                <div className="pwa-install-text-block">
                    <p className="pwa-install-title">Install iClub Members Portal</p>
                    <p className="pwa-install-subtitle">Get faster access from your home screen.</p>
                </div>
                <div className="pwa-install-actions">
                    <button type="button" className="pwa-install-btn pwa-install-btn-primary" onClick={handleInstall}>
                        Install
                    </button>
                    <button type="button" className="pwa-install-btn pwa-install-btn-secondary" onClick={handleDismiss}>
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
}
