import { prisma } from "../db";

const SITE_NAME = "iClub, MED-ASU";
const SITE_DESCRIPTION =
    "iClub, MED-ASU connects medical students through events, projects, and community initiatives at the Faculty of Medicine, Ain Shams University.";
const CONTACT_EMAIL = "asu.medicine.iclub@gmail.com";

async function seedSiteContent() {
    const existingAbout = await prisma.sitePage.findUnique({ where: { id: "about" } });
    if (existingAbout) {
        console.log("Site content already seeded — skipping.");
        return;
    }

    await prisma.sitePage.createMany({
        data: [
            {
                id: "about",
                eyebrow: "About",
                title: SITE_NAME,
                description: SITE_DESCRIPTION,
            },
            {
                id: "contact",
                eyebrow: "Contact",
                title: "We would love to hear from you",
                description:
                    "Reach out with questions about events, partnerships, or getting involved with iClub.",
            },
        ],
    });

    const missionSection = await prisma.aboutSection.create({
        data: {
            sortOrder: 0,
            type: "TWO_COLUMN",
            title: "Mission & Vision",
            leftLabel: "Mission",
            leftText:
                "iClub, MED-ASU empowers medical students to explore innovation, leadership, and interdisciplinary collaboration. We create spaces where ideas become action and students build skills that extend beyond the classroom.",
            rightLabel: "Vision",
            rightText:
                "We envision a student community where healthcare innovation is accessible, inclusive, and driven by curiosity — preparing future physicians to lead with empathy and creativity.",
        },
    });

    await prisma.aboutSection.create({
        data: {
            sortOrder: 1,
            type: "BULLET_LIST",
            title: "What We Do",
            bullets: [
                "Host educational and networking events for medical students",
                "Lead collaborative projects that address real healthcare challenges",
                "Build community across disciplines, teams, and experience levels",
                "Support innovation through mentorship, workshops, and hands-on learning",
            ],
        },
    });

    await prisma.aboutSection.create({
        data: {
            sortOrder: 2,
            type: "SPONSORS",
            title: "Partners & Sponsors",
            emptyMessage: "Partner and sponsor highlights are coming soon.",
        },
    });

    void missionSection;

    await prisma.contactMethod.create({
        data: {
            sortOrder: 0,
            type: "EMAIL",
            label: "Email",
            value: CONTACT_EMAIL,
            isActive: true,
        },
    });

    await prisma.socialLink.createMany({
        data: [
            { sortOrder: 0, platform: "INSTAGRAM", url: "https://www.instagram.com/iclub_asu.med/", isActive: true },
            { sortOrder: 1, platform: "FACEBOOK", url: "https://www.facebook.com/ASUMed.IClub", isActive: true },
            {
                sortOrder: 2,
                platform: "WHATSAPP",
                url: "https://chat.whatsapp.com/KjIj7nohE12CjtjFsTx4mf?mode=wwt",
                isActive: true,
            },
            {
                sortOrder: 3,
                platform: "LINKEDIN",
                url: "https://www.linkedin.com/company/innovation-club-asu/",
                isActive: true,
            },
            { sortOrder: 4, platform: "IHUB", url: "https://www.asu.edu.eg/ihub/", isActive: true },
        ],
    });

    console.log("Site content seeded successfully.");
}

seedSiteContent()
    .catch((error) => {
        console.error("Failed to seed site content:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
