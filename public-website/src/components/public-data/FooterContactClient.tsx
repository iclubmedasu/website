"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicSocialLink } from "@iclub/shared";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { publicAPI } from "@/lib/api";
import { fallbackContactPage } from "@/lib/siteContentFallback";

export function FooterContactClient({
    fallbackEmail,
    fallbackLinks,
}: {
    fallbackEmail: string;
    fallbackLinks: PublicSocialLink[];
}) {
    const [email, setEmail] = useState(fallbackEmail);
    const [links, setLinks] = useState(fallbackLinks);

    useEffect(() => {
        void publicAPI.getContactPage().then((page) => {
            if (!page) return;
            const emailMethod = page.methods.find((method) => method.type === "EMAIL") ?? page.methods[0];
            if (emailMethod?.value) {
                setEmail(emailMethod.value);
            }
            if (page.socialLinks.length > 0) {
                setLinks(page.socialLinks);
            }
        });
    }, []);

    return (
        <div className="site-footer-contact">
            <a href={`mailto:${email}`} className="site-footer-link inline-flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                {email}
            </a>
            <SocialLinks links={links.length > 0 ? links : fallbackContactPage.socialLinks} />
        </div>
    );
}
