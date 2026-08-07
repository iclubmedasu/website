import type { Metadata } from "next";
import { SupportPageContent } from "@/components/public-data/SupportPageContent";
import { BackLink } from "@/components/navigation/BackLink";
import { Section } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Support",
    description: `Get help and submit an incident report with ${siteConfig.name}.`,
};

export default function SupportPage() {
    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
            </Section>
            <Section variant="plain">
                <SupportPageContent />
            </Section>
        </>
    );
}
