'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard/AuthGuard'
import { useAuth } from '@/context/AuthContext'

interface AnnouncementManagerGateProps {
    children: ReactNode
}

function canManageAnnouncements(user: {
    isDeveloper?: boolean
    isOfficer?: boolean
    isAdmin?: boolean
    isLeadership?: boolean
    isSpecial?: boolean
} | null | undefined): boolean {
    if (!user) return false
    return !!(
        user.isDeveloper ||
        user.isOfficer ||
        user.isAdmin ||
        user.isLeadership ||
        user.isSpecial
    )
}

function AnnouncementManagerCheck({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user && !canManageAnnouncements(user)) {
            router.replace('/teams')
        }
    }, [user, router])

    if (!canManageAnnouncements(user)) {
        return null
    }

    return <>{children}</>
}

export default function AnnouncementManagerGate({ children }: AnnouncementManagerGateProps) {
    return (
        <AuthGuard>
            <AnnouncementManagerCheck>{children}</AnnouncementManagerCheck>
        </AuthGuard>
    )
}
