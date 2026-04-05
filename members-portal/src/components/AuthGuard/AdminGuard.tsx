'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface AdminGuardProps {
    children: ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user && !user.isDeveloper && !user.isOfficer &&
            !user.isAdmin && !user.isLeadership) {
            router.replace('/teams')
        }
    }, [user, router])

    if (!user?.isDeveloper && !user?.isOfficer &&
        !user?.isAdmin && !user?.isLeadership) {
        return null
    }

    return <>{children}</>
}
