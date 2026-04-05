import { prisma } from "../db";

type ChangeRecord = Record<string, unknown>;

interface ActivityChange {
    key: string;
    label: string;
    oldValue: unknown | null;
    newValue: unknown | null;
}

interface TaskActivityInput {
    taskId: number;
    memberId: number;
    actionType: string;
    oldValue?: unknown;
    newValue?: unknown;
    description?: string | null;
}

interface ProjectActivityInput {
    projectId: number;
    memberId: number;
    actionType: string;
    oldValue?: unknown;
    newValue?: unknown;
    description?: string | null;
    entityType?: string;
    taskId?: number | null;
    phaseId?: number | null;
}

interface TaskAndProjectActivityInput {
    taskId?: number | null;
    projectId?: number | null;
    memberId: number;
    actionType: string;
    oldValue?: unknown;
    newValue?: unknown;
    description?: string | null;
    entityType?: string;
    phaseId?: number | null;
}

function serializeActivityValue(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function collectChangedFields(
    previous: ChangeRecord = {},
    next: ChangeRecord = {},
    fieldLabels: Record<string, string> = {},
): ActivityChange[] {
    const changes: ActivityChange[] = [];
    for (const key of Object.keys(fieldLabels)) {
        const oldSerialized = serializeActivityValue(previous[key]);
        const newSerialized = serializeActivityValue(next[key]);
        if (oldSerialized !== newSerialized) {
            changes.push({
                key,
                label: fieldLabels[key] || key,
                oldValue: previous[key] ?? null,
                newValue: next[key] ?? null,
            });
        }
    }
    return changes;
}

function summarizeChanges(changes: ActivityChange[] = []): string | null {
    if (!changes.length) return null;
    return `Updated ${changes.map((change) => change.label).join(", ")}`;
}

function changesToPayload(changes: ActivityChange[] = []): {
    oldValue: ChangeRecord;
    newValue: ChangeRecord;
} {
    const oldValue: ChangeRecord = {};
    const newValue: ChangeRecord = {};

    for (const change of changes) {
        oldValue[change.key] = change.oldValue;
        newValue[change.key] = change.newValue;
    }

    return { oldValue, newValue };
}

async function logTaskActivity({
    taskId,
    memberId,
    actionType,
    oldValue = null,
    newValue = null,
    description = null,
}: TaskActivityInput): Promise<void> {
    await prisma.taskActivityLog.create({
        data: {
            taskId,
            memberId,
            actionType,
            oldValue: serializeActivityValue(oldValue),
            newValue: serializeActivityValue(newValue),
            description,
        },
    });
}

async function logProjectActivity({
    projectId,
    memberId,
    actionType,
    oldValue = null,
    newValue = null,
    description = null,
    entityType = "PROJECT",
    taskId = null,
    phaseId = null,
}: ProjectActivityInput): Promise<void> {
    await prisma.projectActivityLog.create({
        data: {
            projectId,
            taskId,
            phaseId,
            memberId,
            entityType,
            actionType,
            oldValue: serializeActivityValue(oldValue),
            newValue: serializeActivityValue(newValue),
            description,
        },
    });
}

async function resolveProjectIdFromTask(taskId: number | null | undefined): Promise<number | null> {
    if (!taskId) return null;
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
    });
    return task?.projectId ?? null;
}

async function logTaskAndProjectActivity({
    taskId,
    projectId,
    memberId,
    actionType,
    oldValue = null,
    newValue = null,
    description = null,
    entityType = "TASK",
    phaseId = null,
}: TaskAndProjectActivityInput): Promise<void> {
    const resolvedProjectId = projectId ?? (taskId ? await resolveProjectIdFromTask(taskId) : null);
    const writes: Array<Promise<void>> = [];

    if (taskId) {
        writes.push(logTaskActivity({ taskId, memberId, actionType, oldValue, newValue, description }));
    }

    if (resolvedProjectId) {
        writes.push(
            logProjectActivity({
                projectId: resolvedProjectId,
                taskId,
                phaseId,
                memberId,
                actionType,
                oldValue,
                newValue,
                description,
                entityType,
            }),
        );
    }

    await Promise.all(writes);
}

export {
    serializeActivityValue,
    collectChangedFields,
    summarizeChanges,
    changesToPayload,
    logTaskActivity,
    logProjectActivity,
    logTaskAndProjectActivity,
};