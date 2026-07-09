"use client";

import { useEffect, useState } from "react";
import type { PublicEventListItem } from "@iclub/shared";
import { EventsList } from "@/components/events/EventsList";
import { Section, SectionHeading } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

export function EventsPageContent() {
    const [published, setPublished] = useState<PublicEventListItem[] | null>(null);
    const [past, setPast] = useState<PublicEventListItem[] | null>(null);

    useEffect(() => {
        void Promise.all([publicAPI.getPublishedEvents(), publicAPI.getPastEvents()])
            .then(([upcoming, pastEvents]) => {
                setPublished(upcoming);
                setPast(pastEvents);
            })
            .catch(() => {
                setPublished([]);
                setPast([]);
            });
    }, []);

    if (published === null || past === null) {
        return (
            <Section variant="plain">
                <DataLoadingState />
            </Section>
        );
    }

    return (
        <>
            <Section variant="plain">
                <EventsList
                    events={published}
                    emptyTitle="No published events"
                    emptyDescription="New events will appear here once they are published."
                />
            </Section>

            <Section variant="subtle">
                <SectionHeading
                    title="Past Events"
                    description="Events the club has already run and disclosed publicly — scroll sideways to see more."
                />
                <EventsList
                    events={past}
                    variant="past"
                    emptyTitle="No past events yet"
                    emptyDescription="Past events the club has run will appear here once disclosed."
                />
            </Section>
        </>
    );
}
