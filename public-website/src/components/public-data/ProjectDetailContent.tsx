"use client";

import { CalendarDays, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicProjectDetail } from "@iclub/shared";
import { BackLink } from "@/components/navigation/BackLink";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import { Badge, PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function ProjectDetailContent({ projectId }: { projectId: number }) {
    const [state, setState] = useState<LoadState>("loading");
    const [project, setProject] = useState<PublicProjectDetail | null>(null);

    useEffect(() => {
        void publicAPI
            .getProject(projectId)
            .then((data) => {
                if (!data) {
                    setState("not_found");
                    return;
                }
                setProject(data);
                setState("ready");
            })
            .catch(() => setState("not_found"));
    }, [projectId]);

    if (state === "loading") {
        return (
            <PageContainer className="space-y-8 py-10 sm:py-14">
                <BackLink href="/projects" label="Back to Projects" />
                <DataLoadingState />
            </PageContainer>
        );
    }

    if (state === "not_found" || !project) {
        return (
            <PageContainer className="space-y-8 py-10 sm:py-14">
                <BackLink href="/projects" label="Back to Projects" />
                <div className="empty-state max-w-lg">
                    <h1 className="empty-state-title">Project not found</h1>
                    <p className="empty-state-text">This project may have been removed or is not published.</p>
                </div>
            </PageContainer>
        );
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
