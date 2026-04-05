import express, { Request, Response } from "express";
import { prisma } from "../db";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const teamIdRaw = Array.isArray(req.query.teamId) ? req.query.teamId[0] : req.query.teamId;
        const where: { teamId?: number } = {};

        if (teamIdRaw) {
            where.teamId = parseInt(String(teamIdRaw), 10);
        }

        const list = await prisma.alumni.findMany({
            where,
            include: {
                member: true,
                team: true,
                role: true,
                subteam: true,
            },
            orderBy: { leftDate: "desc" },
        });

        return res.json(list);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch alumni" });
    }
});

export default router;
