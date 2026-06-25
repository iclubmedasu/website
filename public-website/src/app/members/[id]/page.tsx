import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/navigation/BackLink";
import { MemberProfileView } from "@/components/members/MemberProfileView";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";

interface MemberProfilePageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MemberProfilePageProps): Promise<Metadata> {
    const { id } = await params;
    const profile = await publicAPI.getMemberProfile(Number(id));
    return {
        title: profile?.fullName ?? "Member",
        description: profile ? `Profile of ${profile.fullName}` : undefined,
    };
}

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
    const { id } = await params;
    const memberId = Number(id);
    if (Number.isNaN(memberId)) {
        notFound();
    }

    const profile = await publicAPI.getMemberProfile(memberId);
    if (!profile) {
        notFound();
    }

    return (
        <PageContainer className="space-y-8 py-10 sm:py-14">
            <BackLink href="/members" label="Back to Members" />
            <MemberProfileView profile={profile} />
        </PageContainer>
    );
}
