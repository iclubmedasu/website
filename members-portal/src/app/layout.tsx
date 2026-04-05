import type { Metadata } from 'next'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt/PWAInstallPrompt'
import './globals.css'

export const metadata: Metadata = {
    title: 'iClub Members Portal',
    description: 'iClub Members Portal',
    manifest: '/manifest.json',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
                <PWAInstallPrompt />
            </body>
        </html>
    )
}
