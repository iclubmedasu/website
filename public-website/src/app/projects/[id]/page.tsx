import type { Metadata } from "next";
import { ProjectDetailContent } from "@/components/public-data/ProjectDetailContent";
import { publicAPI } from "@/lib/api";
import { isNumericPublicParam, redirectNumericParamToSlug } from "@/lib/publicSlug";

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Project",
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
    const { id } = await params;

    if (!isNumericPublicParam(id)) {
        return <ProjectDetailContent idOrSlug={id} />;
    }

    const project = await publicAPI.getProject(id);
    if (project) {
        redirectNumericParamToSlug({
            param: id,
            slug: project.slug,
            basePath: "projects",
        });
        return <ProjectDetailContent idOrSlug={project.slug} />;
    }

    // SSR miss (real 404 or HF 503): client component resolves
    return <ProjectDetailContent idOrSlug={id} />;
}
