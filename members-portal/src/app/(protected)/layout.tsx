'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard/AuthGuard'
import { UnassignedGate } from '@/components/UnassignedGate/UnassignedGate'
import { AlumniGate } from '@/components/AlumniGate/AlumniGate'
import { SideBarNavigationSlim } from '@/components/SideBarNavigationSlim/SideBarNavigationSlim'
import { useAuth } from '@/context/AuthContext'
import { RealtimeProvider, useOptionalRealtimeContext } from '@/context/RealtimeContext'
import { notificationsAPI } from '@/services/api'
import type { NotificationRealtimeMessage } from '@/types/backend-contracts'
import {
    Users,
    FolderKanban,
    Calendar,
    UserCircle,
    Bell,
    HelpCircle,
    GraduationCap,
    Shield,
    LayoutDashboard,
    Archive,
    Menu,
    X,
    Globe,
    Info,
    Mail,
    LifeBuoy,
    Wallet,
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
        label: 'Events',
        icon: Calendar,
        items: [
            { label: 'Events', href: '/events', icon: Calendar },
            { label: 'Past Events', href: '/past-events', icon: Archive },
        ],
    },
    {
        label: 'Finance',
        href: '/finance',
        icon: Wallet,
        requiresFinanceAccess: true,
    },
    {
        label: 'General',
        icon: Globe,
        items: [
            { label: 'Help & Support', href: '/help', icon: HelpCircle },
            { label: 'Support page', href: '/general/support', icon: LifeBuoy },
            { label: 'About', href: '/general/about', icon: Info },
            { label: 'Contact', href: '/general/contact', icon: Mail },
        ],
    }
]

function getNavItems(user: ReturnType<typeof useAuth>['user']) {
    const canEditSite = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin)
    const canEditSupport = canEditSite || !!user?.isSupportFormsEditor
    const canViewFinance = canEditSite || !!user?.isFinanceViewer

    return NAV_ITEMS
        .filter((item) => !item.requiresFinanceAccess || canViewFinance)
        .map((item) => {
        if (item.label !== 'General' || !item.items) return item
        return {
            ...item,
            items: item.items.filter((subItem) => {
                if (subItem.href === '/help') return true
                if (subItem.href === '/general/about' || subItem.href === '/general/contact') return canEditSite
                if (subItem.href === '/general/support') return canEditSupport
                return true
            }),
        }
    })
}

function PortalLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth()
    const navItems = useMemo(() => getNavItems(user), [user])
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

    const realtime = useOptionalRealtimeContext()

    useEffect(() => {
        if (!realtime || !user?.id) {
            return
        }

        return realtime.subscribe('__notifications__', (payload: NotificationRealtimeMessage) => {
            if (payload.type === 'notification.created') {
                void refreshUnreadCount()
            }
        })
    }, [realtime, refreshUnreadCount, user?.id])

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
                        items={navItems}
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
            <RealtimeProvider>
                <PortalLayout>
                    {children}
                </PortalLayout>
            </RealtimeProvider>
        </AuthGuard>
    )
}
