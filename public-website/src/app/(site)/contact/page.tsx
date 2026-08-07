import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactPageContent } from "@/components/public-data/ContactPageContent";
import { BackLink } from "@/components/navigation/BackLink";
import { Section } from "@/components/ui";
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
                <ContactPageContent />
            </Section>
            <Section variant="plain">
                <ContactForm />
            </Section>
        </>
    );
}
