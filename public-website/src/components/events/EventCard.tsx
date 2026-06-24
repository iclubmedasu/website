import type { PublicEventListItem } from "@iclub/shared";
import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import {
    formatCapacityLabel,
    formatEventDateRange,
    formatRegistrationDeadline,
} from "@/lib/customFieldUtils";

interface EventCardProps {
    event: PublicEventListItem;
    variant?: "default" | "past";
}

function EventCardContent({
    event,
    variant,
}: {
    event: PublicEventListItem;
    variant: "default" | "past";
}) {
    const deadlineLabel = formatRegistrationDeadline(event.registrationDeadline);
    const capacityLabel = formatCapacityLabel(event.spotsRemaining, event.capacity);
    const isPast = variant === "past";

    return (
        <>
            <div className="flex items-start justify-between gap-3">
                <h3 className="event-card-title">{event.title}</h3>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {event.projectType?.name ? (
                        <Badge variant="purple" className="shrink-0">
                            {event.projectType.name}
                        </Badge>
                    ) : null}
                    {isPast ? <Badge variant="neutral">Completed</Badge> : null}
                </div>
            </div>
            {event.description ? (
                <p className="event-card-description line-clamp-3">{event.description}</p>
            ) : (
                <div className="flex-1" />
            )}
            <div className="event-card-meta">
                <p className="event-card-meta-item">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                    {formatEventDateRange(event.eventDate, event.eventEndDate)}
                </p>
                {event.venue ? (
                    <p className="event-card-meta-item">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                        {event.venue}
                    </p>
                ) : null}
                {!isPast && deadlineLabel ? (
                    <p className="event-card-meta-item">
                        <span className="font-medium text-purple-800">Register by:</span> {deadlineLabel}
                    </p>
                ) : null}
            </div>
            {!isPast ? (
                <div className="event-card-capacity">
                    <Users className="h-4 w-4" />
                    {capacityLabel}
                </div>
            ) : null}
        </>
    );
}

export function EventCard({ event, variant = "default" }: EventCardProps) {
    if (variant === "past") {
        return (
            <article className="event-card event-card--past">
                <EventCardContent event={event} variant="past" />
            </article>
        );
    }

    return (
        <Link href={`/events/${event.id}`} className="event-card">
            <EventCardContent event={event} variant="default" />
        </Link>
    );
}
