import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Dashboard | iClub Members Portal',
    description: 'Overview of the members portal.',
}

export default function DashboardPage() {
    return (
        <section className="members-page">
            <h1>Dashboard</h1>
            <p>
                Legacy dashboard source was not found in the Vite app. This placeholder keeps the protected route in
                place until dashboard content is provided for migration.
            </p>
        </section>
    );
}
