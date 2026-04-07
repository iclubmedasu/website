'use client'

import { useEffect, useRef, useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard/AuthGuard'
import { UnassignedGate } from '@/components/UnassignedGate/UnassignedGate'
import { AlumniGate } from '@/components/AlumniGate/AlumniGate'
import { SideBarNavigationSlim } from '@/components/SideBarNavigationSlim/SideBarNavigationSlim'
import { useAuth } from '@/context/AuthContext'
import {
    Users,
    FolderKanban,
    UserCircle,
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

const FOOTER_ITEMS: Array<{
    label: string
    href: string
    icon: typeof UserCircle
}> = [
        // { label: 'My Profile', href: '/user', icon: UserCircle }
    ]

function PortalLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth()
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
    const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null)
    const wasMobileNavOpenRef = useRef(false)

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
                        footerItems={FOOTER_ITEMS}
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
