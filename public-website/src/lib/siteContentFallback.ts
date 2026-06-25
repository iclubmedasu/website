import type {
    PublicAboutPage,
    PublicContactPage,
    PublicIncidentReportField,
    PublicIncidentReportForm,
    PublicSocialLink,
    PublicSupportPage,
} from "@iclub/shared";
import { aboutContent } from "@/content/about";
import { siteConfig } from "@/lib/site";

export const fallbackAboutPage: PublicAboutPage = {
    header: {
        eyebrow: "About",
        title: siteConfig.name,
        description: siteConfig.description,
    },
    sections: [
        {
            id: 1,
            sortOrder: 0,
            type: "TWO_COLUMN",
            title: aboutContent.mission.title,
            leftLabel: "Mission",
            leftText: aboutContent.mission.missionText,
            rightLabel: "Vision",
            rightText: aboutContent.mission.visionText,
        },
        {
            id: 2,
            sortOrder: 1,
            type: "BULLET_LIST",
            title: aboutContent.whatWeDo.title,
            bullets: [...aboutContent.whatWeDo.items],
        },
        {
            id: 3,
            sortOrder: 2,
            type: "SPONSORS",
            title: aboutContent.partners.title,
            emptyMessage: aboutContent.partners.emptyMessage,
            sponsors: [],
        },
    ],
};

export const fallbackContactPage: PublicContactPage = {
    header: {
        eyebrow: "Contact",
        title: "Get in Touch",
        description: `Reach out to ${siteConfig.name} through any of the channels below.`,
    },
    methods: [
        {
            id: 1,
            sortOrder: 0,
            type: "EMAIL",
            label: "Email",
            value: siteConfig.contactEmail,
        },
    ],
    socialLinks: [
        { id: 1, platform: "INSTAGRAM", url: siteConfig.social.instagram, sortOrder: 0 },
        { id: 2, platform: "FACEBOOK", url: siteConfig.social.facebook, sortOrder: 1 },
        { id: 3, platform: "WHATSAPP", url: siteConfig.social.whatsapp, sortOrder: 2 },
        { id: 4, platform: "LINKEDIN", url: siteConfig.social.linkedin, sortOrder: 3 },
        { id: 5, platform: "IHUB", url: siteConfig.social.ihub, sortOrder: 4 },
    ],
};

export const fallbackSocialLinks: PublicSocialLink[] = fallbackContactPage.socialLinks;

const fallbackForms: PublicIncidentReportForm[] = [
    { id: 1, label: "General Report", sortOrder: 0, slug: "general", fields: [] },
    { id: 2, label: "Personal Report", sortOrder: 1, slug: "personal", fields: [] },
    { id: 3, label: "Request Report", sortOrder: 2, slug: "request", fields: [] },
];

export const fallbackSupportPage: PublicSupportPage = {
    header: {
        eyebrow: "Support",
        title: "Help and Support",
        description: `Submit an incident report or request confidentially through the official ${siteConfig.shortName} channel.`,
    },
    notices: [
        {
            id: 1,
            sortOrder: 0,
            locale: "EN",
            content:
                "Please use this form to report an issue or concern in a confidential way. General reports do not require personal details.",
        },
        {
            id: 2,
            sortOrder: 1,
            locale: "AR",
            content:
                "يُرجى استخدام هذا النموذج للإبلاغ عن أي مشكلة أو استفسار بشكل سري. التقارير العامة لا تتطلب بيانات شخصية.",
        },
    ],
    forms: fallbackForms,
};

type LegacySupportPage = Partial<PublicSupportPage> & {
    types?: Array<Omit<PublicIncidentReportForm, "fields">>;
    extraFields?: PublicIncidentReportField[];
    fields?: PublicIncidentReportField[];
};

function buildFormsFromLegacy(page: LegacySupportPage): PublicIncidentReportForm[] {
    if (page.forms?.length) {
        return page.forms;
    }

    const legacyTypes = page.types ?? [];
    const legacyFields = page.extraFields ?? page.fields ?? [];

    if (!legacyTypes.length) {
        return fallbackForms;
    }

    return legacyTypes.map((type) => ({
        ...type,
        fields: legacyFields,
    }));
}

/** Ensures forms exist when API returns a legacy or partial payload. */
export function normalizeSupportPage(page: LegacySupportPage | null | undefined): PublicSupportPage {
    if (!page?.header) {
        return fallbackSupportPage;
    }

    const forms = buildFormsFromLegacy(page);

    return {
        header: page.header,
        notices: page.notices ?? fallbackSupportPage.notices,
        forms: forms.length ? forms : fallbackSupportPage.forms,
    };
}

export function sectionVariant(index: number): "plain" | "tint" {
    return index % 2 === 0 ? "plain" : "tint";
}
