import type { Metadata } from 'next'
import { DeveloperGuard } from '@/components/AuthGuard/DeveloperGuard'
import DevUsageDashboardPage from '@/features/DevUsage/DevUsageDashboardPage'

export const metadata: Metadata = {
    title: 'Usage analytics | iClub Members Portal',
    description: 'Developer-only product usage analytics.',
}

export default function DevUsageRoute() {
    return (
        <DeveloperGuard>
            <DevUsageDashboardPage />
        </DeveloperGuard>
    )
}
