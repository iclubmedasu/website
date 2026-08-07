import type { Metadata } from "next";
import { BackLink } from "@/components/navigation/BackLink";
import { MembersPageContent } from "@/components/public-data/MembersPageContent";
import { PageHeader, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Members",
    description: `Meet the leadership and members of ${siteConfig.name}.`,
};

export default function MembersPage() {
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
            <MembersPageContent />
        </>
    );
}
