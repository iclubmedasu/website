"use client";

import { useEffect, useState } from "react";
import type { PublicProjectSummary } from "@iclub/shared";
import { RecentProjectsPreview } from "@/components/home/RecentProjectsPreview";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

export function HomeProjectsSection() {
    const [projects, setProjects] = useState<PublicProjectSummary[] | null>(null);

    useEffect(() => {
        void publicAPI
            .getPublishedProjects()
            .then(setProjects)
            .catch(() => setProjects([]));
    }, []);

    if (projects === null) {
        return <DataLoadingState />;
    }

    return <RecentProjectsPreview projects={projects} />;
}
