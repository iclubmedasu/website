import express, { Request, Response } from "express";
import { prisma } from "../db";

const router = express.Router();

type RoleHistoryQuery = {
    memberId?: string | string[];
    teamId?: string | string[];
    changeType?: string | string[];
    isActive?: string | string[];
};

type RoleHistoryUpdatePayload = {
    changeReason?: string | null;
    notes?: string | null;
    changeType?: string;
};

function firstValue(input: string | string[] | undefined): string | undefined {
    return Array.isArray(input) ? input[0] : input;
}

router.get("/", async (req: Request<unknown, unknown, unknown, RoleHistoryQuery>, res: Response) => {
    try {
        const memberId = firstValue(req.query.memberId);
        const teamId = firstValue(req.query.teamId);
        const changeType = firstValue(req.query.changeType);
        const isActive = firstValue(req.query.isActive);

        const where: {
            memberId?: number;
            teamId?: number;
            changeType?: string;
            isActive?: boolean;
        } = {};

        if (memberId) {
            where.memberId = parseInt(memberId, 10);
        }
        if (teamId) {
            where.teamId = parseInt(teamId, 10);
        }
        if (changeType) {
            where.changeType = changeType;
        }
        if (isActive !== undefined) {
            where.isActive = isActive === "true";
        }

        const history = await prisma.memberRoleHistory.findMany({
            where,
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true,
            },
            orderBy: { startDate: "desc" },
        });

        return res.json(history);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch role history" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);

        const historyEntry = await prisma.memberRoleHistory.findUnique({
            where: { id },
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true,
            },
        });

        if (!historyEntry) {
            return res.status(404).json({ error: "History entry not found" });
        }

        return res.json(historyEntry);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch history entry" });
    }
});

router.get("/member/:memberId", async (req: Request, res: Response) => {
    try {
        const memberId = parseInt(String(req.params.memberId), 10);

        const history = await prisma.memberRoleHistory.findMany({
            where: { memberId },
            include: {
                team: true,
                role: true,
                subteam: true,
            },
            orderBy: { startDate: "desc" },
        });

        return res.json(history);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch member history" });
    }
});

router.get("/member/:memberId/timeline", async (req: Request, res: Response) => {
    try {
        const memberId = parseInt(String(req.params.memberId), 10);

        const history = await prisma.memberRoleHistory.findMany({
            where: { memberId },
            include: {
                team: true,
                role: true,
                member: true,
                subteam: true,
            },
            orderBy: { startDate: "asc" },
        });

        const timeline = history.map((entry) => ({
            id: entry.id,
            memberName: entry.member.fullName,
            teamName: entry.team?.name || "Unknown Team",
            roleName: entry.role?.roleName || "Unknown Role",
            subteamName: entry.subteam?.name || null,
            changeType: entry.changeType,
            changeReason: entry.changeReason,
            notes: entry.notes,
            period: {
                start: entry.startDate,
                end: entry.endDate,
                duration: entry.endDate
                    ? Math.floor((new Date(entry.endDate).getTime() - new Date(entry.startDate).getTime()) / (1000 * 60 * 60 * 24))
                    : "Ongoing",
            },
            isActive: entry.isActive,
        }));

        return res.json(timeline);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch member timeline" });
    }
});

router.get("/team/:teamId", async (req: Request, res: Response) => {
    try {
        const teamId = parseInt(String(req.params.teamId), 10);

        const history = await prisma.memberRoleHistory.findMany({
            where: { teamId },
            include: {
                member: true,
                role: true,
                subteam: true,
            },
            orderBy: { startDate: "desc" },
        });

        return res.json(history);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch team history" });
    }
});

router.get("/stats/changes", async (_req: Request, res: Response) => {
    try {
        const stats = await prisma.memberRoleHistory.groupBy({
            by: ["changeType"],
            _count: {
                changeType: true,
            },
        });

        const formattedStats = stats.map((stat) => ({
            changeType: stat.changeType,
            count: stat._count.changeType,
        }));

        return res.json(formattedStats);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

router.put("/:id", async (req: Request<{ id: string }, unknown, RoleHistoryUpdatePayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { changeReason, notes, changeType } = req.body;

        const updateData: {
            changeReason?: string | null;
            notes?: string | null;
            changeType?: string;
        } = {};

        if (changeReason !== undefined) {
            updateData.changeReason = changeReason;
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        if (changeType !== undefined) {
            updateData.changeType = changeType;
        }

        const updatedHistory = await prisma.memberRoleHistory.update({
            where: { id },
            data: updateData,
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true,
            },
        });

        return res.json(updatedHistory);
    } catch (error) {
        console.error(error);

        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return res.status(404).json({ error: "History entry not found" });
        }

        return res.status(500).json({ error: "Failed to update history entry" });
    }
});

router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);

        await prisma.memberRoleHistory.delete({
            where: { id },
        });

        return res.json({ message: "History entry permanently deleted" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to delete history entry" });
    }
});

export default router;
