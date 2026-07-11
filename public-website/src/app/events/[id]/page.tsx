import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailContent } from "@/components/public-data/EventDetailContent";
import { publicAPI } from "@/lib/api";
import { redirectNumericParamToSlug } from "@/lib/publicSlug";

interface EventDetailPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Event",
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
    const { id } = await params;
    const event = await publicAPI.getEvent(id);
    if (!event) {
        notFound();
    }

    redirectNumericParamToSlug({
        param: id,
        slug: event.slug,
        basePath: "events",
    });

    return <EventDetailContent idOrSlug={event.slug} />;
}
