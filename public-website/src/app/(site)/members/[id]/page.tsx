import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberProfileContent } from "@/components/public-data/MemberProfileContent";
import { publicAPI } from "@/lib/api";

interface MemberProfilePageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Member",
};

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
    const { id } = await params;
    const memberId = Number(id);
    if (Number.isNaN(memberId)) {
        notFound();
    }

    const certificates = await publicAPI.getMemberCertificates(memberId);

    return <MemberProfileContent memberId={memberId} certificates={certificates} />;
}
