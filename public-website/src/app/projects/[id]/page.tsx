import type { Metadata } from "next";
import { CalendarDays, Tag } from "lucide-react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/navigation/BackLink";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import { Badge, PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProjectDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const project = await publicAPI.getProject(Number(id));
    return {
        title: project?.title ?? "Project",
        description: project?.description ?? undefined,
    };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
        notFound();
    }

    const project = await publicAPI.getProject(projectId);
    if (!project) {
        notFound();
    }

    return (
        <PageContainer className="space-y-8 py-10 sm:py-14">
            <BackLink href="/projects" label="Back to Projects" />
            <section className="max-w-3xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-700">Project</p>
                    {project.projectType?.name ? (
                        <Badge variant="purple">{project.projectType.name}</Badge>
                    ) : null}
                </div>
                <h1 className="text-4xl font-bold text-purple-900">{project.title}</h1>
                {project.description ? (
                    <p className="text-lg leading-8 text-slate-600">{project.description}</p>
                ) : null}
                {project.completedDate ? (
                    <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 shrink-0 text-purple-700" />
                        Completed <ClientFormattedDate value={project.completedDate} />
                    </p>
                ) : null}
                {project.tags && project.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {project.tags.map((tag) => (
                            <Badge key={tag.tagName} variant="neutral">
                                <Tag className="h-3 w-3" />
                                {tag.tagName}
                            </Badge>
                        ))}
                    </div>
                ) : null}
            </section>
        </PageContainer>
    );
}
