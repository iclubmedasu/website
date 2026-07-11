import express, { Request, Response } from "express";
import { prisma } from "../db";
import { looksLikePhone, sanitizePhoneForStorage } from "../lib/phoneUtils";

const router = express.Router();

const ADMINISTRATION_TEAM_NAME = "Administration";
const ADMINISTRATION_LEADERSHIP_ROLE_NAMES = ["President", "Vice President"];
const DEFAULT_ADMINISTRATION_ROLES = [
    { roleName: "Officer", roleType: "Officer", systemRoleKey: 10, maxCount: null as number | null },
    { roleName: "President", roleType: "Administration", systemRoleKey: 11, maxCount: 1 },
    { roleName: "Vice President", roleType: "Administration", systemRoleKey: 12, maxCount: 1 },
] as const;
const OFFICIAL_EMAIL_REGEX = /^[^\s@]+@med\.asu\.edu\.eg$/i;
const PLACEHOLDER_FULLNAME = "Pending";

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

            for (const role of DEFAULT_ADMINISTRATION_ROLES) {
                await tx.teamRole.create({
                    data: {
                        teamId: createdTeam.id,
                        roleName: role.roleName,
                        roleType: role.roleType,
                        systemRoleKey: role.systemRoleKey,
                        maxCount: role.maxCount,
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
        for (const roleDef of DEFAULT_ADMINISTRATION_ROLES) {
            const existingRole = await prisma.teamRole.findFirst({
                where: { teamId: team.id, roleName: roleDef.roleName },
            });

            if (!existingRole) {
                await prisma.teamRole.create({
                    data: {
                        teamId: team.id,
                        roleName: roleDef.roleName,
                        roleType: roleDef.roleType,
                        systemRoleKey: roleDef.systemRoleKey,
                        maxCount: roleDef.maxCount,
                    },
                });
            } else if (
                existingRole.roleType !== roleDef.roleType
                || existingRole.systemRoleKey !== roleDef.systemRoleKey
                || existingRole.maxCount !== roleDef.maxCount
            ) {
                await prisma.teamRole.update({
                    where: { id: existingRole.id },
                    data: {
                        roleType: roleDef.roleType,
                        systemRoleKey: roleDef.systemRoleKey,
                        maxCount: roleDef.maxCount,
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

function countActiveRoleMembers(team: Awaited<ReturnType<typeof getOrCreateAdministrationTeam>>, roleName: string): number {
    return (team?.members ?? []).filter((member) => member.isActive !== false && member.role?.roleName === roleName).length;
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
        const team = await getOrCreateAdministrationTeam();
        if (!team) {
            return res.status(500).json({ error: "Failed to load Administration team" });
        }

        const activeOfficerCount = countActiveRoleMembers(team, "Officer");
        if (activeOfficerCount === 0 && !req.user?.isAdmin) {
            return res.status(403).json({ error: "Only President or Vice President can assign the first officer." });
        }

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

        const normalizedPhone = isPhone ? sanitizePhoneForStorage(identifier) : null;
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

const OUTGOING_LEAVE_TYPES = ["Retirement", "Resignation", "Expulsion", "Graduation"] as const;

type OutgoingLeaveType = (typeof OUTGOING_LEAVE_TYPES)[number];

type LeadershipHandoverPayload = {
    currentAssignmentId?: number | string;
    targetMemberId?: number | string;
    targetAssignmentId?: number | string | null;
    changeReason?: string | null;
    notes?: string | null;
    outgoingDisposition?: "leave" | "transfer";
    outgoingChangeType?: OutgoingLeaveType;
    outgoingTransferTeamId?: number | string | null;
    outgoingTransferRoleId?: number | string | null;
    outgoingChangeReason?: string | null;
    outgoingNotes?: string | null;
};

router.post("/leadership-handover", async (req: Request<unknown, unknown, LeadershipHandoverPayload>, res: Response) => {
    try {
        if (!req.user?.isAdmin) {
            return res.status(403).json({ error: "Only President or Vice President can hand over leadership roles." });
        }

        const team = await getOrCreateAdministrationTeam();
        if (!team) {
            return res.status(500).json({ error: "Failed to load Administration team" });
        }

        const currentAssignmentId = Number(req.body.currentAssignmentId);
        const targetMemberId = Number(req.body.targetMemberId);
        const outgoingDisposition = req.body.outgoingDisposition === "transfer" ? "transfer" : "leave";
        const outgoingChangeType = req.body.outgoingChangeType ?? "Retirement";
        const targetAssignmentIdRaw = req.body.targetAssignmentId;
        const targetAssignmentId = targetAssignmentIdRaw == null || targetAssignmentIdRaw === ""
            ? null
            : Number(targetAssignmentIdRaw);
        const outgoingTransferTeamIdRaw = req.body.outgoingTransferTeamId;
        const outgoingTransferTeamId = outgoingTransferTeamIdRaw == null || outgoingTransferTeamIdRaw === ""
            ? null
            : Number(outgoingTransferTeamIdRaw);
        const outgoingTransferRoleIdRaw = req.body.outgoingTransferRoleId;
        const outgoingTransferRoleId = outgoingTransferRoleIdRaw == null || outgoingTransferRoleIdRaw === ""
            ? null
            : Number(outgoingTransferRoleIdRaw);

        if (Number.isNaN(currentAssignmentId) || Number.isNaN(targetMemberId)) {
            return res.status(400).json({ error: "currentAssignmentId and targetMemberId are required." });
        }

        if (outgoingDisposition === "transfer" && (Number.isNaN(outgoingTransferTeamId) || Number.isNaN(outgoingTransferRoleId))) {
            return res.status(400).json({ error: "Outgoing transfer team and role are required when transferring the current leader." });
        }

        if (targetAssignmentIdRaw != null && targetAssignmentIdRaw !== "" && Number.isNaN(targetAssignmentId)) {
            return res.status(400).json({ error: "targetAssignmentId must be a valid assignment id." });
        }

        if (outgoingDisposition === "leave" && !OUTGOING_LEAVE_TYPES.includes(outgoingChangeType)) {
            return res.status(400).json({ error: `outgoingChangeType must be one of: ${OUTGOING_LEAVE_TYPES.join(", ")}` });
        }

        const currentAssignment = await prisma.teamMember.findUnique({
            where: { id: currentAssignmentId },
            include: {
                team: true,
                member: true,
                role: true,
            },
        });

        if (!currentAssignment || currentAssignment.team?.name !== ADMINISTRATION_TEAM_NAME) {
            return res.status(404).json({ error: "Current leadership assignment not found." });
        }

        if (!ADMINISTRATION_LEADERSHIP_ROLE_NAMES.includes(currentAssignment.role?.roleName ?? "")) {
            return res.status(400).json({ error: "Only President or Vice President roles can use leadership handover." });
        }

        if (currentAssignment.memberId === targetMemberId) {
            return res.status(400).json({ error: "Select a different member for the handover." });
        }

        const targetMember = await prisma.member.findUnique({
            where: { id: targetMemberId },
        });

        if (!targetMember) {
            return res.status(404).json({ error: "Target member not found." });
        }

        const targetAssignments = await prisma.teamMember.findMany({
            where: {
                memberId: targetMemberId,
                isActive: true,
            },
            include: {
                team: true,
                member: true,
                role: true,
                subteam: true,
            },
            orderBy: { joinedDate: "desc" },
        });

        const currentTargetAssignment = targetAssignmentId == null
            ? (targetAssignments.length === 1 ? targetAssignments[0] : null)
            : targetAssignments.find((assignment) => assignment.id === targetAssignmentId) ?? null;

        if (targetAssignmentId != null && !currentTargetAssignment) {
            return res.status(404).json({ error: "Target assignment not found." });
        }

        if (targetAssignments.length > 1 && !currentTargetAssignment) {
            return res.status(400).json({ error: "Select which current assignment the member is transferring from." });
        }

        if (currentTargetAssignment && currentTargetAssignment.id === currentAssignment.id) {
            return res.status(400).json({ error: "The selected member is already holding this leadership assignment." });
        }

        if (outgoingDisposition === "transfer") {
            const [outgoingTransferTeam, outgoingTransferRole] = await Promise.all([
                prisma.team.findUnique({ where: { id: outgoingTransferTeamId as number } }),
                prisma.teamRole.findUnique({ where: { id: outgoingTransferRoleId as number } }),
            ]);

            if (!outgoingTransferTeam) {
                return res.status(404).json({ error: "Outgoing transfer team not found." });
            }

            if (!outgoingTransferRole) {
                return res.status(404).json({ error: "Outgoing transfer role not found." });
            }

            if (outgoingTransferRole.teamId !== outgoingTransferTeam.id) {
                return res.status(400).json({ error: "Outgoing transfer role must belong to the selected team." });
            }
        }

        const now = new Date();
        const changeReason = (req.body.changeReason ?? "").toString().trim() || `Handover from ${currentAssignment.role?.roleName ?? "leadership"}`;
        const notes = (req.body.notes ?? "").toString().trim() || null;
        const outgoingReason = (req.body.outgoingChangeReason ?? "").toString().trim() || changeReason;
        const outgoingNotes = (req.body.outgoingNotes ?? "").toString().trim() || notes;

        const result = await prisma.$transaction(async (tx) => {
            let outgoingAssignment: unknown = null;

            await tx.memberRoleHistory.updateMany({
                where: {
                    memberId: currentAssignment.memberId,
                    teamId: currentAssignment.teamId,
                    isActive: true,
                },
                data: {
                    endDate: now,
                    isActive: false,
                },
            });

            await tx.teamMember.delete({
                where: { id: currentAssignment.id },
            });

            if (outgoingDisposition === "leave") {
                await tx.memberRoleHistory.create({
                    data: {
                        memberId: currentAssignment.memberId,
                        teamId: currentAssignment.teamId,
                        roleId: currentAssignment.roleId,
                        changeType: outgoingChangeType,
                        changeReason: outgoingReason,
                        notes: outgoingNotes,
                        isActive: false,
                        endDate: now,
                    },
                });

                await tx.alumni.create({
                    data: {
                        memberId: currentAssignment.memberId,
                        teamId: currentAssignment.teamId,
                        roleId: currentAssignment.roleId,
                        subteamId: currentAssignment.subteamId,
                        leaveType: outgoingChangeType,
                        leftDate: now,
                        changeReason: outgoingReason || null,
                        notes: outgoingNotes || null,
                    },
                });

                await tx.member.update({
                    where: { id: currentAssignment.memberId },
                    data: { assignmentStatus: "ALUMNI" },
                });
            } else {
                const outgoingTransferTeamIdInt = outgoingTransferTeamId as number;
                const outgoingTransferRoleIdInt = outgoingTransferRoleId as number;

                await tx.memberRoleHistory.create({
                    data: {
                        memberId: currentAssignment.memberId,
                        teamId: currentAssignment.teamId,
                        roleId: currentAssignment.roleId,
                        changeType: "Transfer",
                        changeReason: outgoingReason,
                        notes: outgoingNotes,
                        isActive: false,
                        endDate: now,
                    },
                });

                const outgoingExistingAssignment = await tx.teamMember.findUnique({
                    where: {
                        teamId_memberId: {
                            teamId: outgoingTransferTeamIdInt,
                            memberId: currentAssignment.memberId,
                        },
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true,
                        subteam: true,
                    },
                });

                if (outgoingExistingAssignment) {
                    outgoingAssignment = await tx.teamMember.update({
                        where: { id: outgoingExistingAssignment.id },
                        data: {
                            roleId: outgoingTransferRoleIdInt,
                            isActive: true,
                            leftDate: null,
                        },
                        include: {
                            team: true,
                            member: true,
                            role: true,
                            subteam: true,
                        },
                    });
                } else {
                    outgoingAssignment = await tx.teamMember.create({
                        data: {
                            memberId: currentAssignment.memberId,
                            teamId: outgoingTransferTeamIdInt,
                            roleId: outgoingTransferRoleIdInt,
                        },
                        include: {
                            team: true,
                            member: true,
                            role: true,
                            subteam: true,
                        },
                    });
                }

                await tx.memberRoleHistory.create({
                    data: {
                        memberId: currentAssignment.memberId,
                        teamId: outgoingTransferTeamIdInt,
                        roleId: outgoingTransferRoleIdInt,
                        changeType: "Transfer",
                        changeReason: outgoingReason,
                        notes: outgoingNotes,
                    },
                });

                await tx.member.update({
                    where: { id: currentAssignment.memberId },
                    data: { assignmentStatus: "ASSIGNED" },
                });
            }

            let newAssignment;
            if (currentTargetAssignment) {
                await tx.memberRoleHistory.updateMany({
                    where: {
                        memberId: targetMemberId,
                        teamId: currentTargetAssignment.teamId,
                        isActive: true,
                    },
                    data: {
                        endDate: now,
                        isActive: false,
                    },
                });

                newAssignment = await tx.teamMember.update({
                    where: { id: currentTargetAssignment.id },
                    data: {
                        teamId: team.id,
                        roleId: currentAssignment.roleId,
                        isActive: true,
                        leftDate: null,
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true,
                        subteam: true,
                    },
                });

                await tx.memberRoleHistory.create({
                    data: {
                        memberId: targetMemberId,
                        teamId: team.id,
                        roleId: currentAssignment.roleId,
                        changeType: currentTargetAssignment.teamId === team.id ? "Promotion" : "Transfer",
                        changeReason,
                        notes,
                    },
                });
            } else {
                newAssignment = await tx.teamMember.create({
                    data: {
                        memberId: targetMemberId,
                        teamId: team.id,
                        roleId: currentAssignment.roleId,
                    },
                    include: {
                        team: true,
                        member: true,
                        role: true,
                        subteam: true,
                    },
                });

                await tx.memberRoleHistory.create({
                    data: {
                        memberId: targetMemberId,
                        teamId: team.id,
                        roleId: currentAssignment.roleId,
                        changeType: "Transfer",
                        changeReason,
                        notes,
                    },
                });
            }

            return { retiredCurrentAssignment: currentAssignment, outgoingAssignment, newAssignment };
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Leadership handover error:", error);
        return res.status(500).json({ error: "Failed to hand over leadership role" });
    }
});

export default router;
