import { Facebook, Globe, Instagram, Linkedin, MessageCircle } from "lucide-react";
import { siteConfig } from "@/lib/site";

interface SocialLinksProps {
    className?: string;
}

const socialItems = [
    { key: "instagram", href: siteConfig.social.instagram, label: "Instagram", Icon: Instagram },
    { key: "facebook", href: siteConfig.social.facebook, label: "Facebook", Icon: Facebook },
    { key: "whatsapp", href: siteConfig.social.whatsapp, label: "WhatsApp community", Icon: MessageCircle },
    { key: "linkedin", href: siteConfig.social.linkedin, label: "LinkedIn", Icon: Linkedin },
    { key: "ihub", href: siteConfig.social.ihub, label: "iHub website", Icon: Globe },
] as const;

export function SocialLinks({ className = "" }: SocialLinksProps) {
    return (
        <div className={`site-footer-social ${className}`}>
            {socialItems.map(({ key, href, label, Icon }) => (
                <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-footer-social-link"
                    aria-label={label}
                >
                    <Icon className="h-4 w-4" />
                </a>
            ))}
        </div>
    );
}
