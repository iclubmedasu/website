import type { PublicEventListItem } from "@iclub/shared";
import { EventsList } from "@/components/events/EventsList";
import { Section, SectionHeading } from "@/components/ui";

interface PastEventsPreviewProps {
    events: PublicEventListItem[];
}

export function PastEventsPreview({ events }: PastEventsPreviewProps) {
    return (
        <Section variant="plain">
            <SectionHeading
                title="Past Events"
                description="Events the club has already run and disclosed publicly."
                action={{ label: "View all events", href: "/events" }}
            />
            <EventsList events={events} variant="past" />
        </Section>
    );
}
