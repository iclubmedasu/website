"use client";

import { Badge } from "@/components/ui";
import { EventShareMenu } from "./EventShareMenu";

interface EventDetailHeaderProps {
    eventId: number;
    eventTitle: string;
    projectTypeName?: string | null;
    description?: string | null;
}

export function EventDetailHeader({
    eventId,
    eventTitle,
    projectTypeName,
    description,
}: EventDetailHeaderProps) {
    return (
        <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-700">Event</p>
            <div className="event-detail-title-row">
                <h1 className="event-detail-title">{eventTitle}</h1>
                <div className="event-card-header-type">
                    {projectTypeName ? <Badge variant="purple">{projectTypeName}</Badge> : null}
                </div>
                <EventShareMenu eventId={eventId} eventTitle={eventTitle} />
            </div>
            {description ? (
                <p className="text-lg leading-8 text-slate-600">{description}</p>
            ) : null}
        </div>
    );
}
