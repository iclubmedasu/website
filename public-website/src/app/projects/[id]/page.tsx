import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailContent } from "@/components/public-data/ProjectDetailContent";

interface ProjectDetailPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Project",
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
        notFound();
    }

    return <ProjectDetailContent projectId={projectId} />;
}
