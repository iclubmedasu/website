import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/BackLink";
import { LeadershipPyramid } from "@/components/members/LeadershipPyramid";
import { MembersGrid } from "@/components/members/MembersGrid";
import { PageHeader, Section, SectionHeading } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Members",
    description: `Meet the leadership and members of ${siteConfig.name}.`,
};

export default async function MembersPage() {
    const directory = await publicAPI.getMembersDirectory();

    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="Members"
                    title="Our team"
                    description={`The people behind ${siteConfig.shortName} — from club leadership to every contributing member.`}
                />
            </Section>

            <Section variant="plain">
                <SectionHeading
                    title="Leadership"
                    description="Club officer, executive board, and team leads."
                />
                <LeadershipPyramid directory={directory} />
            </Section>

            <Section variant="subtle">
                <SectionHeading
                    title="All members"
                    description="Everyone actively contributing to the club."
                />
                <MembersGrid members={directory.members} />
            </Section>
        </>
    );
}
