import type { Metadata } from 'next';
import EventDetailHub from '@/features/Events/EventDetailHub';

type EventDetailPageProps = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    return {
        title: `Event ${id} | iClub Members Portal`,
        description: 'Manage an individual club event.',
    };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
    const { id } = await params;

    return <EventDetailHub eventId={id} />;
}
