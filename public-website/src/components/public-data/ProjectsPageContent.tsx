"use client";

import { useEffect, useState } from "react";
import type { PublicProjectSummary } from "@iclub/shared";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { Section } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

export function ProjectsPageContent() {
    const [projects, setProjects] = useState<PublicProjectSummary[] | null>(null);

    useEffect(() => {
        void publicAPI
            .getPublishedProjects()
            .then(setProjects)
            .catch(() => setProjects([]));
    }, []);

    if (projects === null) {
        return (
            <Section variant="plain">
                <DataLoadingState />
            </Section>
        );
    }

    return (
        <Section variant="plain">
            <ProjectsList
                projects={projects}
                emptyTitle="No featured projects yet"
                emptyDescription="Archived projects disclosed by the club will appear here."
            />
        </Section>
    );
}
