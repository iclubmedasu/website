import type { Metadata } from 'next'
import HelpAndSupportPage from '@/features/HelpAndSupport/HelpAndSupportPage'

export const metadata: Metadata = {
    title: 'Help & Support | iClub Members Portal',
    description: 'Find support resources and guidance.',
}

export default function HelpRoute() {
    return <HelpAndSupportPage />
}
