import type { PublicEventListItem } from "@iclub/shared";
import { CardScrollItem, CardScrollList } from "@/components/ui/CardScrollList";
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
        <CardScrollList>
            {events.map((event) => (
                <CardScrollItem key={event.id}>
                    <EventCard event={event} variant={variant} />
                </CardScrollItem>
            ))}
        </CardScrollList>
    );}
