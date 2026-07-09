import type { PublicEventListItem } from "@iclub/shared";
import { EventsList } from "@/components/events/EventsList";
import { Section, SectionHeading } from "@/components/ui";

interface UpcomingEventsPreviewProps {
    events: PublicEventListItem[];
}
export function UpcomingEventsPreview({ events }: UpcomingEventsPreviewProps) {
    return (
        <Section variant="subtle">
            <SectionHeading
                title="Events"
                description="Browse our published workshops, community events, and student-led activities — scroll sideways to see more."
                action={{ label: "View all events", href: "/events" }}
            />
            <EventsList events={events} />
        </Section>
    );
}
