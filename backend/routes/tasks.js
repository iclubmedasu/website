const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

const ADMINISTRATION_TEAM_NAME = 'Administration';

// ── helpers ──────────────────────────────────────────────
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
 * Can the requesting user edit a task?
 * True if: admin/dev, OR a member of a team with TaskTeam.canEdit=true,
 * OR assigned to task, OR can edit the parent project.
 */
async function canUserEditTask(req, taskId) {
    if (await isAdmin(req)) return true;
    if (!req.user.memberId) return false;

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
            projectId: true,
            taskTeams: { select: { teamId: true, canEdit: true } },
            assignments: { select: { memberId: true } },
        },
    });
    if (!task) return false;

    // Assigned to task
    if (task.assignments.some((a) => a.memberId === req.user.memberId)) return true;

    const myTeamIds = await getUserTeamIds(req.user.memberId);

    // Team with canEdit on task
    if (task.taskTeams.some((tt) => tt.canEdit && myTeamIds.includes(tt.teamId))) return true;

    // Can edit parent project
    const project = await prisma.project.findUnique({
        where: { id: task.projectId },
        select: { createdByMemberId: true },
    });
    if (project?.createdByMemberId === req.user.memberId) return true;

    const editAccess = await prisma.projectTeam.findFirst({
        where: { projectId: task.projectId, teamId: { in: myTeamIds }, canEdit: true },
    });
    return editAccess !== null;
}

/**
 * Log a task activity event in the TaskActivityLog.
 */
async function logActivity(taskId, memberId, actionType, { oldValue, newValue, description } = {}) {
    await prisma.taskActivityLog.create({
        data: {
            taskId,
            memberId,
            actionType,
            oldValue: oldValue !== undefined ? String(oldValue) : null,
            newValue: newValue !== undefined ? String(newValue) : null,
            description: description || null,
        },
    });
}

