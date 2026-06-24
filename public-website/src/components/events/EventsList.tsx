import type { PublicEventListItem } from "@iclub/shared";
import { EventCard } from "./EventCard";

interface EventsListProps {
    events: PublicEventListItem[];
    variant?: "default" | "past";
    emptyTitle?: string;
    emptyDescription?: string;
}

export function EventsList({
    events,
    variant = "default",
    emptyTitle = "No upcoming events",
    emptyDescription = "Check back soon for new iClub events and activities.",
}: EventsListProps) {
    if (events.length === 0) {
        return (
            <div className="empty-state">
                <h3 className="empty-state-title">{emptyTitle}</h3>
                <p className="empty-state-text">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
                <EventCard key={event.id} event={event} variant={variant} />
            ))}
        </div>
    );
}
