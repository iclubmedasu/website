import { BrandLogos } from "@/components/layout/BrandLogos";
import { FooterContactClient } from "@/components/public-data/FooterContactClient";
import { fallbackContactPage } from "@/lib/siteContentFallback";
import { siteConfig } from "@/lib/site";

export function Footer() {
    const contact = fallbackContactPage;
    const emailMethod = contact.methods.find((method) => method.type === "EMAIL") ?? contact.methods[0];
    const contactEmail = emailMethod?.value ?? siteConfig.contactEmail;

    return (
        <footer className="site-footer">
            <div className="site-footer-inner px-4 sm:px-6 lg:px-8">
                <div className="site-footer-contact-block">
                    <p className="site-footer-heading">Contact</p>
                    <p className="site-footer-tagline">{siteConfig.tagline}</p>
                    <FooterContactClient
                        fallbackEmail={contactEmail}
                        fallbackLinks={contact.socialLinks}
                    />
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
