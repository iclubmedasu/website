import type { Metadata } from 'next'
import DashboardPage from '@/features/Dashboard/DashboardPage'

export const metadata: Metadata = {
    title: 'Dashboard | iClub Members Portal',
    description: 'Overview of the members portal.',
}

export default function DashboardRoute() {
    return <DashboardPage />
}
