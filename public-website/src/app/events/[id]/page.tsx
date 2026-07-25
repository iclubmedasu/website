import type { Metadata } from "next";
import { EventDetailContent } from "@/components/public-data/EventDetailContent";
import { publicAPI } from "@/lib/api";
import { isNumericPublicParam, redirectNumericParamToSlug } from "@/lib/publicSlug";

interface EventDetailPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Event",
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
    const { id } = await params;

    if (!isNumericPublicParam(id)) {
        return <EventDetailContent idOrSlug={id} />;
    }

    const event = await publicAPI.getEvent(id);
    if (event) {
        redirectNumericParamToSlug({
            param: id,
            slug: event.slug,
            basePath: "events",
        });
        return <EventDetailContent idOrSlug={event.slug} />;
    }

    // SSR miss (real 404 or HF 503): client component resolves
    return <EventDetailContent idOrSlug={id} />;
}
