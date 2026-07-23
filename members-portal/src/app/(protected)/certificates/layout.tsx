'use client'

import { AdminGuard } from '@/components/AuthGuard/AdminGuard'

export default function CertificatesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AdminGuard>{children}</AdminGuard>
}
