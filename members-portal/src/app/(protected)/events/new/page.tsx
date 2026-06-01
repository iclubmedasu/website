import type { Metadata } from 'next';
import EventCreatePage from '@/features/Events/EventCreatePage';

export const metadata: Metadata = {
    title: 'Create Event | iClub Members Portal',
    description: 'Create a new club event.',
};

export default function NewEventPage() {
    return <EventCreatePage />;
}
