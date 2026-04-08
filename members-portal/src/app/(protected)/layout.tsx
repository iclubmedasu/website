'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard/AuthGuard'
import { UnassignedGate } from '@/components/UnassignedGate/UnassignedGate'
import { AlumniGate } from '@/components/AlumniGate/AlumniGate'
import { SideBarNavigationSlim } from '@/components/SideBarNavigationSlim/SideBarNavigationSlim'
import { useAuth } from '@/context/AuthContext'
import { getNotificationsWebSocketUrl, notificationsAPI } from '@/services/api'
import type { NotificationRealtimeMessage } from '@/types/backend-contracts'
import {
    Users,
    FolderKanban,
    UserCircle,
    Bell,
    HelpCircle,
    GraduationCap,
    Shield,
    LayoutDashboard,
    Archive,
    Menu,
    X
} from 'lucide-react'

const NAV_ITEMS = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard
    },
    {
        label: 'Personnel',
        icon: Users,
        items: [
            { label: 'Teams', href: '/teams', icon: Users },
            { label: 'Members', href: '/members', icon: UserCircle },
            { label: 'Alumni', href: '/alumni', icon: GraduationCap },
            { label: 'Administration', href: '/administration', icon: Shield }
        ]
    },
    {
        label: 'Projects',
        icon: FolderKanban,
        items: [
            { label: 'Active Projects', href: '/projects', icon: FolderKanban },
            { label: 'Past Projects', href: '/past-projects', icon: Archive }
        ]
    },
    {
        label: 'Help & Support',
        href: '/help',
        icon: HelpCircle
    }
]

function PortalLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth()
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null)
    const wasMobileNavOpenRef = useRef(false)

    const refreshUnreadCount = useCallback(async () => {
        if (!user?.id) {
            setUnreadCount(0)
            return
        }

        try {
            const result = await notificationsAPI.getUnreadCount()
            setUnreadCount(Math.max(0, Number(result.unreadCount || 0)))
        } catch {
            // Keep previous value when refresh fails.
        }
    }, [user?.id])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 641px)')

        const handleMediaQueryChange = (event: MediaQueryListEvent) => {
            if (event.matches) {
                setIsMobileNavOpen(false)
            }
        }

        if (mediaQuery.matches) {
            setIsMobileNavOpen(false)
        }

        mediaQuery.addEventListener('change', handleMediaQueryChange)

        return () => {
            mediaQuery.removeEventListener('change', handleMediaQueryChange)
        }
    }, [])

    useEffect(() => {
        if (wasMobileNavOpenRef.current && !isMobileNavOpen) {
            mobileNavTriggerRef.current?.focus()
        }

        wasMobileNavOpenRef.current = isMobileNavOpen
    }, [isMobileNavOpen])

    useEffect(() => {
        void refreshUnreadCount()
    }, [refreshUnreadCount])

    useEffect(() => {
        if (!user?.id) {
            return
        }

        let isDisposed = false
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let socket: WebSocket | null = null

        const connect = () => {
            if (isDisposed) return

            socket = new WebSocket(getNotificationsWebSocketUrl())

            socket.onopen = () => {
                void refreshUnreadCount()
            }

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(String(event.data)) as NotificationRealtimeMessage
                    if (payload.type === 'notification.created') {
                        void refreshUnreadCount()
                    }
                } catch {
                    // Ignore malformed websocket payloads.
                }
            }

            socket.onerror = () => {
                socket?.close()
            }

            socket.onclose = () => {
                if (isDisposed) return
                reconnectTimer = setTimeout(connect, 2000)
            }
        }

        connect()

        return () => {
            isDisposed = true
            if (reconnectTimer) {
                clearTimeout(reconnectTimer)
            }
            socket?.close()
        }
    }, [refreshUnreadCount, user?.id])

    const footerItems = [
        {
            label: 'Notifications',
            href: '/user#notifications',
            icon: Bell,
            badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        },
        {
            label: 'My Profile',
            href: '/user',
            icon: UserCircle,
        },
    ]

    return (
        <AlumniGate>
            <UnassignedGate>
                <div className="protected-layout-shell">
                    <button
                        ref={mobileNavTriggerRef}
                        type="button"
                        className="protected-mobile-nav-toggle"
                        onClick={() => setIsMobileNavOpen((previous) => !previous)}
                        aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    >
                        {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <SideBarNavigationSlim
                        items={NAV_ITEMS}
                        footerItems={footerItems}
                        user={user}
                        onLogout={logout}
                        isMobileOpen={isMobileNavOpen}
                        onMobileOpenChange={setIsMobileNavOpen}
                        mobileNavigationId="protected-mobile-sidebar"
                    />
                    <div className="protected-layout-content">
                        {children}
                    </div>
                </div>
            </UnassignedGate>
        </AlumniGate>
    )
}

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <PortalLayout>
                {children}
            </PortalLayout>
        </AuthGuard>
    )
}
