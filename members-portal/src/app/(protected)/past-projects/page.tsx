import type { Metadata } from 'next'
import PastProjectsPage from '@/features/Projects/PastProjectsPage'

export const metadata: Metadata = {
    title: 'Past Projects | iClub Members Portal',
    description: 'Browse archived and completed projects.',
}

export default function PastProjectsRoute() {
    return <PastProjectsPage />
}
