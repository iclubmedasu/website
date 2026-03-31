const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { recomputeProjectWbs } = require('../services/wbsService');
const {
    collectChangedFields,
    changesToPayload,
    logTaskAndProjectActivity,
    summarizeChanges,
} = require('../services/activityLogService');

const ADMINISTRATION_TEAM_NAME = 'Administration';

// Title-case utility for task titles
function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str;
    const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it']);
    const words = str.trim().split(/\s+/);
    return words.map((word, i) => {
        if (word.includes('-')) {
            return word.split('-').map(p => {
                if (p.length > 1 && p === p.toUpperCase()) return p;
                return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
            }).join('-');
        }
        if (word.length > 1 && word === word.toUpperCase()) return word;
        const lower = word.toLowerCase();
        if (i !== 0 && i !== words.length - 1 && SMALL.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getUserTeamIds(memberId) {
    const rows = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
}

async function isAdmin(req) {
    if (req.user.isDeveloper) return true;
    if (!req.user.memberId) return false;
    const adminMembership = await prisma.teamMember.findFirst({
        where: {
            memberId: req.user.memberId,
            isActive: true,
            team: { name: ADMINISTRATION_TEAM_NAME },
        },
    });
    return adminMembership !== null;
}

/**
 * Is the user a privileged role (developer, officer, administration, leadership)?
 */
function isPrivilegedUser(req) {
    return !!(req.user.isDeveloper || req.user.isOfficer || req.user.isAdmin || req.user.isLeadership);
}

/**
 * Is the user privileged OR has a special role?
 * Privileged + special roles can add/remove/edit phases/tasks/subtasks.
 */
function isPrivilegedOrSpecialUser(req) {
    return isPrivilegedUser(req) || !!req.user.isSpecial;
}

/**
 * Can the requesting user fully edit a task (create, update fields, delete, assign, etc.)?
 * Only privileged + special roles.
 */
function canUserEditTask(req) {
    if (!req.user.memberId) return false;
    return isPrivilegedOrSpecialUser(req);
}

/**
 * Can the requesting user change a task's status?
 * Privileged + special roles can always change status.
 * Regular members can only change status if they are assigned to the task.
 */
async function canUserEditTaskStatus(req, taskId) {
    if (!req.user.memberId) return false;
    if (isPrivilegedOrSpecialUser(req)) return true;

    // Check if the user is assigned to this specific task
    const assignment = await prisma.taskAssignment.findFirst({
        where: { taskId, memberId: req.user.memberId },
    });
    return assignment !== null;
}

/**
 * Auto-sync parent task status based on subtask states.
 * - All subtasks COMPLETED â†’ parent becomes COMPLETED
 * - Otherwise if parent was COMPLETED â†’ parent becomes IN_PROGRESS
 */
async function syncParentTaskStatus(taskId, memberId) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { parentTaskId: true },
    });
    if (!task?.parentTaskId) return;

    const siblings = await prisma.task.findMany({
        where: { parentTaskId: task.parentTaskId, isActive: true },
        select: { status: true },
    });
    if (siblings.length === 0) return;

    const allCompleted = siblings.every((s) => s.status === 'COMPLETED');
    const parent = await prisma.task.findUnique({
        where: { id: task.parentTaskId },
        select: { status: true },
    });
    if (!parent) return;

    let newStatus = null;
    if (allCompleted && parent.status !== 'COMPLETED') {
        newStatus = 'COMPLETED';
    } else if (!allCompleted && parent.status === 'COMPLETED') {
        newStatus = 'IN_PROGRESS';
    }

    if (newStatus) {
        const data = { status: newStatus };
        if (newStatus === 'COMPLETED') data.completedDate = new Date();
        await prisma.task.update({ where: { id: task.parentTaskId }, data });
        if (memberId) {
            await logActivity(task.parentTaskId, memberId, 'STATUS_CHANGED', {
                oldValue: parent.status,
                newValue: newStatus,
                description: `Status auto-changed from ${parent.status} to ${newStatus} based on subtasks`,
            });
        }
    }
}

