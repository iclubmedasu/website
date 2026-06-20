import type { Metadata } from 'next';
import { Suspense } from 'react';
import EventsPage from '@/features/Events/EventsPage';

export const metadata: Metadata = {
    title: 'Events | iClub Members Portal',
    description: 'Create and manage club events.',
};

export default function EventsRoute() {
    return (
        <Suspense fallback={<main className="events-page"><div className="empty-message">Loading events…</div></main>}>
            <EventsPage />
        </Suspense>
    );
}
