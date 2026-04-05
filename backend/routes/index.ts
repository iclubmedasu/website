import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";

import authRoutes from "./auth";
import teamsRoutes from "./teams";
import membersRoutes from "./members";
import teamMembersRoutes from "./teamMembers";
import teamRolesRoutes from "./teamRoles";
import teamSubteamsRoutes from "./teamSubteams";
import roleHistoryRoutes from "./roleHistory";
import alumniRoutes from "./alumni";
import administrationRoutes from "./administration";
import projectsRoutes from "./projects";
import tasksRoutes from "./tasks";
import phasesRoutes from "./phases";
import scheduleSlotsRoutes from "./scheduleSlots";
import projectFilesRoutes from "./projectFiles";

import { downloadProfilePhoto } from "../services/githubStorage";

const router = express.Router();

router.use("/auth", authRoutes);

router.get("/members/:id/profile-photo", async (req: Request, res: Response) => {
    try {
        const memberId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(memberId)) {
            return res.status(400).send();
        }

        const result = await downloadProfilePhoto(memberId);
        if (!result) {
            return res.status(404).send();
        }

        res.set("Content-Type", result.contentType);
        res.set("Cache-Control", "public, max-age=300");
        return res.send(result.buffer);
    } catch (error) {
        console.error("GET /members/:id/profile-photo proxy error:", error);
        return res.status(500).send();
    }
});

router.use("/teams", authenticateToken, teamsRoutes);
router.use("/members", authenticateToken, membersRoutes);
router.use("/team-members", authenticateToken, teamMembersRoutes);
router.use("/team-roles", authenticateToken, teamRolesRoutes);
router.use("/team-subteams", authenticateToken, teamSubteamsRoutes);
router.use("/role-history", authenticateToken, roleHistoryRoutes);
router.use("/alumni", authenticateToken, alumniRoutes);
router.use("/administration", authenticateToken, administrationRoutes);
router.use("/projects", authenticateToken, projectsRoutes);
router.use("/tasks", authenticateToken, tasksRoutes);
router.use("/phases", authenticateToken, phasesRoutes);
router.use("/schedule-slots", authenticateToken, scheduleSlotsRoutes);
router.use("/project-files", authenticateToken, projectFilesRoutes);

router.get("/", (_req: Request, res: Response) => {
    res.json({
        message: "iClub Management API",
        version: "1.0.0",
        endpoints: {
            auth: "/api/auth",
            members: "/api/members",
            teams: "/api/teams",
            teamRoles: "/api/team-roles",
            teamSubteams: "/api/team-subteams",
            teamMembers: "/api/team-members",
            roleHistory: "/api/role-history",
            alumni: "/api/alumni",
            administration: "/api/administration",
            projects: "/api/projects",
            tasks: "/api/tasks",
            phases: "/api/phases",
            scheduleSlots: "/api/schedule-slots",
            projectFiles: "/api/project-files",
        },
    });
});

export default router;
