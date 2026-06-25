export const siteConfig = {
    name: "iClub, MED-ASU",
    shortName: "iClub",
    abbreviation: "MED-ASU",
    organization: "Faculty of Medicine, Ain Shams University",
    tagline: "Where medical students turn ideas into impact.",
    description:
        "iClub, MED-ASU connects medical students through events, projects, and community initiatives at the Faculty of Medicine, Ain Shams University.",
    copyrightName: "iClub, MED-ASU",
    contactEmail: "asu.medicine.iclub@gmail.com",
    social: {
        instagram: "https://www.instagram.com/iclub_asu.med/",
        facebook: "https://www.facebook.com/ASUMed.IClub",
        whatsapp: "https://chat.whatsapp.com/KjIj7nohE12CjtjFsTx4mf?mode=wwt",
        linkedin: "https://www.linkedin.com/company/innovation-club-asu/",
        ihub: "https://www.asu.edu.eg/ihub/",
    },
} as const;

export const navLinks = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/events" },
    { label: "Projects", href: "/projects" },
    { label: "Members", href: "/members" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Support", href: "/support" },
] as const;