/**
 * Log a task activity event in the TaskActivityLog.
 */
async function logActivity(taskId, memberId, actionType, { oldValue, newValue, description, projectId, entityType } = {}) {
    const task = entityType ? null : await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true, parentTaskId: true },
    });

    await logTaskAndProjectActivity({
        taskId,
        projectId: projectId ?? task?.projectId,
        memberId,
        actionType,
        oldValue,
        newValue,
        description,
        entityType: entityType ?? (task?.parentTaskId ? 'SUBTASK' : 'TASK'),
    });
}

// ============================================
// GET /api/tasks  â€“  list tasks (filters)
// Query: projectId, memberId (assigned), status, priority, overdue, parentTaskId
// ============================================
router.get('/', async (req, res) => {
    try {
        const {
            projectId,
            memberId,
            status,
            priority,
            overdue,
            topLevelOnly,
        } = req.query;

        const where = { isActive: true };

        if (projectId) where.projectId = parseInt(projectId);
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (topLevelOnly === 'true') where.parentTaskId = null;

        if (memberId) {
            where.assignments = {
                some: {
                    memberId: parseInt(memberId),
                    status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
                },
            };
        }

        if (overdue === 'true') {
            where.dueDate = { lt: new Date() };
            where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
        }

        // Non-admins: must have project access
        const admin = await isAdmin(req);
        if (!admin && req.user.memberId && !projectId) {
            const myTeamIds = await getUserTeamIds(req.user.memberId);
            where.project = {
                projectTeams: { some: { teamId: { in: myTeamIds } } },
            };
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                project: { select: { id: true, title: true } },
                assignments: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    },
                },
                taskTeams: {
                    include: { team: { select: { id: true, name: true } } },
                },
                tags: true,
                _count: { select: { subtasks: { where: { isActive: true } } } },
            },
            orderBy: [{ order: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
        });

        res.json(tasks);
    } catch (error) {
        console.error('GET /tasks', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// ============================================
// GET /api/tasks/:id  â€“  single task (full detail + subtasks + comments)
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid task ID' });

        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, title: true } },
                parentTask: { select: { id: true, title: true } },
                phase: { select: { id: true, title: true } },
                subtasks: {
                    where: { isActive: true },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                    include: {
                        subtasks: { where: { isActive: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
                        assignments: {
                            include: {
                                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                            },
                        },
                        taskTeams: {
                            include: { team: { select: { id: true, name: true } } },
                        },
                        tags: true,
                    },
                },
                taskTeams: {
                    include: { team: { select: { id: true, name: true } } },
                },
                assignments: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    },
                },
                comments: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                activityLog: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                tags: true,
                dependencies: {
                    include: {
                        dependsOnTask: { select: { id: true, title: true, status: true } },
                    },
                },
                dependsOn: {
                    include: {
                        task: { select: { id: true, title: true, status: true } },
                    },
                },
                scheduleSlots: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                        createdBy: { select: { id: true, fullName: true } },
                    },
                    orderBy: { startDateTime: 'asc' },
                },
            },
        });

        if (!task || !task.isActive) return res.status(404).json({ error: 'Task not found' });

        const canEdit = canUserEditTask(req);
        res.json({ ...task, canEdit });
    } catch (error) {
        console.error('GET /tasks/:id', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// ============================================
// POST /api/tasks  â€“  create task (or subtask)
// Body: { projectId, parentTaskId?, title, description, type, priority, status,
//          startDate, dueDate, estimatedHours, teamIds, assigneeIds }
// ============================================
router.post('/', async (req, res) => {
    try {
        const {
            projectId,
            parentTaskId = null,
            phaseId = null,
            title,
            description,
            type = 'General',
            priority = 'MEDIUM',
            status = 'NOT_STARTED',
            difficulty = 'MEDIUM',
            startDate,
            dueDate,
            estimatedHours,
            teamIds = [],
            assigneeIds = [],
        } = req.body;

        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
        if (!req.user.memberId) return res.status(400).json({ error: 'memberId required' });

        // Only privileged + special roles can create tasks
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Only privileged and special roles can create tasks' });
        }

        // Auto-assign next order value among siblings
        const siblingWhere = { isActive: true, projectId: parseInt(projectId) };
        if (parentTaskId) {
            siblingWhere.parentTaskId = parseInt(parentTaskId);
        } else {
            siblingWhere.parentTaskId = null;
            if (phaseId) siblingWhere.phaseId = parseInt(phaseId);
        }
        const lastSibling = await prisma.task.findFirst({
            where: siblingWhere,
            orderBy: { order: 'desc' },
            select: { order: true },
        });
        const nextOrder = (lastSibling?.order ?? -1) + 1;

        const task = await prisma.task.create({
            data: {
                projectId: parseInt(projectId),
                parentTaskId: parentTaskId ? parseInt(parentTaskId) : null,
                phaseId: phaseId ? parseInt(phaseId) : null,
                order: nextOrder,
                title: toTitleCase(title.trim()),
                description: description?.trim() || null,
                type,
                priority,
                status,
                difficulty,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
                taskTeams: {
                    create: teamIds.map((tid) => ({
                        teamId: parseInt(tid),
                        canEdit: true,
                    })),
                },
                assignments: {
                    create: assigneeIds.map((mid) => ({
                        memberId: parseInt(mid),
                        isSelfAssigned: false,
                        assignedBy: req.user.memberId,
                        status: 'ASSIGNED',
                    })),
                },
            },
            include: {
                project: { select: { id: true, title: true } },
                taskTeams: { include: { team: { select: { id: true, name: true } } } },
                assignments: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    },
                },
                tags: true,
            },
        });

        // Log creation
        await logActivity(task.id, req.user.memberId, 'CREATED', {
            description: `Task "${task.title}" created`,
        });

        // If this is a subtask, sync parent status (new subtask â†’ parent can't stay COMPLETED)
        if (parentTaskId) {
            await syncParentTaskStatus(task.id, req.user.memberId);
        }

        res.status(201).json(task);
    } catch (error) {
        console.error('POST /tasks', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// ============================================
// PUT /api/tasks/:id  â€“  update task
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid task ID' });
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const before = await prisma.task.findUnique({
            where: { id },
            select: {
                title: true,
                description: true,
                type: true,
                priority: true,
                status: true,
                difficulty: true,
                phaseId: true,
                parentTaskId: true,
                order: true,
                startDate: true,
                dueDate: true,
                completedDate: true,
                estimatedHours: true,
                actualHours: true,
                assignments: { select: { memberId: true } },
            },
        });

        const normalizedBefore = {
            ...before,
            assigneeIds: (before?.assignments || []).map((assignment) => assignment.memberId).sort((a, b) => a - b),
        };

        const {
            title,
            description,
            type,
            priority,
            status,
            difficulty,
            startDate,
            dueDate,
            completedDate,
            estimatedHours,
            actualHours,
            assigneeIds,
        } = req.body;

        const data = {};
        if (title !== undefined) data.title = toTitleCase(title.trim());
        if (description !== undefined) data.description = description?.trim() || null;
        if (type !== undefined) data.type = type;
        if (priority !== undefined) data.priority = priority;
        if (difficulty !== undefined) data.difficulty = difficulty;
        if (req.body.phaseId !== undefined) data.phaseId = req.body.phaseId ? parseInt(req.body.phaseId) : null;
        if (req.body.parentTaskId !== undefined) data.parentTaskId = req.body.parentTaskId ? parseInt(req.body.parentTaskId) : null;
        if (req.body.order !== undefined) data.order = parseInt(req.body.order);
        if (status !== undefined) {
            data.status = status;
            if (status === 'COMPLETED') {
                data.completedDate = completedDate ? new Date(completedDate) : new Date();
            } else {
                data.completedDate = null;
            }
        }
        if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
        if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
        if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null;
        if (estimatedHours !== undefined) data.estimatedHours = estimatedHours !== '' && estimatedHours !== null ? parseFloat(estimatedHours) : null;
        if (actualHours !== undefined) data.actualHours = actualHours !== '' && actualHours !== null ? parseFloat(actualHours) : null;

        if (assigneeIds !== undefined) {
            await prisma.taskAssignment.deleteMany({ where: { taskId: id } });
            if (assigneeIds.length > 0) {
                await prisma.taskAssignment.createMany({
                    data: assigneeIds.map((mid) => ({
                        taskId: id,
                        memberId: parseInt(mid),
                        isSelfAssigned: false,
                        assignedBy: req.user.memberId,
                        status: 'ASSIGNED',
                    })),
                });
            }
        }

        const task = await prisma.task.update({
            where: { id },
            data,
            include: {
                project: { select: { id: true, title: true } },
                taskTeams: { include: { team: { select: { id: true, name: true } } } },
                assignments: {
                    include: {
                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    },
                },
                tags: true,
            },
        });

        const after = {
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
            status: task.status,
            difficulty: task.difficulty,
            phaseId: task.phaseId,
            parentTaskId: task.parentTaskId,
            order: task.order,
            startDate: task.startDate,
            dueDate: task.dueDate,
            completedDate: task.completedDate,
            estimatedHours: task.estimatedHours,
            actualHours: task.actualHours,
            assigneeIds: (task.assignments || []).map((assignment) => assignment.memberId).sort((a, b) => a - b),
        };

        const changes = collectChangedFields(normalizedBefore || {}, after, {
            title: 'title',
            description: 'description',
            type: 'type',
            priority: 'priority',
            status: 'status',
            difficulty: 'difficulty',
            phaseId: 'phase',
            parentTaskId: 'parent task',
            order: 'order',
            startDate: 'start date',
            dueDate: 'due date',
            completedDate: 'completed date',
            estimatedHours: 'estimated hours',
            actualHours: 'actual hours',
            assigneeIds: 'assignees',
        });

        if (changes.length > 0) {
            const { oldValue, newValue } = changesToPayload(changes);
            await logActivity(id, req.user.memberId, 'UPDATED', {
                oldValue,
                newValue,
                description: summarizeChanges(changes) || `Task "${task.title}" updated`,
            });
        }

        // Sync parent task status if this is a subtask
        await syncParentTaskStatus(id, req.user.memberId);

        // Recompute WBS codes for the project
        await recomputeProjectWbs(task.project.id);

        res.json(task);
    } catch (error) {
        console.error('PUT /tasks/:id', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// ============================================
// PATCH /api/tasks/:id/status  â€“  quick status update
// Body: { status }
// ============================================
router.patch('/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!(await canUserEditTaskStatus(req, id))) {
            return res.status(403).json({ error: 'Only assigned members and privileged roles can change task status' });
        }

        const { status } = req.body;
        const VALID_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED', 'ON_HOLD', 'CANCELLED'];
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        }

        const old = await prisma.task.findUnique({ where: { id }, select: { status: true } });
        const data = { status };
        if (status === 'COMPLETED') data.completedDate = new Date();
        else data.completedDate = null;

        const task = await prisma.task.update({ where: { id }, data });

        await logActivity(id, req.user.memberId, 'STATUS_CHANGED', {
            oldValue: old?.status,
            newValue: status,
            description: `Status changed from ${old?.status} to ${status}`,
        });

        // Sync parent task status if this is a subtask
        await syncParentTaskStatus(id, req.user.memberId);

        res.json(task);
    } catch (error) {
        console.error('PATCH /tasks/:id/status', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ============================================
// DELETE /api/tasks/:id  â€“  hard-delete (cascades to subtasks, assignments, comments, tags, deps, logs)
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }
        // Fetch task details before deleting so the project timeline keeps the removal event.
        const taskToDelete = await prisma.task.findUnique({
            where: { id },
            select: { projectId: true, title: true, parentTaskId: true },
        });
        if (!taskToDelete) return res.status(404).json({ error: 'Task not found' });

        await logActivity(id, req.user.memberId, 'DELETED', {
            projectId: taskToDelete.projectId,
            entityType: taskToDelete.parentTaskId ? 'SUBTASK' : 'TASK',
            description: `${taskToDelete.parentTaskId ? 'Subtask' : 'Task'} "${taskToDelete.title}" deleted`,
        });

        await prisma.task.delete({ where: { id } });

        // Recompute WBS codes for the project
        if (taskToDelete) await recomputeProjectWbs(taskToDelete.projectId);

        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('DELETE /tasks/:id', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ============================================// POST /api/tasks/:id/duplicate  –  deep-copy task (and its subtasks)
// Body: { phaseId?, parentTaskId?, insertAfterOrder? }
// ============================================
router.post('/:id/duplicate', async (req, res) => {
    try {
        const sourceId = parseInt(req.params.id);
        if (isNaN(sourceId)) return res.status(400).json({ error: 'Invalid task ID' });
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const source = await prisma.task.findUnique({
            where: { id: sourceId },
            include: {
                subtasks: true,
                taskTeams: true,
            },
        });
        if (!source) return res.status(404).json({ error: 'Task not found' });

        const { phaseId, parentTaskId } = req.body;
        const targetPhaseId = phaseId !== undefined ? (phaseId ? parseInt(phaseId) : null) : source.phaseId;
        const targetParentId = parentTaskId !== undefined ? (parentTaskId ? parseInt(parentTaskId) : null) : source.parentTaskId;

        // Auto-assign next order value among target siblings
        const dupSiblingWhere = { isActive: true, projectId: source.projectId };
        if (targetParentId) {
            dupSiblingWhere.parentTaskId = targetParentId;
        } else {
            dupSiblingWhere.parentTaskId = null;
            if (targetPhaseId) dupSiblingWhere.phaseId = targetPhaseId;
        }
        const dupLastSibling = await prisma.task.findFirst({
            where: dupSiblingWhere,
            orderBy: { order: 'desc' },
            select: { order: true },
        });
        const dupNextOrder = (dupLastSibling?.order ?? -1) + 1;

        const newTask = await prisma.task.create({
            data: {
                projectId: source.projectId,
                parentTaskId: targetParentId,
                phaseId: targetPhaseId,
                order: dupNextOrder,
                title: source.title + ' (Copy)',
                description: source.description,
                type: source.type,
                status: 'NOT_STARTED',
                difficulty: source.difficulty,
                priority: source.priority,
                startDate: source.startDate,
                dueDate: source.dueDate,
                estimatedHours: source.estimatedHours,
            },
        });

        // Copy subtasks
        for (const sub of source.subtasks) {
            const copiedSubtask = await prisma.task.create({
                data: {
                    projectId: sub.projectId,
                    parentTaskId: newTask.id,
                    phaseId: targetPhaseId,
                    title: sub.title,
                    description: sub.description,
                    type: sub.type,
                    status: 'NOT_STARTED',
                    difficulty: sub.difficulty,
                    priority: sub.priority,
                    startDate: sub.startDate,
                    dueDate: sub.dueDate,
                    estimatedHours: sub.estimatedHours,
                },
            });

            await logActivity(copiedSubtask.id, req.user.memberId, 'CREATED', {
                description: `Subtask "${copiedSubtask.title}" duplicated from task #${sourceId}`,
            });
        }

        // Copy team assignments
        for (const tt of source.taskTeams) {
            await prisma.taskTeam.create({
                data: {
                    taskId: newTask.id,
                    teamId: tt.teamId,
                    canEdit: tt.canEdit,
                },
            }).catch(() => { }); // ignore unique conflicts
        }

        await logActivity(newTask.id, req.user.memberId, 'CREATED', {
            description: `Task "${newTask.title}" duplicated from task #${sourceId}`,
        });

        // Recompute WBS codes for the project
        await recomputeProjectWbs(source.projectId);

        const result = await prisma.task.findUnique({
            where: { id: newTask.id },
            include: {
                subtasks: true,
                taskTeams: { include: { team: { select: { id: true, name: true } } } },
                assignments: { include: { member: { select: { id: true, fullName: true } } } },
            },
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('POST /tasks/:id/duplicate', error);
        res.status(500).json({ error: 'Failed to duplicate task' });
    }
});

// ============================================// POST /api/tasks/:id/teams  â€“  assign team to task
// Body: { teamId, canEdit }
// ============================================
router.post('/:id/teams', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { teamId, canEdit = true } = req.body;
        if (!teamId) return res.status(400).json({ error: 'teamId is required' });

        const tt = await prisma.taskTeam.upsert({
            where: { taskId_teamId: { taskId, teamId: parseInt(teamId) } },
            create: { taskId, teamId: parseInt(teamId), canEdit },
            update: { canEdit },
            include: { team: { select: { id: true, name: true } } },
        });

        res.status(201).json(tt);
    } catch (error) {
        console.error('POST /tasks/:id/teams', error);
        res.status(500).json({ error: 'Failed to add team to task' });
    }
});

// ============================================
// DELETE /api/tasks/:id/teams/:teamId  â€“  remove team from task
// ============================================
router.delete('/:id/teams/:teamId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        await prisma.taskTeam.delete({
            where: { taskId_teamId: { taskId, teamId } },
        });

        res.json({ message: 'Team removed from task' });
    } catch (error) {
        console.error('DELETE /tasks/:id/teams/:teamId', error);
        res.status(500).json({ error: 'Failed to remove team' });
    }
});

