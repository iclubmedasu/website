import type { PublicProjectSummary } from "@iclub/shared";
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
            ))}
        </div>
    );
}
