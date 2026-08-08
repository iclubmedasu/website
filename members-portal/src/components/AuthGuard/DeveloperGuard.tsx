'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface DeveloperGuardProps {
    children: ReactNode
}

/** Restricts children to the developer backdoor account only. */
export function DeveloperGuard({ children }: DeveloperGuardProps) {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user && !user.isDeveloper) {
            router.replace('/dashboard')
        }
    }, [user, router])

    if (!user?.isDeveloper) {
        return null
    }

    return <>{children}</>
}
