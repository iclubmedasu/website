import type { Metadata } from "next";
import { AboutPageContent } from "@/components/public-data/AboutPageContent";
import { BackLink } from "@/components/navigation/BackLink";
import { Section } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "About",
    description: `Learn about ${siteConfig.name}, our mission, and what we do.`,
};

export default function AboutPage() {
    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <AboutPageContent />
            </Section>
        </>
    );
}
