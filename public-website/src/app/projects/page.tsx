import type { Metadata } from "next";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Projects",
    description: `Explore completed and ongoing projects from ${siteConfig.name}.`,
};

export default async function ProjectsPage() {
    const projects = await publicAPI.getProjects({ limit: 50 });

    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="Projects"
                    title="Student-led initiatives"
                    description={`Discover projects completed and led by ${siteConfig.shortName} members — from research to community impact.`}
                />
            </Section>
            <Section variant="plain">
                <ProjectsList
                    projects={projects}
                    emptyTitle="No featured projects yet"
                    emptyDescription="Archived projects disclosed by the club will appear here."
                />
            </Section>
        </>
    );
}
