'use client'

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
    Archive
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

const FOOTER_ITEMS = [
    { label: 'My Profile', href: '/user', icon: UserCircle }
]

function PortalLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth()

    return (
        <AlumniGate>
            <UnassignedGate>
                <div className="protected-layout-shell">
                    <SideBarNavigationSlim
                        items={NAV_ITEMS}
                        footerItems={FOOTER_ITEMS}
                        user={user}
                        onLogout={logout}
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
