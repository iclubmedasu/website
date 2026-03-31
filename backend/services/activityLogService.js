const { prisma } = require('../db');

function serializeActivityValue(value) {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function collectChangedFields(previous = {}, next = {}, fieldLabels = {}) {
    const changes = [];
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

function summarizeChanges(changes = []) {
    if (!changes.length) return null;
    return `Updated ${changes.map((change) => change.label).join(', ')}`;
}

function changesToPayload(changes = []) {
    const oldValue = {};
    const newValue = {};

    for (const change of changes) {
        oldValue[change.key] = change.oldValue;
        newValue[change.key] = change.newValue;
    }

    return { oldValue, newValue };
}

async function logTaskActivity({ taskId, memberId, actionType, oldValue = null, newValue = null, description = null }) {
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
    entityType = 'PROJECT',
    taskId = null,
    phaseId = null,
}) {
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

async function resolveProjectIdFromTask(taskId) {
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
    entityType = 'TASK',
    phaseId = null,
}) {
    const resolvedProjectId = projectId ?? (taskId ? await resolveProjectIdFromTask(taskId) : null);

    const writes = [];

    if (taskId) {
        writes.push(logTaskActivity({ taskId, memberId, actionType, oldValue, newValue, description }));
    }

    if (resolvedProjectId) {
        writes.push(logProjectActivity({
            projectId: resolvedProjectId,
            taskId,
            phaseId,
            memberId,
            actionType,
            oldValue,
            newValue,
            description,
            entityType,
        }));
    }

    await Promise.all(writes);
}

module.exports = {
    serializeActivityValue,
    collectChangedFields,
    summarizeChanges,
    changesToPayload,
    logTaskActivity,
    logProjectActivity,
    logTaskAndProjectActivity,
};