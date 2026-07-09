import type { PublicProjectSummary } from "@iclub/shared";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { Section, SectionHeading } from "@/components/ui";

interface RecentProjectsPreviewProps {
    projects: PublicProjectSummary[];
}

export function RecentProjectsPreview({ projects }: RecentProjectsPreviewProps) {
    return (
        <Section variant="plain">
            <SectionHeading
                title="Projects"
                description="Explore completed initiatives led by iClub members — scroll sideways to see more."
                action={{ label: "View all projects", href: "/projects" }}
            />
            <ProjectsList projects={projects} />
        </Section>
    );
}
