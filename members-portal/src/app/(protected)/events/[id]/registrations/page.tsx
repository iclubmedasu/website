import type { Metadata } from 'next';
import EventRegistrationsPanel from '@/features/Events/EventRegistrationsPage';

type EventRegistrationsPageProps = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EventRegistrationsPageProps): Promise<Metadata> {
    const { id } = await params;
    return {
        title: `Event ${id} Registrations | iClub Members Portal`,
        description: 'View event registrations.',
    };
}

export default async function EventRegistrationsRoute({ params }: EventRegistrationsPageProps) {
    const { id } = await params;

    return <EventRegistrationsPanel eventId={id} />;
}
