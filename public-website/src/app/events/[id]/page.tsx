import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailContent } from "@/components/public-data/EventDetailContent";

interface EventDetailPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Event",
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
    const { id } = await params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) {
        notFound();
    }

    return <EventDetailContent eventId={eventId} />;
}
