"use client";

import { CalendarDays, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicProjectDetail, PublicProjectPhoto } from "@iclub/shared";
import { BackLink } from "@/components/navigation/BackLink";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import { ProjectCircularGallery } from "@/components/projects/ProjectCircularGallery";
import { ProjectShareMenu } from "@/components/projects/ProjectShareMenu";
import { Badge, PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function ProjectDetailContent({ idOrSlug }: { idOrSlug: string }) {
    const [state, setState] = useState<LoadState>("loading");
    const [project, setProject] = useState<PublicProjectDetail | null>(null);
    const [photos, setPhotos] = useState<PublicProjectPhoto[]>([]);

    useEffect(() => {
        let cancelled = false;

        void Promise.all([publicAPI.getProject(idOrSlug), publicAPI.getProjectPhotos(idOrSlug)])
            .then(([projectData, photoData]) => {
                if (cancelled) return;
                if (!projectData) {
                    setState("not_found");
                    return;
                }
                setProject(projectData);
                setPhotos(photoData);
                setState("ready");
            })
            .catch(() => {
                if (!cancelled) setState("not_found");
            });

        return () => {
            cancelled = true;
        };
    }, [idOrSlug]);

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

    const hasPhotos = photos.length > 0;
    const backLink = <BackLink href="/projects" label="Back to Projects" />;

    const projectDetails = (
        <div className="event-detail-main space-y-4">
            {hasPhotos ? backLink : null}
            <div className="event-detail-title-row">
                <div className="event-card-header-top">
                    <div className="event-card-header-type">
                        {project.projectType?.name ? (
                            <Badge variant="purple">{project.projectType.name}</Badge>
                        ) : null}
                    </div>
                    <ProjectShareMenu projectSlug={project.slug} projectTitle={project.title} />
                </div>
                <div className="space-y-2 min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-700">Project</p>
                    <h1 className="text-4xl font-bold text-purple-900">{project.title}</h1>
                </div>
            </div>
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
        </div>
    );

    return (
        <PageContainer className={hasPhotos ? "pt-0 pb-0" : "space-y-8 py-10 sm:py-14"}>
            {hasPhotos ? (
                <div className="event-detail-band">
                    <section className="event-detail-layout event-detail-layout--with-gallery">
                        {projectDetails}
                        <div className="event-detail-gallery">
                            <ProjectCircularGallery photos={photos} />
                        </div>
                    </section>
                </div>
            ) : (
                <>
                    {backLink}
                    <section className="event-detail-layout max-w-3xl">{projectDetails}</section>
                </>
            )}
        </PageContainer>
    );
}
