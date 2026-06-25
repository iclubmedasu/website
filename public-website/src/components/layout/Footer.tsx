import { Mail } from "lucide-react";
import { BrandLogos } from "@/components/layout/BrandLogos";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { publicAPI } from "@/lib/api";
import { fallbackContactPage } from "@/lib/siteContentFallback";
import { siteConfig } from "@/lib/site";

export async function Footer() {
    const contactPage = await publicAPI.getContactPage();
    const contact = contactPage ?? fallbackContactPage;
    const emailMethod = contact.methods.find((method) => method.type === "EMAIL") ?? contact.methods[0];
    const contactEmail = emailMethod?.value ?? siteConfig.contactEmail;

    return (
        <footer className="site-footer">
            <div className="site-footer-inner px-4 sm:px-6 lg:px-8">
                <div className="site-footer-contact-block">
                    <p className="site-footer-heading">Contact</p>
                    <p className="site-footer-tagline">{siteConfig.tagline}</p>
                    <div className="site-footer-contact">
                        <a href={`mailto:${contactEmail}`} className="site-footer-link inline-flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0" />
                            {contactEmail}
                        </a>
                        <SocialLinks links={contact.socialLinks} />
                    </div>
                </div>
            </div>

            <div className="site-footer-bottom px-4 sm:px-6 lg:px-8">
                <BrandLogos variant="footer" />
                <p className="site-footer-copyright">
                    © {new Date().getFullYear()} {siteConfig.copyrightName}. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
