const { prisma } = require('../db');

/**
 * Recompute and persist WBS (Work Breakdown Structure) codes for an entire project.
 *
 * WBS codes follow the pattern:
 *   Phase   → "1", "2", "3"
 *   Task    → "1.1", "1.2", "2.1"
 *   Subtask → "1.1.1", "1.1.2", "2.1.1"
 *
 * The ordering is determined by the `order` field (ASC), with `createdAt` as tiebreaker.
 *
 * @param {number} projectId — The project whose WBS codes should be recomputed.
 */
async function recomputeProjectWbs(projectId) {
    // 1. Fetch all active phases, ordered
    const phases = await prisma.projectPhase.findMany({
        where: { projectId, isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, wbs: true },
    });

    const updates = []; // { model, id, wbs }

    for (let pi = 0; pi < phases.length; pi++) {
        const phaseWbs = String(pi + 1);
        updates.push({ model: 'phase', id: phases[pi].id, wbs: phaseWbs });

        // 2. Fetch top-level tasks for this phase, ordered
        const tasks = await prisma.task.findMany({
            where: { phaseId: phases[pi].id, parentTaskId: null, isActive: true },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, wbs: true },
        });

        for (let ti = 0; ti < tasks.length; ti++) {
            const taskWbs = `${phaseWbs}.${ti + 1}`;
            updates.push({ model: 'task', id: tasks[ti].id, wbs: taskWbs });

            // 3. Fetch subtasks, ordered
            const subtasks = await prisma.task.findMany({
                where: { parentTaskId: tasks[ti].id, isActive: true },
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, wbs: true },
            });

            for (let si = 0; si < subtasks.length; si++) {
                const subWbs = `${taskWbs}.${si + 1}`;
                updates.push({ model: 'task', id: subtasks[si].id, wbs: subWbs });
            }
        }
    }

    // 4. Also handle orphan tasks (no phase) — they get a flat numbering
    const orphanTasks = await prisma.task.findMany({
        where: { projectId, phaseId: null, parentTaskId: null, isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, wbs: true },
    });
    for (let oi = 0; oi < orphanTasks.length; oi++) {
        const oWbs = String(phases.length + oi + 1);
        updates.push({ model: 'task', id: orphanTasks[oi].id, wbs: oWbs });

        const orphanSubs = await prisma.task.findMany({
            where: { parentTaskId: orphanTasks[oi].id, isActive: true },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, wbs: true },
        });
        for (let si = 0; si < orphanSubs.length; si++) {
            updates.push({ model: 'task', id: orphanSubs[si].id, wbs: `${oWbs}.${si + 1}` });
        }
    }

    // 5. Batch-update only records whose WBS actually changed (minimise writes)
    const ops = [];
    for (const u of updates) {
        if (u.model === 'phase') {
            ops.push(prisma.projectPhase.update({ where: { id: u.id }, data: { wbs: u.wbs } }));
        } else {
            ops.push(prisma.task.update({ where: { id: u.id }, data: { wbs: u.wbs } }));
        }
    }

    if (ops.length > 0) {
        await prisma.$transaction(ops);
    }
}

module.exports = { recomputeProjectWbs };
