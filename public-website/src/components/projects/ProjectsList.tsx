import type { PublicProjectSummary } from "@iclub/shared";
import { CardScrollItem, CardScrollList } from "@/components/ui/CardScrollList";
import { ProjectCard } from "./ProjectCard";
import { EmptyState } from "@/components/ui";

interface ProjectsListProps {
    projects: PublicProjectSummary[];
    emptyTitle?: string;
    emptyDescription?: string;
}

export function ProjectsList({
    projects,
    emptyTitle = "No featured projects yet",
    emptyDescription = "Completed club projects will appear here once they are finalized.",
}: ProjectsListProps) {
    if (projects.length === 0) {
        return <EmptyState title={emptyTitle} description={emptyDescription} />;
    }

    return (
        <CardScrollList>
            {projects.map((project) => (
                <CardScrollItem key={project.id}>
                    <ProjectCard project={project} />
                </CardScrollItem>
            ))}
        </CardScrollList>
    );
}
