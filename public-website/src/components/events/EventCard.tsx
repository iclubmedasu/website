import type { PublicEventListItem } from "@iclub/shared";
import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { ClientEventDateRange, ClientRegistrationDeadline } from "@/components/datetime/ClientDateTime";
import { Badge } from "@/components/ui";
import { EventShareMenu } from "@/components/events/EventShareMenu";
import { formatCapacityLabel } from "@/lib/customFieldUtils";
import { publicEventPath } from "@/lib/publicSlug";

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
                    <ClientEventDateRange
                        eventDate={event.eventDate}
                        eventEndDate={event.eventEndDate}
                    />
                </p>
                {event.venue ? (
                    <p className="event-card-meta-item">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                        {event.venue}
                    </p>
                ) : null}
                {!isPast && event.registrationDeadline ? (
                    <p className="event-card-meta-item">
                        <span className="font-medium text-purple-800">Register by:</span>{" "}
                        <ClientRegistrationDeadline
                            value={event.registrationDeadline}
                            prefix=""
                            inline
                        />
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
}: {
    event: PublicEventListItem;
    variant: "default" | "past";
}) {
    const isPast = variant === "past";
    const eventHref = publicEventPath(event.slug);

    return (
        <div className="event-card-header">
            <Link href={eventHref} className="event-card-title-link">
                <h3 className="event-card-title">{event.title}</h3>
            </Link>
            <div className="event-card-header-type">
                {event.projectType?.name ? (
                    <Badge variant="purple" className="shrink-0">
                        {event.projectType.name}
                    </Badge>
                ) : null}
                {isPast ? <Badge variant="neutral">Completed</Badge> : null}
            </div>
            <EventShareMenu eventSlug={event.slug} eventTitle={event.title} />
        </div>
    );
}

export function EventCard({ event, variant = "default" }: EventCardProps) {
    const eventHref = publicEventPath(event.slug);
    const cardClass = variant === "past" ? "event-card event-card--past" : "event-card";

    return (
        <article className={cardClass}>
            <EventCardHeader event={event} variant={variant} />
            <Link href={eventHref} className="event-card-body">
                <EventCardBody event={event} variant={variant} />
            </Link>
        </article>
    );
}
