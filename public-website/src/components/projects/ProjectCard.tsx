import type { PublicProjectSummary } from "@iclub/shared";
import { CalendarDays, Tag } from "lucide-react";
import Link from "next/link";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import { Badge } from "@/components/ui";
import { ProjectShareMenu } from "./ProjectShareMenu";
import { publicProjectPath } from "@/lib/publicSlug";

interface ProjectCardProps {
    project: PublicProjectSummary;
}

function ProjectCardContent({ project }: ProjectCardProps) {
    return (
        <>
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
    const href = publicProjectPath(project.slug);

    return (
        <article className="project-card">
            <div className="event-card-header">
                <Link href={href} className="event-card-title-link">
                    <h3 className="project-card-title">{project.title}</h3>
                </Link>
                <div className="event-card-header-type">
                    {project.projectType?.name ? (
                        <Badge variant="purple" className="shrink-0">
                            {project.projectType.name}
                        </Badge>
                    ) : null}
                </div>
                <ProjectShareMenu projectSlug={project.slug} projectTitle={project.title} />
            </div>
            <Link href={href} className="event-card-body">
                <ProjectCardContent project={project} />
            </Link>
        </article>
    );
}
