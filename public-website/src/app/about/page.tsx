import type { Metadata } from "next";
import { AboutSections } from "@/components/about/AboutSections";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { fallbackAboutPage } from "@/lib/siteContentFallback";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
    const page = await publicAPI.getAboutPage();
    const header = page?.header ?? fallbackAboutPage.header;

    return {
        title: "About",
        description: header.description || `Learn about ${siteConfig.name}, our mission, and what we do.`,
    };
}

export default async function AboutPage() {
    const data = (await publicAPI.getAboutPage()) ?? fallbackAboutPage;

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

            <AboutSections sections={data.sections} />
        </>
    );
}