// ============================================
// GET /api/tasks  –  list tasks (filters)
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
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
        });

        res.json(tasks);
    } catch (error) {
        console.error('GET /tasks', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// ============================================
// GET /api/tasks/:id  –  single task (full detail + subtasks + comments)
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
                subtasks: {
                    where: { isActive: true },
                    include: {
                        subtasks: { where: { isActive: true } },
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
            },
        });

        if (!task || !task.isActive) return res.status(404).json({ error: 'Task not found' });

        const canEdit = await canUserEditTask(req, id);
        res.json({ ...task, canEdit });
    } catch (error) {
        console.error('GET /tasks/:id', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// ============================================
// POST /api/tasks  –  create task (or subtask)
// Body: { projectId, parentTaskId?, title, description, type, priority, status,
//          startDate, dueDate, estimatedHours, teamIds, assigneeIds }
// ============================================
router.post('/', async (req, res) => {
    try {
        const {
            projectId,
            parentTaskId = null,
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

        const task = await prisma.task.create({
            data: {
                projectId: parseInt(projectId),
                parentTaskId: parentTaskId ? parseInt(parentTaskId) : null,
                title: title.trim(),
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

        res.status(201).json(task);
    } catch (error) {
        console.error('POST /tasks', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// ============================================
// PUT /api/tasks/:id  –  update task
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid task ID' });
        if (!(await canUserEditTask(req, id))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const old = await prisma.task.findUnique({ where: { id }, select: { status: true } });

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
        } = req.body;

        const data = {};
        if (title !== undefined) data.title = title.trim();
        if (description !== undefined) data.description = description?.trim() || null;
        if (type !== undefined) data.type = type;
        if (priority !== undefined) data.priority = priority;
        if (difficulty !== undefined) data.difficulty = difficulty;
        if (status !== undefined) {
            data.status = status;
            if (status === 'COMPLETED' && !completedDate) data.completedDate = new Date();
        }
        if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
        if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
        if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null;
        if (estimatedHours !== undefined) data.estimatedHours = estimatedHours ? parseFloat(estimatedHours) : null;
        if (actualHours !== undefined) data.actualHours = actualHours ? parseFloat(actualHours) : null;

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

        if (status !== undefined && old && old.status !== status) {
            await logActivity(id, req.user.memberId, 'STATUS_CHANGED', {
                oldValue: old.status,
                newValue: status,
                description: `Status changed from ${old.status} to ${status}`,
            });
        }

        res.json(task);
    } catch (error) {
        console.error('PUT /tasks/:id', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// ============================================
// PATCH /api/tasks/:id/status  –  quick status update
// Body: { status }
// ============================================
router.patch('/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!(await canUserEditTask(req, id))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { status } = req.body;
        const VALID_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED'];
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        }

        const old = await prisma.task.findUnique({ where: { id }, select: { status: true } });
        const data = { status };
        if (status === 'COMPLETED') data.completedDate = new Date();

        const task = await prisma.task.update({ where: { id }, data });

        await logActivity(id, req.user.memberId, 'STATUS_CHANGED', {
            oldValue: old?.status,
            newValue: status,
            description: `Status changed from ${old?.status} to ${status}`,
        });

        res.json(task);
    } catch (error) {
        console.error('PATCH /tasks/:id/status', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ============================================
// PATCH /api/tasks/:id/deactivate  –  soft-delete
// ============================================
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!(await canUserEditTask(req, id))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }
        const task = await prisma.task.update({ where: { id }, data: { isActive: false } });
        res.json({ message: 'Task deactivated', task });
    } catch (error) {
        console.error('PATCH /tasks/:id/deactivate', error);
        res.status(500).json({ error: 'Failed to deactivate task' });
    }
});

// ============================================
// POST /api/tasks/:id/teams  –  assign team to task
// Body: { teamId, canEdit }
// ============================================
router.post('/:id/teams', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!(await canUserEditTask(req, taskId))) {
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
// DELETE /api/tasks/:id/teams/:teamId  –  remove team from task
// ============================================
router.delete('/:id/teams/:teamId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        if (!(await canUserEditTask(req, taskId))) {
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
// POST /api/tasks/:id/assign  –  assign member to task (by another member/admin)
// Body: { memberId }
// ============================================
router.post('/:id/assign', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!(await canUserEditTask(req, taskId))) {
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
// POST /api/tasks/:id/self-assign  –  member self-assigns
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
// PATCH /api/tasks/:id/assign/:memberId  –  update assignment status
// Body: { status }  (ASSIGNED | ACCEPTED | IN_PROGRESS | COMPLETED)
// ============================================
router.patch('/:id/assign/:memberId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        const { status } = req.body;

        // Only the assignee themselves (or an admin) can update it
        const isOwnAssignment = req.user.memberId === memberId;
        if (!isOwnAssignment && !(await canUserEditTask(req, taskId))) {
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

        res.json(assignment);
    } catch (error) {
        console.error('PATCH /tasks/:id/assign/:memberId', error);
        res.status(500).json({ error: 'Failed to update assignment' });
    }
});

// ============================================
// DELETE /api/tasks/:id/assign/:memberId  –  unassign member
// ============================================
router.delete('/:id/assign/:memberId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        if (!(await canUserEditTask(req, taskId))) {
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
// GET /api/tasks/:id/comments  –  get comments
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
// POST /api/tasks/:id/comments  –  add comment
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
// PUT /api/tasks/:id/comments/:commentId  –  edit comment (own only)
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

        res.json(updated);
    } catch (error) {
        console.error('PUT /tasks/:id/comments/:commentId', error);
        res.status(500).json({ error: 'Failed to edit comment' });
    }
});

// ============================================
// DELETE /api/tasks/:id/comments/:commentId  –  delete comment
// ============================================
router.delete('/:id/comments/:commentId', async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        const existing = await prisma.taskComment.findUnique({ where: { id: commentId } });
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        if (existing.memberId !== req.user.memberId && !(await isAdmin(req))) {
            return res.status(403).json({ error: 'Can only delete your own comments' });
        }

        await prisma.taskComment.delete({ where: { id: commentId } });
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('DELETE /tasks/:id/comments/:commentId', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ============================================
// GET /api/tasks/:id/activity  –  activity log
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
// POST /api/tasks/:id/tags  –  add tag to task
// Body: { tagType, tagName }
// ============================================
router.post('/:id/tags', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!(await canUserEditTask(req, taskId))) {
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
// DELETE /api/tasks/:id/tags/:tagId  –  remove tag
// ============================================
router.delete('/:id/tags/:tagId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const tagId = parseInt(req.params.tagId);
        if (!(await canUserEditTask(req, taskId))) {
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
// POST /api/tasks/:id/dependencies  –  add dependency
// Body: { dependsOnTaskId, dependencyType }
// ============================================
router.post('/:id/dependencies', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        if (!(await canUserEditTask(req, taskId))) {
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

        res.status(201).json(dep);
    } catch (error) {
        console.error('POST /tasks/:id/dependencies', error);
        res.status(500).json({ error: 'Failed to add dependency' });
    }
});

// ============================================
// DELETE /api/tasks/:id/dependencies/:dependsOnTaskId  –  remove dependency
// ============================================
router.delete('/:id/dependencies/:dependsOnTaskId', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const dependsOnTaskId = parseInt(req.params.dependsOnTaskId);
        if (!(await canUserEditTask(req, taskId))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

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
