import type { Metadata } from 'next';
import PastEventsPage from '@/features/Events/PastEventsPage';

export const metadata: Metadata = {
    title: 'Past Events | iClub Members Portal',
    description: 'Browse archived events.',
};

export default function PastEventsRoute() {
    return <PastEventsPage />;
}