// ============================================
// POST /api/tasks/:id/assign  â€“  assign member to task (by another member/admin)
// Body: { memberId }
// ============================================
router.post('/:id/assign', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { memberId } = req.body;
        if (!memberId) return res.status(400).json({ error: 'memberId is required' });

        const assignment = await prisma.taskAssignment.upsert({
            where: { taskId_memberId: { taskId, memberId: parseInt(memberId) } },
            create: {
                taskId,
                memberId: parseInt(memberId),
                assignedBy: req.user.memberId,
                isSelfAssigned: false,
                status: 'ASSIGNED',
            },
            update: {
                assignedBy: req.user.memberId,
                isSelfAssigned: false,
                status: 'ASSIGNED',
            },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logActivity(taskId, req.user.memberId, 'ASSIGNED', {
            newValue: memberId,
            description: `Member ${memberId} assigned to task`,
        });

        res.status(201).json(assignment);
    } catch (error) {
        console.error('POST /tasks/:id/assign', error);
        res.status(500).json({ error: 'Failed to assign member' });
    }
});

// ============================================
// POST /api/tasks/:id/self-assign  â€“  member self-assigns
// ============================================
router.post('/:id/self-assign', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!req.user.memberId) return res.status(400).json({ error: 'memberId required' });

        const assignment = await prisma.taskAssignment.upsert({
            where: { taskId_memberId: { taskId, memberId: req.user.memberId } },
            create: {
                taskId,
                memberId: req.user.memberId,
                assignedBy: null,
                isSelfAssigned: true,
                status: 'ACCEPTED',
            },
            update: {
                isSelfAssigned: true,
                status: 'ACCEPTED',
            },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logActivity(taskId, req.user.memberId, 'SELF_ASSIGNED', {
            description: `Member ${req.user.memberId} self-assigned to task`,
        });

        res.status(201).json(assignment);
    } catch (error) {
        console.error('POST /tasks/:id/self-assign', error);
        res.status(500).json({ error: 'Failed to self-assign' });
    }
});

