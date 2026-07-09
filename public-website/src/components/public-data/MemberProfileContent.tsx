"use client";

import { useEffect, useState } from "react";
import type { PublicMemberProfile } from "@iclub/shared";
import { BackLink } from "@/components/navigation/BackLink";
import { MemberProfileView } from "@/components/members/MemberProfileView";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

type LoadState = "loading" | "not_found" | "ready";

export function MemberProfileContent({ memberId }: { memberId: number }) {
    const [state, setState] = useState<LoadState>("loading");
    const [profile, setProfile] = useState<PublicMemberProfile | null>(null);

    useEffect(() => {
        void publicAPI
            .getMemberProfile(memberId)
            .then((data) => {
                if (!data) {
                    setState("not_found");
                    return;
                }
                setProfile(data);
                setState("ready");
            })
            .catch(() => setState("not_found"));
    }, [memberId]);

    if (state === "loading") {
        return (
            <PageContainer className="space-y-8 py-10 sm:py-14">
                <BackLink href="/members" label="Back to Members" />
                <DataLoadingState />
            </PageContainer>
        );
    }

    if (state === "not_found" || !profile) {
        return (
            <PageContainer className="space-y-8 py-10 sm:py-14">
                <BackLink href="/members" label="Back to Members" />
                <div className="empty-state max-w-lg">
                    <h1 className="empty-state-title">Member not found</h1>
                    <p className="empty-state-text">This profile may have been removed or is not public.</p>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="space-y-8 py-10 sm:py-14">
            <BackLink href="/members" label="Back to Members" />
            <MemberProfileView profile={profile} />
        </PageContainer>
    );
}
