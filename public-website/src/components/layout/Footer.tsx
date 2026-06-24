import { Mail } from "lucide-react";
import { BrandLogos } from "@/components/layout/BrandLogos";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { siteConfig } from "@/lib/site";

export function Footer() {
    return (
        <footer className="site-footer">
            <div className="site-footer-inner px-4 sm:px-6 lg:px-8">
                <div className="site-footer-contact-block">
                    <p className="site-footer-heading">Contact</p>
                    <p className="site-footer-tagline">{siteConfig.tagline}</p>
                    <div className="site-footer-contact">
                        <a href={`mailto:${siteConfig.contactEmail}`} className="site-footer-link inline-flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0" />
                            {siteConfig.contactEmail}
                        </a>
                        <SocialLinks />
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
