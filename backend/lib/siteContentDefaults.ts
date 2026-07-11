export const DEFAULT_SITE_NAME = "iClub, MED-ASU";
export const DEFAULT_SITE_DESCRIPTION =
    "iClub, MED-ASU connects medical students through events, projects, and community initiatives at the Faculty of Medicine, Ain Shams University.";
export const DEFAULT_CONTACT_EMAIL = "asu.medicine.iclub@gmail.com";

export const DEFAULT_ABOUT_PAGE = {
    id: "about" as const,
    eyebrow: "About",
    title: DEFAULT_SITE_NAME,
    description: DEFAULT_SITE_DESCRIPTION,
};

export const DEFAULT_CONTACT_PAGE = {
    id: "contact" as const,
    eyebrow: "Contact",
    title: "We would love to hear from you",
    description:
        "Reach out with questions about events, partnerships, or getting involved with iClub.",
};

export const DEFAULT_ABOUT_SECTIONS = [
    {
        sortOrder: 0,
        type: "TWO_COLUMN" as const,
        title: "Mission & Vision",
        leftLabel: "Mission",
        leftText:
            "iClub, MED-ASU empowers medical students to explore innovation, leadership, and interdisciplinary collaboration. We create spaces where ideas become action and students build skills that extend beyond the classroom.",
        rightLabel: "Vision",
        rightText:
            "We envision a student community where healthcare innovation is accessible, inclusive, and driven by curiosity — preparing future physicians to lead with empathy and creativity.",
    },
    {
        sortOrder: 1,
        type: "BULLET_LIST" as const,
        title: "What We Do",
        bullets: [
            "Host educational and networking events for medical students",
            "Lead collaborative projects that address real healthcare challenges",
            "Build community across disciplines, teams, and experience levels",
            "Support innovation through mentorship, workshops, and hands-on learning",
        ],
    },
    {
        sortOrder: 2,
        type: "SPONSORS" as const,
        title: "Partners & Sponsors",
        emptyMessage: "Partner and sponsor highlights are coming soon.",
    },
];

export const DEFAULT_CONTACT_METHOD = {
    sortOrder: 0,
    type: "EMAIL" as const,
    label: "Email",
    value: DEFAULT_CONTACT_EMAIL,
    isActive: true,
};

export const DEFAULT_SOCIAL_LINKS = [
    { sortOrder: 0, platform: "INSTAGRAM" as const, url: "https://www.instagram.com/iclub_asu.med/", isActive: true },
    { sortOrder: 1, platform: "FACEBOOK" as const, url: "https://www.facebook.com/ASUMed.IClub", isActive: true },
    {
        sortOrder: 2,
        platform: "WHATSAPP" as const,
        url: "https://chat.whatsapp.com/KjIj7nohE12CjtjFsTx4mf?mode=wwt",
        isActive: true,
    },
    {
        sortOrder: 3,
        platform: "LINKEDIN" as const,
        url: "https://www.linkedin.com/company/innovation-club-asu/",
        isActive: true,
    },
    { sortOrder: 4, platform: "IHUB" as const, url: "https://www.asu.edu.eg/ihub/", isActive: true },
];
