import type { Metadata } from "next";
import { EventsList } from "@/components/events/EventsList";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section, SectionHeading } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Events",
    description: `Events open for registration at ${siteConfig.name}.`,
};

export default async function EventsPage() {
    const [events, pastEvents] = await Promise.all([
        publicAPI.getRegisterableEvents({ limit: 50 }),
        publicAPI.getPastEvents({ limit: 50 }),
    ]);

    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="Events"
                    title="Events open for registration"
                    description={`Browse published ${siteConfig.shortName} events with registration still open.`}
                />
            </Section>
            <Section variant="plain">
                <EventsList
                    events={events}
                    emptyTitle="No events open for registration"
                    emptyDescription="New events will appear here when registration opens."
                />
            </Section>
            <Section variant="subtle">
                <SectionHeading
                    title="Past Events"
                    description="Events the club has already run and disclosed publicly."
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
