import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactMethods } from "@/components/contact/ContactMethods";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section } from "@/components/ui";
import { publicAPI } from "@/lib/api";
import { fallbackContactPage } from "@/lib/siteContentFallback";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
    const page = await publicAPI.getContactPage();
    const header = page?.header ?? fallbackContactPage.header;

    return {
        title: "Contact",
        description: header.description || `Get in touch with ${siteConfig.name}.`,
    };
}

export default async function ContactPage() {
    const data = (await publicAPI.getContactPage()) ?? fallbackContactPage;

    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow={data.header.eyebrow}
                    title={data.header.title}
                    description={data.header.description}
                >
                  {/*  <ContactMethods methods={data.methods} />
                     <div className="mt-6">
                        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-700">
                            Community & social
                        </p>
                        <SocialLinks links={data.socialLinks} />
                    </div> */}
                </PageHeader>
            </Section>
            <Section variant="plain">
                <ContactForm />
            </Section>
        </>
    );
}
