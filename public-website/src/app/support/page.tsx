import type { Metadata } from "next";
import { IncidentReportForm } from "@/components/support/IncidentReportForm";
import { SupportNotices } from "@/components/support/SupportNotices";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { fallbackSupportPage, normalizeSupportPage } from "@/lib/siteContentFallback";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
    const page = normalizeSupportPage(await publicAPI.getSupportPage());
    const header = page.header;

    return {
        title: "Support",
        description: header.description || `Get help and submit an incident report with ${siteConfig.name}.`,
    };
}

export default async function SupportPage() {
    const data = normalizeSupportPage(await publicAPI.getSupportPage());

    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow={data.header.eyebrow}
                    title={data.header.title}
                    description={data.header.description}
                />
            </Section>
            <Section variant="plain">
                <div className="mx-auto max-w-3xl space-y-8">
                    <SupportNotices notices={data.notices} />
                    <IncidentReportForm forms={data.forms} />
                </div>
            </Section>
        </>
    );
}
