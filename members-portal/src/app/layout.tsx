import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { OfflineBanner } from '@/components/OfflineBanner/OfflineBanner'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt/PWAInstallPrompt'
import { PWAServiceWorkerRegistration } from '@/components/PWAServiceWorkerRegistration/PWAServiceWorkerRegistration'
import './globals.css'

export const metadata: Metadata = {
    title: {
        default: 'iClub Members Portal',
        template: '%s — iClub'
    },
    description: 'iClub Members Portal — Project management and team coordination',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'iClub Portal',
        startupImage: [
            {
                url: '/icons/icon-512x512.png',
            }
        ]
    },
    formatDetection: {
        telephone: false
    },
    openGraph: {
        type: 'website',
        siteName: 'iClub Members Portal',
        title: 'iClub Members Portal',
        description: 'Project management and team coordination for iClub members'
    },
    icons: {
        icon: [
            { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ],
        apple: [
            { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
            { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }
        ],
        shortcut: '/icons/icon-192x192.png'
    }
}

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#662f91' },
        { media: '(prefers-color-scheme: dark)', color: '#662f91' }
    ],
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover'
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <PWAServiceWorkerRegistration />
                <AuthProvider>
                    <OfflineBanner />
                    {children}
                    <PWAInstallPrompt />
                </AuthProvider>
            </body>
        </html>
    )
}
