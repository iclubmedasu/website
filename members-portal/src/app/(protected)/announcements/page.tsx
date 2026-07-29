import type { Metadata } from 'next'

import AnnouncementManagerGate from '@/components/AnnouncementManagerGate/AnnouncementManagerGate'
import AnnouncementsManagementPage from '@/features/Announcements/AnnouncementsManagementPage'

export const metadata: Metadata = {
    title: 'Announcements | iClub Members Portal',
    description: 'Create and manage club announcements.',
}

export default function AnnouncementsRoutePage() {
    return (
        <AnnouncementManagerGate>
            <AnnouncementsManagementPage />
        </AnnouncementManagerGate>
    )
}
