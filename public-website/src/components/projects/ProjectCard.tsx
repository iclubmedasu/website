import type { PublicProjectSummary } from "@iclub/shared";
import { CalendarDays, Tag } from "lucide-react";
import Link from "next/link";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import { Badge } from "@/components/ui";

interface ProjectCardProps {
    project: PublicProjectSummary;
}

function ProjectCardContent({ project }: ProjectCardProps) {
    return (
        <>
            <div className="flex items-start justify-between gap-3">
                <h3 className="project-card-title">{project.title}</h3>
                {project.projectType?.name ? (
                    <Badge variant="purple" className="shrink-0">
                        {project.projectType.name}
                    </Badge>
                ) : null}
            </div>
            {project.description ? (
                <p className="project-card-description">{project.description}</p>
            ) : (
                <div className="flex-1" />
            )}
            <div className="project-card-footer">
                {project.completedDate ? (
                    <span className="project-card-meta">
                        <CalendarDays className="h-4 w-4 shrink-0 text-purple-700" />
                        Completed <ClientFormattedDate value={project.completedDate} />
                    </span>
                ) : null}
                {project.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag.tagName} variant="neutral">
                        <Tag className="h-3 w-3" />
                        {tag.tagName}
                    </Badge>
                ))}
            </div>
        </>
    );
}

export function ProjectCard({ project }: ProjectCardProps) {
    return (
        <Link href={`/projects/${project.id}`} className="project-card">
            <ProjectCardContent project={project} />
        </Link>
    );
}
