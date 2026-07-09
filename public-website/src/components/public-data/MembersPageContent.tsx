"use client";

import { useEffect, useState } from "react";
import type { PublicMemberDirectory } from "@iclub/shared";
import { LeadershipPyramid } from "@/components/members/LeadershipPyramid";
import { MembersBrowse } from "@/components/members/MembersBrowse";
import { Section, SectionHeading } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { DataLoadingState } from "./DataLoadingState";

const emptyDirectory: PublicMemberDirectory = {
    officer: null,
    president: null,
    vicePresident: null,
    teamLeadership: [],
    filterTeams: [],
    members: [],
};

export function MembersPageContent() {
    const [directory, setDirectory] = useState<PublicMemberDirectory | null>(null);

    useEffect(() => {
        void publicAPI
            .getMembersDirectory()
            .then(setDirectory)
            .catch(() => setDirectory(emptyDirectory));
    }, []);

    if (directory === null) {
        return (
            <Section variant="plain">
                <DataLoadingState />
            </Section>
        );
    }

    return (
        <>
            <Section variant="plain">
                <SectionHeading
                    title="Leadership"
                    description="Club officer, executive board, and team leads. Click a member to view their profile and role history."
                />
                <LeadershipPyramid directory={directory} />
            </Section>

            <Section variant="subtle">
                <SectionHeading
                    title="All members"
                    description="Browse by team or explore the full roster — ten members per page."
                />
                <MembersBrowse members={directory.members} filterTeams={directory.filterTeams} />
            </Section>
        </>
    );
}
