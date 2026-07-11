import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailContent } from "@/components/public-data/ProjectDetailContent";
import { publicAPI } from "@/lib/api";
import { redirectNumericParamToSlug } from "@/lib/publicSlug";

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Project",
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
    const { id } = await params;
    const project = await publicAPI.getProject(id);
    if (!project) {
        notFound();
    }

    redirectNumericParamToSlug({
        param: id,
        slug: project.slug,
        basePath: "projects",
    });

    return <ProjectDetailContent idOrSlug={project.slug} />;
}
