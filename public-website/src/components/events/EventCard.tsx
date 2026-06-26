import type { PublicEventListItem } from "@iclub/shared";
import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { EventShareMenu } from "@/components/events/EventShareMenu";
import {
    formatCapacityLabel,
    formatEventDateRange,
    formatRegistrationDeadline,
} from "@/lib/customFieldUtils";

interface EventCardProps {
    event: PublicEventListItem;
    variant?: "default" | "past";
}

function EventCardBody({
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

function EventCardHeader({
    event,
    variant,
    showShare = false,
}: {
    event: PublicEventListItem;
    variant: "default" | "past";
    showShare?: boolean;
}) {
    const isPast = variant === "past";
    const eventHref = `/events/${event.id}`;

    return (
        <div className="event-card-header">
            {showShare ? (
                <Link href={eventHref} className="event-card-title-link">
                    <h3 className="event-card-title">{event.title}</h3>
                </Link>
            ) : (
                <h3 className="event-card-title">{event.title}</h3>
            )}
            <div className="event-card-header-type">
                {event.projectType?.name ? (
                    <Badge variant="purple" className="shrink-0">
                        {event.projectType.name}
                    </Badge>
                ) : null}
                {isPast ? <Badge variant="neutral">Completed</Badge> : null}
            </div>
            {showShare ? (
                <EventShareMenu eventId={event.id} eventTitle={event.title} />
            ) : (
                <span className="event-card-header-spacer" aria-hidden="true" />
            )}
        </div>
    );
}

export function EventCard({ event, variant = "default" }: EventCardProps) {
    const eventHref = `/events/${event.id}`;

    if (variant === "past") {
        return (
            <article className="event-card event-card--past">
                <EventCardHeader event={event} variant="past" />
                <EventCardBody event={event} variant="past" />
            </article>
        );
    }

    return (
        <article className="event-card">
            <EventCardHeader event={event} variant="default" showShare />
            <Link href={eventHref} className="event-card-body">
                <EventCardBody event={event} variant="default" />
            </Link>
        </article>
    );
}
