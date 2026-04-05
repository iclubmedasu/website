import express, { Request, Response } from "express";
import { prisma } from "../db";

const router = express.Router();

type TeamSubteamListQuery = {
    teamId?: string | string[];
    isActive?: string | string[];
};

type TeamSubteamPayload = {
    teamId?: string | number;
    name?: string;
    description?: string;
    isActive?: boolean;
};

function firstValue(input: string | string[] | undefined): string | undefined {
    return Array.isArray(input) ? input[0] : input;
}

router.get("/", async (req: Request<unknown, unknown, unknown, TeamSubteamListQuery>, res: Response) => {
    try {
        const teamIdRaw = firstValue(req.query.teamId);
        const isActiveRaw = firstValue(req.query.isActive);

        const where: { teamId?: number; isActive?: boolean } = {};
        const parsedTeamId = teamIdRaw ? parseInt(teamIdRaw, 10) : null;
        if (parsedTeamId != null && !Number.isNaN(parsedTeamId)) {
            where.teamId = parsedTeamId;
        }
        if (isActiveRaw !== undefined) {
            where.isActive = isActiveRaw === "true";
        }

        const subteams = await prisma.subteam.findMany({
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

        return res.json(subteams);
    } catch (error) {
        console.error("[team-subteams GET]", error instanceof Error ? error.message : error);
        return res.json([]);
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);

        const subteam = await prisma.subteam.findUnique({
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

        if (!subteam) {
            return res.status(404).json({ error: "Subteam not found" });
        }

        return res.json(subteam);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch subteam" });
    }
});

router.post("/", async (req: Request<unknown, unknown, TeamSubteamPayload>, res: Response) => {
    try {
        const { teamId, name, description } = req.body;
        const parsedTeamId = parseInt(String(teamId), 10);

        const team = await prisma.team.findUnique({
            where: { id: parsedTeamId },
        });

        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const newSubteam = await prisma.subteam.create({
            data: {
                teamId: parsedTeamId,
                name: (name || "").trim(),
                description: description ? description.trim() : null,
            },
            include: {
                team: true,
            },
        });

        return res.status(201).json(newSubteam);
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            return res.status(400).json({ error: "Subteam name already exists in this team" });
        }

        return res.status(500).json({ error: "Failed to create subteam" });
    }
});

router.put("/:id", async (req: Request<{ id: string }, unknown, TeamSubteamPayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { name, description, isActive } = req.body;

        const updateData: {
            name?: string;
            description?: string | null;
            isActive?: boolean;
        } = {};

        if (name !== undefined) {
            updateData.name = name.trim();
        }
        if (description !== undefined) {
            updateData.description = description ? description.trim() : null;
        }
        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        const updatedSubteam = await prisma.subteam.update({
            where: { id },
            data: updateData,
            include: {
                team: true,
            },
        });

        return res.json(updatedSubteam);
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error) {
            const code = (error as { code?: string }).code;
            if (code === "P2025") {
                return res.status(404).json({ error: "Subteam not found" });
            }
            if (code === "P2002") {
                return res.status(400).json({ error: "Subteam name already exists in this team" });
            }
        }

        return res.status(500).json({ error: "Failed to update subteam" });
    }
});

router.patch("/:id/deactivate", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid subteam id" });
        }

        await prisma.$transaction([
            prisma.subteam.update({
                where: { id },
                data: { isActive: false },
            }),
            prisma.teamMember.updateMany({
                where: { subteamId: id },
                data: { subteamId: null },
            }),
        ]);

        const deactivatedSubteam = await prisma.subteam.findUnique({
            where: { id },
            include: { team: true },
        });

        return res.json({
            message: "Subteam deactivated. All members have been removed from this subteam; they remain in the team with the same role.",
            subteam: deactivatedSubteam,
        });
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return res.status(404).json({ error: "Subteam not found" });
        }

        return res.status(500).json({ error: "Failed to deactivate subteam" });
    }
});

router.patch("/:id/activate", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);

        const activatedSubteam = await prisma.subteam.update({
            where: { id },
            data: { isActive: true },
            include: { team: true },
        });

        return res.json({
            message: "Subteam activated successfully",
            subteam: activatedSubteam,
        });
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return res.status(404).json({ error: "Subteam not found" });
        }

        return res.status(500).json({ error: "Failed to activate subteam" });
    }
});

export default router;
