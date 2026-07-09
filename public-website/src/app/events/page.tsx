import type { Metadata } from "next";
import { EventsList } from "@/components/events/EventsList";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section, SectionHeading } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Events",
    description: `Published events from ${siteConfig.name}.`,
};

export default async function EventsPage() {
    const [events, pastEvents] = await Promise.all([
        publicAPI.getPublishedEvents(),
        publicAPI.getPastEvents(),
    ]);

    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="Events"
                    title="Published events"
                    description={`Browse all published ${siteConfig.shortName} events — scroll sideways to see more.`}
                />
            </Section>
            <Section variant="plain">
                <EventsList
                    events={events}
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
                    events={pastEvents}
                    variant="past"
                    emptyTitle="No past events yet"
                    emptyDescription="Past events the club has run will appear here once disclosed."
                />
            </Section>
        </>
    );
}