// ============================================
// PATCH /api/tasks/:id/assign/:memberId  â€“  update assignment status
// Body: { status }  (ASSIGNED | ACCEPTED | IN_PROGRESS | COMPLETED)
// ============================================
router.patch('/:id/assign/:memberId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        const { status } = req.body;

        // Only the assignee themselves (or an admin) can update it
        const isOwnAssignment = req.user.memberId === memberId;
        if (!isOwnAssignment && !canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const data = { status };
        if (status === 'ACCEPTED') data.acceptedDate = new Date();
        if (status === 'COMPLETED') data.completedDate = new Date();

        const assignment = await prisma.taskAssignment.update({
            where: { taskId_memberId: { taskId, memberId } },
            data,
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logActivity(taskId, req.user.memberId, 'ASSIGNMENT_STATUS_CHANGED', {
            oldValue: null,
            newValue: status,
            description: `Assignment for member ${memberId} changed to ${status}`,
        });

        res.json(assignment);
    } catch (error) {
        console.error('PATCH /tasks/:id/assign/:memberId', error);
        res.status(500).json({ error: 'Failed to update assignment' });
    }
});

// ============================================
// DELETE /api/tasks/:id/assign/:memberId  â€“  unassign member
// ============================================
router.delete('/:id/assign/:memberId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        await prisma.taskAssignment.delete({
            where: { taskId_memberId: { taskId, memberId } },
        });

        await logActivity(taskId, req.user.memberId, 'UNASSIGNED', {
            description: `Member ${memberId} unassigned from task`,
        });

        res.json({ message: 'Member unassigned' });
    } catch (error) {
        console.error('DELETE /tasks/:id/assign/:memberId', error);
        res.status(500).json({ error: 'Failed to unassign member' });
    }
});

