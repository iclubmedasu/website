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
                title="Recent Projects"
                description="Explore completed initiatives led by iClub members."
                action={{ label: "View all projects", href: "/projects" }}
            />
            <ProjectsList projects={projects} />
        </Section>
    );
}
