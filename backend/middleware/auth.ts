import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import type { RequestUser } from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";
const ADMINISTRATION_TEAM_NAME = "Administration";

const authenticateToken = (req: Request, res: Response, next: NextFunction): Response | void => {
    const token =
        req.cookies?.token ||
        (typeof req.headers.authorization === "string"
            ? req.headers.authorization.replace("Bearer ", "")
            : undefined);

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }

        req.user = (user as RequestUser) ?? {};
        return next();
    });
};

/** Require user to be developer or in Administration team. Use after authenticateToken. */
const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    if (req.user?.isDeveloper) {
        return next();
    }

    if (!req.user?.memberId) {
        return res.status(403).json({ error: "Admin access required" });
    }

    const adminMembership = await prisma.teamMember.findFirst({
        where: {
            memberId: req.user.memberId,
            isActive: true,
            team: { name: ADMINISTRATION_TEAM_NAME },
        },
    });

    if (!adminMembership) {
        return res.status(403).json({ error: "Admin access required" });
    }

    return next();
};

export { authenticateToken, requireAdmin, JWT_SECRET };