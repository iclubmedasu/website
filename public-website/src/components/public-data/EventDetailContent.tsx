"use client";

import { CalendarDays, MapPin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicEventDetail } from "@iclub/shared";
import { EventDetailActions } from "@/components/events/EventDetailActions";
import { EventDetailHeader } from "@/components/events/EventDetailHeader";
import { BackLink } from "@/components/navigation/BackLink";
import { ClientEventDateRange, ClientRegistrationDeadline } from "@/components/datetime/ClientDateTime";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { formatCapacityLabel } from "@/lib/customFieldUtils";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function EventDetailContent({ eventId }: { eventId: number }) {
    const [state, setState] = useState<LoadState>("loading");
    const [event, setEvent] = useState<PublicEventDetail | null>(null);

    useEffect(() => {
        void publicAPI
            .getEvent(eventId)
            .then((data) => {
                if (!data) {
                    setState("not_found");
                    return;
                }
                setEvent(data);
                setState("ready");
            })
            .catch(() => setState("not_found"));
    }, [eventId]);

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

    return (
        <PageContainer className="space-y-10 py-10 sm:py-14">
            <BackLink href="/events" label="Back to Events" />
            <section className="max-w-3xl space-y-4">
                <EventDetailHeader
                    eventId={event.id}
                    eventTitle={event.title}
                    projectTypeName={event.projectType?.name}
                    description={event.description}
                />
                <div className="flex flex-col gap-3 text-sm text-slate-600">
                    <p className="inline-flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                        <ClientEventDateRange
                            eventDate={event.eventDate}
                            eventEndDate={event.eventEndDate}
                        />
                    </p>
                    {event.venue ? (
                        <p className="inline-flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                            {event.venue}
                        </p>
                    ) : null}
                    <p className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-purple-700" />
                        {capacityLabel}
                    </p>
                    <ClientRegistrationDeadline value={event.registrationDeadline} />
                </div>
                <div className="pt-2">
                    <EventDetailActions eventId={event.id} registrationOpen={event.registrationOpen} />
                </div>
            </section>
        </PageContainer>
    );
}
