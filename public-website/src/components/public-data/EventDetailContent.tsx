"use client";

import { CalendarDays, MapPin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicEventDetail, PublicEventPhoto } from "@iclub/shared";
import { EventCircularGallery } from "@/components/events/circular-gallery/EventCircularGallery";
import { EventDetailActions } from "@/components/events/EventDetailActions";
import { EventDetailHeader } from "@/components/events/EventDetailHeader";
import { BackLink } from "@/components/navigation/BackLink";
import { ClientEventDateRangeDual, ClientRegistrationDeadline } from "@/components/datetime/ClientDateTime";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { formatCapacityLabel } from "@/lib/customFieldUtils";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function EventDetailContent({ idOrSlug }: { idOrSlug: string }) {
    const [state, setState] = useState<LoadState>("loading");
    const [event, setEvent] = useState<PublicEventDetail | null>(null);
    const [photos, setPhotos] = useState<PublicEventPhoto[]>([]);

    useEffect(() => {
        let cancelled = false;

        void Promise.all([publicAPI.getEvent(idOrSlug), publicAPI.getEventPhotos(idOrSlug)])
            .then(([eventData, photoData]) => {
                if (cancelled) return;
                if (!eventData) {
                    setState("not_found");
                    return;
                }
                setEvent(eventData);
                setPhotos(photoData);
                setState("ready");
            })
            .catch(() => {
                if (!cancelled) setState("not_found");
            });

        return () => {
            cancelled = true;
        };
    }, [idOrSlug]);

    if (state === "loading") {
        return (
            <PageContainer className="space-y-10 py-10 sm:py-14">
                <BackLink href="/events" label="Back to Events" />
                <DataLoadingState />
            </PageContainer>
        );
    }

    if (state === "not_found" || !event) {
        return (
            <PageContainer className="space-y-10 py-10 sm:py-14">
                <BackLink href="/events" label="Back to Events" />
                <div className="empty-state max-w-lg">
                    <h1 className="empty-state-title">Event not found</h1>
                    <p className="empty-state-text">This event may have been removed or is not published.</p>
                </div>
            </PageContainer>
        );
    }

    const capacityLabel = formatCapacityLabel(event.spotsRemaining, event.capacity);
    const isPastEvent = Date.parse(event.eventEndDate) <= Date.now();
    const hasPhotos = photos.length > 0;
    const backLink = <BackLink href="/events" label="Back to Events" />;

    const eventDetails = (
        <div className="event-detail-main space-y-4">
            {hasPhotos ? backLink : null}
            <EventDetailHeader
                eventSlug={event.slug}
                eventTitle={event.title}
                projectTypeName={event.projectType?.name}
                description={event.description}
            />
            <div className="flex flex-col gap-3 text-sm text-slate-600">
                <p className="inline-flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                    <ClientEventDateRangeDual
                        eventDate={event.eventDate}
                        eventEndDate={event.eventEndDate}
                        timezone={event.timezone}
                    />
                </p>
                {event.venue ? (
                    <p className="inline-flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                        {event.venue}
                    </p>
                ) : null}
                {!isPastEvent ? (
                    <p className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-purple-700" />
                        {capacityLabel}
                    </p>
                ) : null}
                {!isPastEvent && event.registrationOpen ? (
                    <ClientRegistrationDeadline value={event.registrationDeadline} />
                ) : null}
            </div>
            <div className="pt-2">
                <EventDetailActions
                    eventId={event.id}
                    eventSlug={event.slug}
                    registrationOpen={event.registrationOpen}
                    isPastEvent={isPastEvent}
                />
            </div>
        </div>
    );

    return (
        <PageContainer className={hasPhotos ? "pt-0 pb-0" : "space-y-10 py-10 sm:py-14"}>
            {hasPhotos ? (
                <div className="event-detail-band">
                    <section className="event-detail-layout event-detail-layout--with-gallery">
                        {eventDetails}
                        <div className="event-detail-gallery">
                            <EventCircularGallery photos={photos} />
                        </div>
                    </section>
                </div>
            ) : (
                <>
                    {backLink}
                    <section className="event-detail-layout max-w-3xl">{eventDetails}</section>
                </>
            )}
        </PageContainer>
    );
}