// ============================================
// GET /api/tasks/:id/comments  â€“  get comments
// ============================================
router.get('/:id/comments', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const comments = await prisma.taskComment.findMany({
            where: { taskId },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(comments);
    } catch (error) {
        console.error('GET /tasks/:id/comments', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// ============================================
// POST /api/tasks/:id/comments  â€“  add comment
// Body: { comment }
// ============================================
router.post('/:id/comments', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!req.user.memberId) return res.status(400).json({ error: 'memberId required' });

        const { comment } = req.body;
        if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

        const newComment = await prisma.taskComment.create({
            data: {
                taskId,
                memberId: req.user.memberId,
                comment: comment.trim(),
            },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logActivity(taskId, req.user.memberId, 'COMMENTED', {
            description: `Comment added by member ${req.user.memberId}`,
        });

        res.status(201).json(newComment);
    } catch (error) {
        console.error('POST /tasks/:id/comments', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// ============================================
// PUT /api/tasks/:id/comments/:commentId  â€“  edit comment (own only)
// Body: { comment }
// ============================================
router.put('/:id/comments/:commentId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const commentId = parseInt(req.params.commentId);

        const existing = await prisma.taskComment.findUnique({ where: { id: commentId } });
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        // Only the author (or admin) can edit
        if (existing.memberId !== req.user.memberId && !(await isAdmin(req))) {
            return res.status(403).json({ error: 'Can only edit your own comments' });
        }

        const { comment } = req.body;
        if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

        const updated = await prisma.taskComment.update({
            where: { id: commentId },
            data: { comment: comment.trim(), isEdited: true },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logActivity(taskId, req.user.memberId, 'COMMENT_EDITED', {
            oldValue: existing.comment,
            newValue: comment.trim(),
            description: `Comment #${commentId} edited`,
        });

        res.json(updated);
    } catch (error) {
        console.error('PUT /tasks/:id/comments/:commentId', error);
        res.status(500).json({ error: 'Failed to edit comment' });
    }
});

// ============================================
// DELETE /api/tasks/:id/comments/:commentId  â€“  delete comment
// ============================================
router.delete('/:id/comments/:commentId', async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        const existing = await prisma.taskComment.findUnique({ where: { id: commentId } });
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        if (existing.memberId !== req.user.memberId && !(await isAdmin(req))) {
            return res.status(403).json({ error: 'Can only delete your own comments' });
        }

        await logActivity(existing.taskId, req.user.memberId, 'COMMENT_DELETED', {
            oldValue: existing.comment,
            description: `Comment #${commentId} deleted`,
        });

        await prisma.taskComment.delete({ where: { id: commentId } });
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('DELETE /tasks/:id/comments/:commentId', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ============================================
// GET /api/tasks/:id/activity  â€“  activity log
// ============================================
router.get('/:id/activity', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const log = await prisma.taskActivityLog.findMany({
            where: { taskId },
            include: {
                member: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(log);
    } catch (error) {
        console.error('GET /tasks/:id/activity', error);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

// ============================================
// POST /api/tasks/:id/tags  â€“  add tag to task
// Body: { tagType, tagName }
// ============================================
router.post('/:id/tags', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { tagType = 'CUSTOM', tagName } = req.body;
        if (!tagName?.trim()) return res.status(400).json({ error: 'tagName is required' });

        const tag = await prisma.taskTag.upsert({
            where: { taskId_tagName: { taskId, tagName: tagName.trim().toLowerCase() } },
            create: { taskId, tagType, tagName: tagName.trim().toLowerCase() },
            update: { tagType },
        });

        res.status(201).json(tag);
    } catch (error) {
        console.error('POST /tasks/:id/tags', error);
        res.status(500).json({ error: 'Failed to add tag' });
    }
});

// ============================================
// DELETE /api/tasks/:id/tags/:tagId  â€“  remove tag
// ============================================
router.delete('/:id/tags/:tagId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const tagId = parseInt(req.params.tagId);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        await prisma.taskTag.delete({ where: { id: tagId } });
        res.json({ message: 'Tag removed' });
    } catch (error) {
        console.error('DELETE /tasks/:id/tags/:tagId', error);
        res.status(500).json({ error: 'Failed to remove tag' });
    }
});

// ============================================
// POST /api/tasks/:id/dependencies  â€“  add dependency
// Body: { dependsOnTaskId, dependencyType }
// ============================================
router.post('/:id/dependencies', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { dependsOnTaskId, dependencyType = 'FINISH_TO_START' } = req.body;
        if (!dependsOnTaskId) return res.status(400).json({ error: 'dependsOnTaskId is required' });
        if (parseInt(dependsOnTaskId) === taskId) {
            return res.status(400).json({ error: 'A task cannot depend on itself' });
        }

        const dep = await prisma.taskDependency.upsert({
            where: {
                taskId_dependsOnTaskId: { taskId, dependsOnTaskId: parseInt(dependsOnTaskId) },
            },
            create: { taskId, dependsOnTaskId: parseInt(dependsOnTaskId), dependencyType },
            update: { dependencyType },
            include: {
                dependsOnTask: { select: { id: true, title: true, status: true } },
            },
        });

        await logActivity(taskId, req.user.memberId, 'DEPENDENCY_ADDED', {
            newValue: { dependsOnTaskId: parseInt(dependsOnTaskId), dependencyType },
            description: `Dependency added on task #${dependsOnTaskId}`,
        });

        res.status(201).json(dep);
    } catch (error) {
        console.error('POST /tasks/:id/dependencies', error);
        res.status(500).json({ error: 'Failed to add dependency' });
    }
});

// ============================================
// DELETE /api/tasks/:id/dependencies/:dependsOnTaskId  â€“  remove dependency
// ============================================
router.delete('/:id/dependencies/:dependsOnTaskId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const dependsOnTaskId = parseInt(req.params.dependsOnTaskId);
        if (!canUserEditTask(req)) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        await logActivity(taskId, req.user.memberId, 'DEPENDENCY_REMOVED', {
            oldValue: { dependsOnTaskId },
            description: `Dependency removed from task #${dependsOnTaskId}`,
        });

        await prisma.taskDependency.delete({
            where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
        });

        res.json({ message: 'Dependency removed' });
    } catch (error) {
        console.error('DELETE /tasks/:id/dependencies/:dependsOnTaskId', error);
        res.status(500).json({ error: 'Failed to remove dependency' });
    }
});

module.exports = router;
