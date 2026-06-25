import { prisma } from "../db";

const EN_NOTICE = `Dear all, we hope this message finds you well.

Please ensure that every committee informs its members about the Incident Report channel. This allows any student who may feel hesitant or uncomfortable to still report an issue or concern in a confidential way.

• General Report: No personal details are required from the student.
• Personal Report: The student's name and contact number are needed so we can follow up in case of any misunderstanding or to clarify details.
• Request Report: For any suggestion or request that a student would like to see implemented in iClub.`;

const AR_NOTICE = `السلام عليكم ورحمة الله وبركاته،
نأمل أن تكونوا جميعاً بخير.

يُرجى من كل لجنة إعلام أعضائها بقناة تقرير الحوادث (Incident Report)؛ حتى يتمكّن أي طالب يشعر بالتردد أو بعدم الارتياح من التبليغ عن أي مشكلة أو استفسار بشكل سري.

• التقرير العام (General Report): لا يتطلب أي بيانات شخصية عن الطالب.
• التقرير الشخصي (Personal Report): يُطلب اسم الطالب ورقم التواصل لمتابعة الحالة أو توضيح أي سوء فهم عند الحاجة.
• تقرير الطلبات (Request Report): مخصّص لأي اقتراح أو طلب يرغب الطالب في تنفيذه ضمن iClub.`;

const SYSTEM_TYPES = [
    { slug: "general", label: "General Report", sortOrder: 0 },
    { slug: "personal", label: "Personal Report", sortOrder: 1 },
    { slug: "request", label: "Request Report", sortOrder: 2 },
] as const;

const LEGACY_FIELD_LABELS = ["Report type", "Description", "Your name", "Contact number"];

async function ensureSystemReportTypes() {
    for (const type of SYSTEM_TYPES) {
        const existing = await prisma.incidentReportType.findUnique({ where: { slug: type.slug } });
        if (existing) {
            await prisma.incidentReportType.update({
                where: { id: existing.id },
                data: {
                    label: type.label,
                    sortOrder: type.sortOrder,
                    isSystem: true,
                    isActive: true,
                },
            });
        } else {
            await prisma.incidentReportType.create({
                data: {
                    slug: type.slug,
                    label: type.label,
                    sortOrder: type.sortOrder,
                    isSystem: true,
                    isActive: true,
                },
            });
        }
    }
}

async function seedSupportContent() {
    await ensureSystemReportTypes();

    await prisma.incidentReportField.deleteMany({
        where: { label: { in: [...LEGACY_FIELD_LABELS] } },
    });

    const existing = await prisma.sitePage.findUnique({ where: { id: "support" } });
    if (existing) {
        console.log("Support page already exists — ensured system report types.");
        return;
    }

    await prisma.sitePage.create({
        data: {
            id: "support",
            eyebrow: "Support",
            title: "Help and Support",
            description: "Submit an incident report or request confidentially through the official iClub channel.",
        },
    });

    await prisma.supportNoticeBlock.createMany({
        data: [
            { sortOrder: 0, locale: "EN", content: EN_NOTICE },
            { sortOrder: 1, locale: "AR", content: AR_NOTICE },
        ],
    });

    console.log("Support content seeded successfully.");
}

seedSupportContent()
    .catch((error) => {
        console.error("Failed to seed support content:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
