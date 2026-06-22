import { redirect } from 'next/navigation';

type EventCheckInPageProps = {
    params: Promise<{ id: string }>;
};

export default async function EventCheckInRoute({ params }: EventCheckInPageProps) {
    const { id } = await params;
    redirect(`/events?event=${id}&tab=registrations`);
}
