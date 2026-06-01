import type { Metadata } from 'next';
import EventCheckInPanel from '@/features/Events/EventCheckInPage';

type EventCheckInPageProps = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EventCheckInPageProps): Promise<Metadata> {
    const { id } = await params;
    return {
        title: `Event ${id} Check-In | iClub Members Portal`,
        description: 'Mobile check-in for the event.',
    };
}

export default async function EventCheckInRoute({ params }: EventCheckInPageProps) {
    const { id } = await params;

    return <EventCheckInPanel eventId={id} tiers={[]} />;
}
