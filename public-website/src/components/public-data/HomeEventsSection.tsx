"use client";

import { useEffect, useState } from "react";
import type { PublicEventListItem } from "@iclub/shared";
import { PastEventsPreview } from "@/components/home/PastEventsPreview";
import { UpcomingEventsPreview } from "@/components/home/UpcomingEventsPreview";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

export function HomeEventsSection() {
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
        return <DataLoadingState />;
    }

    return (
        <>
            <UpcomingEventsPreview events={published} />
            <PastEventsPreview events={past} />
        </>
    );
}
