import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
    title: 'Home | iClub Members Portal',
    description: 'Members portal home route redirect.',
}

export default function RootPage() {
    redirect('/login')
}
