import express, { Request, Response } from "express";
import { prisma } from "../db";

const router = express.Router();

const ADMINISTRATION_TEAM_NAME = "Administration";
const ADMINISTRATION_ROLE_NAMES = ["Officer", "President", "Vice President"];
const OFFICIAL_EMAIL_REGEX = /^[^\s@]+@med\.asu\.edu\.eg$/i;
const PLACEHOLDER_FULLNAME = "Pending";

function looksLikePhone(value: unknown): value is string {
    if (!value || typeof value !== "string") {
        return false;
    }

    const stripped = value.replace(/\s/g, "");
    return /^[+\d][\d\s\-().]{6,}$/.test(stripped) && !stripped.includes("@");
}

function normalizePhone(raw: unknown): string {
    if (!raw || typeof raw !== "string") {
        return "";
    }

    let cleaned = raw.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) {
        cleaned = "+" + cleaned.slice(1).replace(/\+/g, "");
    } else {
        cleaned = cleaned.replace(/\+/g, "");
    }

    const digits = cleaned.replace(/\+/g, "");
    if (cleaned.startsWith("+20")) {
        return cleaned;
    }
    if (!cleaned.startsWith("+") && digits.startsWith("20") && digits.length === 12) {
        return "+" + digits;
    }
    if (digits.startsWith("0") && digits.length === 11) {
        return "+20" + digits.slice(1);
    }
    if (digits.startsWith("1") && digits.length === 10) {
        return "+20" + digits;
    }

    return cleaned.startsWith("+") ? cleaned : cleaned;
}

async function getOrCreateAdministrationTeam() {
    let team = await prisma.team.findFirst({
        where: { name: ADMINISTRATION_TEAM_NAME },
        include: {
            roles: { where: { isActive: true } },
            members: {
                where: { isActive: true },
                include: { member: true, role: true },
            },
        },
    });

    if (!team) {
        team = await prisma.$transaction(async (tx) => {
            const createdTeam = await tx.team.create({
                data: { name: ADMINISTRATION_TEAM_NAME },
            });

            for (const roleName of ADMINISTRATION_ROLE_NAMES) {
                await tx.teamRole.create({
                    data: {
                        teamId: createdTeam.id,
                        roleName,
                        roleType: "Leadership",
                    },
                });
            }

            return tx.team.findUnique({
                where: { id: createdTeam.id },
                include: {
                    roles: { where: { isActive: true } },
                    members: {
                        where: { isActive: true },
                        include: { member: true, role: true },
                    },
                },
            });
        });
    } else {
        for (const roleName of ADMINISTRATION_ROLE_NAMES) {
            const existingRole = await prisma.teamRole.findFirst({
                where: { teamId: team.id, roleName },
            });

            if (!existingRole) {
                await prisma.teamRole.create({
                    data: {
                        teamId: team.id,
                        roleName,
                        roleType: "Leadership",
                    },
                });
            }
        }

        team = await prisma.team.findUnique({
            where: { id: team.id },
            include: {
                roles: { where: { isActive: true } },
                members: {
                    where: { isActive: true },
                    include: { member: true, role: true },
                },
            },
        });
    }

    return team;
}

router.get("/team", async (_req: Request, res: Response) => {
    try {
        const team = await getOrCreateAdministrationTeam();
        if (!team) {
            return res.status(500).json({ error: "Failed to load Administration team" });
        }
        return res.json(team);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch Administration team" });
    }
});

type OfficerPayload = {
    identifier?: string;
};

router.post("/officer", async (req: Request<unknown, unknown, OfficerPayload>, res: Response) => {
    try {
        const identifier = (req.body.identifier ?? "").toString().trim();
        if (!identifier) {
            return res.status(400).json({ error: "Identifier (email or phone) is required." });
        }

        const isEmail = identifier.includes("@");
        const isPhone = looksLikePhone(identifier);

        if (!isEmail && !isPhone) {
            return res.status(400).json({ error: "Please enter a valid @med.asu.edu.eg email or phone number." });
        }

        if (isEmail && !OFFICIAL_EMAIL_REGEX.test(identifier)) {
            return res.status(400).json({ error: "Email must be an official @med.asu.edu.eg address." });
        }

        const normalizedPhone = isPhone ? normalizePhone(identifier) : null;
        const officerEmail = isEmail ? identifier : `pending-officer-${Date.now()}@med.asu.edu.eg`;
        const officerPhone = isPhone ? (normalizedPhone ?? `pending-${Date.now()}`) : `pending-${Date.now()}`;

        const duplicateConditions: Array<Record<string, string>> = [];
        if (isEmail) {
            duplicateConditions.push({ email: identifier }, { email2: identifier }, { email3: identifier });
        }
        if (isPhone && normalizedPhone) {
            duplicateConditions.push({ phoneNumber: normalizedPhone }, { phoneNumber2: normalizedPhone });
        }

        if (duplicateConditions.length > 0) {
            const existing = await prisma.member.findFirst({
                where: { OR: duplicateConditions },
            });

            if (existing) {
                return res.status(400).json({ error: "A member with this email or phone number already exists." });
            }
        }

        const newMember = await prisma.member.create({
            data: {
                fullName: PLACEHOLDER_FULLNAME,
                email: officerEmail,
                phoneNumber: officerPhone,
                studentId: null,
            },
        });

        return res.status(201).json(newMember);
    } catch (error) {
        console.error("Create officer error:", error);

        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            return res.status(400).json({ error: "Email or phone number already exists." });
        }

        return res.status(500).json({ error: "Failed to create officer member" });
    }
});

export default router;
