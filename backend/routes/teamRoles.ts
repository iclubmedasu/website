import express, { Request, Response } from "express";
import { prisma } from "../db";

const router = express.Router();

type TeamRoleListQuery = {
    teamId?: string | string[];
    isActive?: string | string[];
};

type TeamRolePayload = {
    teamId?: string | number;
    roleName?: string;
    maxCount?: string | number | null;
    roleType?: string;
    isActive?: boolean;
};

function firstValue(input: string | string[] | undefined): string | undefined {
    return Array.isArray(input) ? input[0] : input;
}

router.get("/", async (req: Request<unknown, unknown, unknown, TeamRoleListQuery>, res: Response) => {
    try {
        const teamIdRaw = firstValue(req.query.teamId);
        const isActiveRaw = firstValue(req.query.isActive);

        const where: { teamId?: number; isActive?: boolean } = {};
        if (teamIdRaw) {
            where.teamId = parseInt(teamIdRaw, 10);
        }
        if (isActiveRaw !== undefined) {
            where.isActive = isActiveRaw === "true";
        }

        const roles = await prisma.teamRole.findMany({
            where,
            include: {
                team: true,
                _count: {
                    select: {
                        assignments: { where: { isActive: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return res.json(roles);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch team roles" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);

        const role = await prisma.teamRole.findUnique({
            where: { id },
            include: {
                team: true,
                assignments: {
                    where: { isActive: true },
                    include: {
                        member: true,
                    },
                },
            },
        });

        if (!role) {
            return res.status(404).json({ error: "Role not found" });
        }

        return res.json(role);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch role" });
    }
});

router.post("/", async (req: Request<unknown, unknown, TeamRolePayload>, res: Response) => {
    try {
        const { teamId, roleName, maxCount, roleType } = req.body;
        const parsedTeamId = parseInt(String(teamId), 10);

        const team = await prisma.team.findUnique({
            where: { id: parsedTeamId },
        });

        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const normalizedRoleType = roleType || "Regular";
        const isLeadership = normalizedRoleType === "Leadership";

        const newRole = await prisma.teamRole.create({
            data: {
                teamId: parsedTeamId,
                roleName: roleName || "",
                roleType: normalizedRoleType,
                maxCount: isLeadership ? 1 : maxCount ? parseInt(String(maxCount), 10) : null,
            },
            include: {
                team: true,
            },
        });

        return res.status(201).json(newRole);
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            return res.status(400).json({ error: "Role name already exists in this team" });
        }

        return res.status(500).json({ error: "Failed to create role" });
    }
});

router.put("/:id", async (req: Request<{ id: string }, unknown, TeamRolePayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { roleName, maxCount, roleType, isActive } = req.body;

        const updateData: {
            roleName?: string;
            maxCount?: number | null;
            roleType?: string;
            isActive?: boolean;
        } = {};

        if (roleName !== undefined) {
            updateData.roleName = roleName;
        }
        if (roleType !== undefined) {
            updateData.roleType = roleType;
        }

        if (roleType === "Leadership") {
            updateData.maxCount = 1;
        } else if (maxCount !== undefined) {
            updateData.maxCount = maxCount ? parseInt(String(maxCount), 10) : null;
        }

        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        const updatedRole = await prisma.teamRole.update({
            where: { id },
            data: updateData,
            include: {
                team: true,
            },
        });

        return res.json(updatedRole);
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error) {
            const code = (error as { code?: string }).code;
            if (code === "P2025") {
                return res.status(404).json({ error: "Role not found" });
            }
            if (code === "P2002") {
                return res.status(400).json({ error: "Role name already exists in this team" });
            }
        }

        return res.status(500).json({ error: "Failed to update role" });
    }
});

router.patch("/:id/deactivate", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid role id" });
        }

        const role = await prisma.teamRole.findUnique({
            where: { id },
            include: { team: true },
        });

        if (!role) {
            return res.status(404).json({ error: "Role not found" });
        }

        if (role.systemRoleKey != null) {
            return res.status(400).json({
                error: "This is a default team role (Head of Team, Vice Head of Team, or Member) and cannot be deactivated.",
            });
        }

        const memberRole = await prisma.teamRole.findFirst({
            where: {
                teamId: role.teamId,
                systemRoleKey: 3,
                isActive: true,
            },
        });

        if (!memberRole) {
            return res.status(400).json({
                error: "This team has no default \"Member\" role (system role). Cannot deactivate this role.",
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.teamRole.update({
                where: { id },
                data: { isActive: false },
            });

            await tx.teamMember.updateMany({
                where: { roleId: id },
                data: { roleId: memberRole.id },
            });
        });

        const deactivatedRole = await prisma.teamRole.findUnique({
            where: { id },
            include: { team: true },
        });

        return res.json({
            message: "Role deactivated. Members holding this role were moved to the default \"Member\" role; they remain in the team.",
            role: deactivatedRole,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to deactivate role" });
    }
});

router.patch("/:id/activate", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);

        const activatedRole = await prisma.teamRole.update({
            where: { id },
            data: { isActive: true },
        });

        return res.json({
            message: "Role activated successfully",
            role: activatedRole,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to activate role" });
    }
});

export default router;
