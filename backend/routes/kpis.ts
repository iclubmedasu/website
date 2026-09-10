import express, { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { isPrivilegedUser } from "../lib/eventPermissions";

const router = express.Router();

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

router.use((req: Request, res: Response, next: NextFunction) => {
    if (!isPrivilegedUser(req.user)) {
        return res.status(403).json({ error: "KPI access required" });
    }
    return next();
});

function parseDateOnlyStart(value: string): Date | null {
    if (!DATE_ONLY.test(value)) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function parseDateOnlyEnd(value: string): Date | null {
    if (!DATE_ONLY.test(value)) return null;
    const d = new Date(`${value}T23:59:59.999Z`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.toISOString().slice(0, 10) !== value) return null;
    return d;
}

function resolveDateRange(query: Request["query"]):
    | { ok: true; start: Date; end: Date }
    | { ok: false; status: number; error: string } {
    const startRaw = typeof query.startDate === "string" ? query.startDate.trim() : "";
    const endRaw = typeof query.endDate === "string" ? query.endDate.trim() : "";

    if (!startRaw || !endRaw) {
        return { ok: false, status: 400, error: "Both startDate and endDate (YYYY-MM-DD) are required" };
    }

    const start = parseDateOnlyStart(startRaw);
    const end = parseDateOnlyEnd(endRaw);
    if (!start || !end) {
        return { ok: false, status: 400, error: "startDate and endDate must be valid YYYY-MM-DD dates" };
    }
    if (start.getTime() > end.getTime()) {
        return { ok: false, status: 400, error: "startDate must be on or before endDate" };
    }

    return { ok: true, start, end };
}

type ProjectMetrics = {
    assignedCount: number;
    completedCount: number;
    overdueCount: number;
    completionRate: number;
    avgCompletionDays: number | null;
};

type EventMetrics = {
    assignedCount: number;
};

type MemberBucket = {
    memberId: number;
    fullName: string;
    profilePhotoUrl: string | null;
    projectTasks: ProjectMetrics & {
        tasks: Array<{
            assignmentId: number;
            taskId: number;
            title: string;
            status: string;
            dueDate: string | null;
            completedDate: string | null;
            assignedDate: string;
            project: { id: number; title: string };
        }>;
        completionDaySum: number;
        completionDaySamples: number;
    };
    eventTasks: EventMetrics & {
        tasks: Array<{
            assignmentId: number;
            eventTaskId: number;
            title: string;
            taskDate: string;
            startDateTime: string;
            endDateTime: string;
            event: { id: number; title: string };
        }>;
    };
};

function emptyProjectMetrics(): MemberBucket["projectTasks"] {
    return {
        assignedCount: 0,
        completedCount: 0,
        overdueCount: 0,
        completionRate: 0,
        avgCompletionDays: null,
        tasks: [],
        completionDaySum: 0,
        completionDaySamples: 0,
    };
}

function emptyEventMetrics(): MemberBucket["eventTasks"] {
    return {
        assignedCount: 0,
        tasks: [],
    };
}

function finalizeProjectMetrics(bucket: MemberBucket["projectTasks"]): ProjectMetrics {
    const completionRate = bucket.assignedCount === 0
        ? 0
        : bucket.completedCount / bucket.assignedCount;
    const avgCompletionDays = bucket.completionDaySamples === 0
        ? null
        : bucket.completionDaySum / bucket.completionDaySamples;

    return {
        assignedCount: bucket.assignedCount,
        completedCount: bucket.completedCount,
        overdueCount: bucket.overdueCount,
        completionRate,
        avgCompletionDays,
    };
}

function getOrCreateBucket(
    map: Map<number, MemberBucket>,
    member: { id: number; fullName: string; profilePhotoUrl: string | null },
): MemberBucket {
    let bucket = map.get(member.id);
    if (!bucket) {
        bucket = {
            memberId: member.id,
            fullName: member.fullName,
            profilePhotoUrl: member.profilePhotoUrl,
            projectTasks: emptyProjectMetrics(),
            eventTasks: emptyEventMetrics(),
        };
        map.set(member.id, bucket);
    }
    return bucket;
}

async function loadAssignmentsInRange(start: Date, end: Date, memberId?: number) {
    const memberFilter = memberId != null
        ? { id: memberId, isActive: true as const }
        : { isActive: true as const };

    const [projectAssignments, eventAssignments] = await Promise.all([
        prisma.taskAssignment.findMany({
            where: {
                assignedDate: { gte: start, lte: end },
                ...(memberId != null ? { memberId } : {}),
                member: memberFilter,
                task: {
                    isActive: true,
                    project: { isActive: true },
                },
            },
            select: {
                id: true,
                memberId: true,
                status: true,
                assignedDate: true,
                completedDate: true,
                member: {
                    select: {
                        id: true,
                        fullName: true,
                        profilePhotoUrl: true,
                    },
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                        dueDate: true,
                        project: {
                            select: { id: true, title: true },
                        },
                    },
                },
            },
        }),
        prisma.eventTaskAssignment.findMany({
            where: {
                startDateTime: { gte: start, lte: end },
                ...(memberId != null ? { memberId } : {}),
                member: memberFilter,
                eventTask: {
                    isActive: true,
                    event: { isActive: true },
                },
            },
            select: {
                id: true,
                memberId: true,
                startDateTime: true,
                endDateTime: true,
                member: {
                    select: {
                        id: true,
                        fullName: true,
                        profilePhotoUrl: true,
                    },
                },
                eventTask: {
                    select: {
                        id: true,
                        title: true,
                        taskDate: true,
                        event: {
                            select: { id: true, title: true },
                        },
                    },
                },
            },
        }),
    ]);

    return { projectAssignments, eventAssignments };
}

function aggregateBuckets(
    projectAssignments: Awaited<ReturnType<typeof loadAssignmentsInRange>>["projectAssignments"],
    eventAssignments: Awaited<ReturnType<typeof loadAssignmentsInRange>>["eventAssignments"],
    options: { includeTaskLists: boolean },
): Map<number, MemberBucket> {
    const now = new Date();
    const map = new Map<number, MemberBucket>();

    for (const row of projectAssignments) {
        const bucket = getOrCreateBucket(map, row.member);
        const project = bucket.projectTasks;
        project.assignedCount += 1;

        const isCompleted = row.status === "COMPLETED";
        if (isCompleted) {
            project.completedCount += 1;
            if (row.completedDate) {
                const days = (row.completedDate.getTime() - row.assignedDate.getTime()) / DAY_MS;
                project.completionDaySum += days;
                project.completionDaySamples += 1;
            }
        } else if (row.task.dueDate && row.task.dueDate.getTime() < now.getTime()) {
            project.overdueCount += 1;
        }

        if (options.includeTaskLists) {
            project.tasks.push({
                assignmentId: row.id,
                taskId: row.task.id,
                title: row.task.title,
                status: row.status,
                dueDate: row.task.dueDate ? row.task.dueDate.toISOString() : null,
                completedDate: row.completedDate ? row.completedDate.toISOString() : null,
                assignedDate: row.assignedDate.toISOString(),
                project: {
                    id: row.task.project.id,
                    title: row.task.project.title,
                },
            });
        }
    }

    for (const row of eventAssignments) {
        const bucket = getOrCreateBucket(map, row.member);
        bucket.eventTasks.assignedCount += 1;

        if (options.includeTaskLists) {
            bucket.eventTasks.tasks.push({
                assignmentId: row.id,
                eventTaskId: row.eventTask.id,
                title: row.eventTask.title,
                taskDate: row.eventTask.taskDate.toISOString(),
                startDateTime: row.startDateTime.toISOString(),
                endDateTime: row.endDateTime.toISOString(),
                event: {
                    id: row.eventTask.event.id,
                    title: row.eventTask.event.title,
                },
            });
        }
    }

    return map;
}

function buildSummary(employees: Array<{ projectTasks: ProjectMetrics; eventTasks: EventMetrics }>) {
    let totalProjectTasksAssigned = 0;
    let totalProjectTasksCompleted = 0;
    let totalEventTaskAssignments = 0;

    for (const employee of employees) {
        totalProjectTasksAssigned += employee.projectTasks.assignedCount;
        totalProjectTasksCompleted += employee.projectTasks.completedCount;
        totalEventTaskAssignments += employee.eventTasks.assignedCount;
    }

    return {
        totalMembers: employees.length,
        totalProjectTasksAssigned,
        totalProjectTasksCompleted,
        totalEventTaskAssignments,
    };
}

/**
 * GET /api/kpis/employees
 * Privileged KPI list for members with ≥1 project/event assignment in range.
 * Query: startDate, endDate (YYYY-MM-DD).
 */
router.get("/employees", async (req: Request, res: Response) => {
    try {
        const range = resolveDateRange(req.query);
        if (!range.ok) {
            return res.status(range.status).json({ error: range.error });
        }

        const { projectAssignments, eventAssignments } = await loadAssignmentsInRange(range.start, range.end);
        const buckets = aggregateBuckets(projectAssignments, eventAssignments, { includeTaskLists: false });

        const employees = Array.from(buckets.values()).map((bucket) => ({
            memberId: bucket.memberId,
            fullName: bucket.fullName,
            profilePhotoUrl: bucket.profilePhotoUrl,
            projectTasks: finalizeProjectMetrics(bucket.projectTasks),
            eventTasks: { assignedCount: bucket.eventTasks.assignedCount },
        }));

        employees.sort((a, b) => {
            const assignedDiff = b.projectTasks.assignedCount - a.projectTasks.assignedCount;
            if (assignedDiff !== 0) return assignedDiff;
            return a.fullName.localeCompare(b.fullName);
        });

        return res.json({
            summary: buildSummary(employees),
            employees,
        });
    } catch (error) {
        console.error("GET /kpis/employees error:", error);
        return res.status(500).json({ error: "Failed to load employee KPIs" });
    }
});

/**
 * GET /api/kpis/employees/:memberId
 * Privileged per-member KPI detail for the given range.
 * Query: startDate, endDate (YYYY-MM-DD).
 */
router.get("/employees/:memberId", async (req: Request, res: Response) => {
    try {
        const memberId = parseInt(String(req.params.memberId), 10);
        if (Number.isNaN(memberId)) {
            return res.status(400).json({ error: "Invalid member id" });
        }

        const range = resolveDateRange(req.query);
        if (!range.ok) {
            return res.status(range.status).json({ error: range.error });
        }

        const member = await prisma.member.findFirst({
            where: { id: memberId, isActive: true },
            select: {
                id: true,
                fullName: true,
                profilePhotoUrl: true,
            },
        });

        if (!member) {
            return res.status(404).json({ error: "Member not found" });
        }

        const { projectAssignments, eventAssignments } = await loadAssignmentsInRange(
            range.start,
            range.end,
            memberId,
        );
        const buckets = aggregateBuckets(projectAssignments, eventAssignments, { includeTaskLists: true });
        const bucket = buckets.get(memberId) ?? {
            memberId: member.id,
            fullName: member.fullName,
            profilePhotoUrl: member.profilePhotoUrl,
            projectTasks: emptyProjectMetrics(),
            eventTasks: emptyEventMetrics(),
        };

        const projectMetrics = finalizeProjectMetrics(bucket.projectTasks);

        return res.json({
            memberId: member.id,
            fullName: member.fullName,
            profilePhotoUrl: member.profilePhotoUrl,
            projectTasks: {
                ...projectMetrics,
                tasks: bucket.projectTasks.tasks,
            },
            eventTasks: {
                assignedCount: bucket.eventTasks.assignedCount,
                tasks: bucket.eventTasks.tasks,
            },
        });
    } catch (error) {
        console.error("GET /kpis/employees/:memberId error:", error);
        return res.status(500).json({ error: "Failed to load employee KPI detail" });
    }
});

export default router;
