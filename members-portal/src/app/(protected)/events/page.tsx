import type { Metadata } from 'next';
import EventsPage from '@/features/Events/EventsPage';

export const metadata: Metadata = {
    title: 'Events | iClub Members Portal',
    description: 'Create and manage club events.',
};

export default function EventsRoute() {
    return <EventsPage />;
}
