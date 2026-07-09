import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/BackLink";
import { EventsPageContent } from "@/components/public-data/EventsPageContent";
import { PageHeader, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Events",
    description: `Published events from ${siteConfig.name}.`,
};

export default function EventsPage() {
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
            <EventsPageContent />
        </>
    );
}
