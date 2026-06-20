import { redirect } from 'next/navigation';

type EventDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
    const { id } = await params;
    redirect(`/events?event=${id}`);
}
