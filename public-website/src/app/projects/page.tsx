import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/BackLink";
import { ProjectsPageContent } from "@/components/public-data/ProjectsPageContent";
import { PageHeader, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Projects",
    description: `Explore completed and ongoing projects from ${siteConfig.name}.`,
};

export default function ProjectsPage() {
    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="Projects"
                    title="Student-led initiatives"
                    description={`Discover projects completed and led by ${siteConfig.shortName} members — scroll sideways to see more.`}
                />
            </Section>
            <ProjectsPageContent />
        </>
    );
}
