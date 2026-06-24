import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { BackLink } from "@/components/navigation/BackLink";
import { PageHeader, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Contact",
    description: `Get in touch with ${siteConfig.name}.`,
};

export default function ContactPage() {
    return (
        <>
            <Section variant="subtle" tight>
                <BackLink href="/" label="Back to Home" />
                <PageHeader
                    eyebrow="Contact"
                    title="We would love to hear from you"
                    description={`Reach out with questions about events, partnerships, or getting involved with ${siteConfig.shortName}.`}
                >
                    <a
                        href={`mailto:${siteConfig.contactEmail}`}
                        className="mt-6 inline-flex items-center gap-2 text-base font-medium text-purple-800 hover:underline"
                    >
                        <Mail className="h-5 w-5" />
                        {siteConfig.contactEmail}
                    </a>
                    <div className="mt-6">
                        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-700">
                            Community & social
                        </p>
                        <SocialLinks />
                    </div>
                </PageHeader>
            </Section>
            <Section variant="plain">
                <ContactForm />
            </Section>
        </>
    );
}
