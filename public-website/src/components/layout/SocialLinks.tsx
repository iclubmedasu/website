import { Facebook, Globe, Instagram, Linkedin, MessageCircle } from "lucide-react";
import type { PublicSocialLink, SocialPlatform } from "@iclub/shared";
import { fallbackSocialLinks } from "@/lib/siteContentFallback";
import { siteConfig } from "@/lib/site";

interface SocialLinksProps {
    className?: string;
    links?: PublicSocialLink[];
}

const platformMeta: Record<
    SocialPlatform,
    { label: string; Icon: typeof Instagram }
> = {
    INSTAGRAM: { label: "Instagram", Icon: Instagram },
    FACEBOOK: { label: "Facebook", Icon: Facebook },
    WHATSAPP: { label: "WhatsApp community", Icon: MessageCircle },
    LINKEDIN: { label: "LinkedIn", Icon: Linkedin },
    IHUB: { label: "iHub website", Icon: Globe },
    OTHER: { label: "Website", Icon: Globe },
};

const staticSocialItems = [
    { key: "instagram", href: siteConfig.social.instagram, label: "Instagram", Icon: Instagram },
    { key: "facebook", href: siteConfig.social.facebook, label: "Facebook", Icon: Facebook },
    { key: "whatsapp", href: siteConfig.social.whatsapp, label: "WhatsApp community", Icon: MessageCircle },
    { key: "linkedin", href: siteConfig.social.linkedin, label: "LinkedIn", Icon: Linkedin },
    { key: "ihub", href: siteConfig.social.ihub, label: "iHub website", Icon: Globe },
] as const;

export function SocialLinks({ className = "", links }: SocialLinksProps) {
    const resolvedLinks = links ?? fallbackSocialLinks;

    if (resolvedLinks.length > 0) {
        return (
            <div className={`site-footer-social ${className}`}>
                {resolvedLinks.map((link) => {
                    const meta = platformMeta[link.platform] ?? platformMeta.OTHER;
                    const Icon = meta.Icon;
                    return (
                        <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="site-footer-social-link"
                            aria-label={meta.label}
                        >
                            <Icon className="h-4 w-4" />
                        </a>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`site-footer-social ${className}`}>
            {staticSocialItems.map(({ key, href, label, Icon }) => (
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
