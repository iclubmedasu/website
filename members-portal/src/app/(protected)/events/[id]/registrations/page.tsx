import { redirect } from 'next/navigation';

type EventRegistrationsPageProps = {
    params: Promise<{ id: string }>;
};

export default async function EventRegistrationsRoute({ params }: EventRegistrationsPageProps) {
    const { id } = await params;
    redirect(`/events?event=${id}&tab=registrations`);
}
