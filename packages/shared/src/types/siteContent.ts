export type AboutSectionType = "TWO_COLUMN" | "BULLET_LIST" | "SPONSORS";
export type ContactMethodType = "EMAIL" | "PHONE" | "ADDRESS" | "OTHER";
export type SocialPlatform = "INSTAGRAM" | "FACEBOOK" | "WHATSAPP" | "LINKEDIN" | "IHUB" | "OTHER";

export interface SitePageHeader {
    eyebrow: string;
    title: string;
    description: string;
}

export interface PublicAboutSponsor {
    id: number;
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    sortOrder: number;
}

export interface PublicAboutSectionBase {
    id: number;
    sortOrder: number;
    title: string;
}

export interface PublicAboutTwoColumnSection extends PublicAboutSectionBase {
    type: "TWO_COLUMN";
    leftLabel: string;
    leftText: string;
    rightLabel: string;
    rightText: string;
}

export interface PublicAboutBulletListSection extends PublicAboutSectionBase {
    type: "BULLET_LIST";
    bullets: string[];
}

export interface PublicAboutSponsorsSection extends PublicAboutSectionBase {
    type: "SPONSORS";
    emptyMessage?: string | null;
    sponsors: PublicAboutSponsor[];
}

export type PublicAboutSection =
    | PublicAboutTwoColumnSection
    | PublicAboutBulletListSection
    | PublicAboutSponsorsSection;

export interface PublicAboutPage {
    header: SitePageHeader;
    sections: PublicAboutSection[];
}

export interface PublicContactMethod {
    id: number;
    type: ContactMethodType;
    label: string;
    value: string;
    sortOrder: number;
}

export interface PublicSocialLink {
    id: number;
    platform: SocialPlatform;
    url: string;
    sortOrder: number;
}

export interface PublicContactPage {
    header: SitePageHeader;
    methods: PublicContactMethod[];
    socialLinks: PublicSocialLink[];
}

export interface UpdateSitePageHeaderPayload {
    eyebrow: string;
    title: string;
    description: string;
}

export interface CreateAboutSectionPayload {
    type: AboutSectionType;
    title: string;
    leftLabel?: string;
    leftText?: string;
    rightLabel?: string;
    rightText?: string;
    bullets?: string[];
    emptyMessage?: string;
}

export interface UpdateAboutSectionPayload {
    title?: string;
    leftLabel?: string;
    leftText?: string;
    rightLabel?: string;
    rightText?: string;
    bullets?: string[];
    emptyMessage?: string;
}

export interface ReorderPayload {
    orderedIds: number[];
}

export interface CreateAboutSponsorPayload {
    name: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
}

export interface UpdateAboutSponsorPayload {
    name?: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
}

export interface CreateContactMethodPayload {
    type: ContactMethodType;
    label: string;
    value: string;
    isActive?: boolean;
}

export interface UpdateContactMethodPayload {
    type?: ContactMethodType;
    label?: string;
    value?: string;
    isActive?: boolean;
}

export interface CreateSocialLinkPayload {
    platform: SocialPlatform;
    url: string;
    isActive?: boolean;
}

export interface UpdateSocialLinkPayload {
    platform?: SocialPlatform;
    url?: string;
    isActive?: boolean;
}

export type EditorAboutSponsor = PublicAboutSponsor;
export type EditorAboutSection = PublicAboutSection;

export interface EditorAboutPage {
    header: SitePageHeader;
    sections: EditorAboutSection[];
}

export interface EditorContactMethod extends PublicContactMethod {
    isActive: boolean;
}

export interface EditorSocialLink extends PublicSocialLink {
    isActive: boolean;
}

export interface EditorContactPage {
    header: SitePageHeader;
    methods: EditorContactMethod[];
    socialLinks: EditorSocialLink[];
}
