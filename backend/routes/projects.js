const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const ADMINISTRATION_TEAM_NAME = 'Administration';

// ── helpers ──────────────────────────────────────────────
/** Return the member-IDs for every team the requesting user belongs to (active). */
async function getUserTeamIds(memberId) {
    const rows = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
}

/** Is the requesting user a developer or Administration-team member? */
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
 * Can the requesting user edit a specific project?
 * True if: admin/dev, OR the creator, OR a member of a team with canEdit=true for the project.
 */
async function canUserEditProject(req, projectId) {
    if (await isAdmin(req)) return true;
    if (!req.user.memberId) return false;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { createdByMemberId: true },
    });
    if (project?.createdByMemberId === req.user.memberId) return true;

    const teamIds = await getUserTeamIds(req.user.memberId);
    if (teamIds.length === 0) return false;

    const editAccess = await prisma.projectTeam.findFirst({
        where: { projectId, teamId: { in: teamIds }, canEdit: true },
    });
    return editAccess !== null;
}

// ============================================
// GET /api/projects  –  list projects
// Query: status, priority, teamId, createdByMe, isActive (default true)
// ============================================
router.get('/', async (req, res) => {
    try {
        const { status, priority, teamId, createdByMe, isActive } = req.query;
        const admin = await isAdmin(req);

        const where = {};
        if (isActive !== undefined) where.isActive = isActive === 'true';
        else where.isActive = true;

        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (createdByMe === 'true' && req.user.memberId) {
            where.createdByMemberId = req.user.memberId;
        }

        // Non-admins can only see projects whose projectTeams overlap with their own teams
        if (!admin && req.user.memberId) {
            const myTeamIds = await getUserTeamIds(req.user.memberId);
            where.projectTeams = {
                some: {
                    teamId: teamId ? parseInt(teamId) : { in: myTeamIds },
                },
            };
        } else if (teamId) {
            where.projectTeams = { some: { teamId: parseInt(teamId) } };
        }

        const projects = await prisma.project.findMany({
            where,
            include: {
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                projectTeams: {
                    include: { team: { select: { id: true, name: true } } },
                },
                projectType: { select: { id: true, name: true, category: true } },
                tags: true,
                _count: { select: { tasks: { where: { isActive: true, parentTaskId: null } } } },
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });

        res.json(projects);
    } catch (error) {
        console.error('GET /projects', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// ============================================
// GET /api/projects/types  –  all active project types
// ============================================
router.get('/types', async (req, res) => {
    try {
        const types = await prisma.projectType.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, category: true, description: true, icon: true },
        });
        res.json(types);
    } catch (error) {
        console.error('GET /projects/types', error);
        res.status(500).json({ error: 'Failed to fetch project types' });
    }
});

// ============================================
// GET /api/projects/:id  –  single project (full detail)
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });

        const admin = await isAdmin(req);

        // Access check for non-admins: must be in one of the projectTeams
        if (!admin && req.user.memberId) {
            const myTeamIds = await getUserTeamIds(req.user.memberId);
            const access = await prisma.projectTeam.findFirst({
                where: { projectId: id, teamId: { in: myTeamIds } },
            });
            if (!access) return res.status(403).json({ error: 'Access denied' });
        }

        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true, email: true } },
                projectTeams: {
                    include: {
                        team: { select: { id: true, name: true, isActive: true } },
                    },
                },
                projectType: { select: { id: true, name: true, category: true } },
                tags: true,
                tasks: {
                    where: { isActive: true, parentTaskId: null },
                    include: {
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
                    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
                },
            },
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (!project.isActive && !admin) return res.status(404).json({ error: 'Project not found' });

        // Attach edit permission flag for the requesting user
        const canEdit = await canUserEditProject(req, id);
        res.json({ ...project, canEdit });
    } catch (error) {
        console.error('GET /projects/:id', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// ============================================
// POST /api/projects  –  create project
// Body: { title, description, type, priority, startDate, dueDate, teamIds: [{teamId, canEdit, isOwner}] }
// ============================================
router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            projectTypeId,
            priority = 'MEDIUM',
            status = 'NOT_STARTED',
            startDate,
            dueDate,
            teamIds = [],
        } = req.body;

        if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
        if (!req.user.memberId) return res.status(400).json({ error: 'memberId required' });
        if (!projectTypeId) return res.status(400).json({ error: 'projectTypeId is required' });

        const project = await prisma.project.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                projectTypeId: parseInt(projectTypeId),
                priority,
                status,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                createdByMemberId: req.user.memberId,
                projectTeams: {
                    create: teamIds.map((t) => ({
                        teamId: parseInt(t.teamId),
                        canEdit: t.canEdit !== false,
                        isOwner: t.isOwner === true,
                    })),
                },
            },
            include: {
                createdBy: { select: { id: true, fullName: true } },
                projectTeams: {
                    include: { team: { select: { id: true, name: true } } },
                },
                tags: true,
            },
        });

        res.status(201).json(project);
    } catch (error) {
        console.error('POST /projects', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// ============================================
// PUT /api/projects/:id  –  update project
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });
        if (!(await canUserEditProject(req, id))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const {
            title,
            description,
            projectTypeId,
            priority,
            status,
            startDate,
            dueDate,
            completedDate,
            teamIds,
        } = req.body;

        const data = {};
        if (title !== undefined) data.title = title.trim();
        if (description !== undefined) data.description = description?.trim() || null;
        if (projectTypeId !== undefined) data.projectTypeId = parseInt(projectTypeId);
        if (priority !== undefined) data.priority = priority;
        if (status !== undefined) {
            data.status = status;
            if (status === 'COMPLETED' && !completedDate) data.completedDate = new Date();
        }
        if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
        if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
        if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null;

        // Sync teams if provided
        if (Array.isArray(teamIds)) {
            const incomingTeamIds = teamIds.map((t) => parseInt(t.teamId));

            // Remove teams no longer in the list
            await prisma.projectTeam.deleteMany({
                where: { projectId: id, teamId: { notIn: incomingTeamIds } },
            });

            // Upsert each team in the new list
            for (const t of teamIds) {
                const tid = parseInt(t.teamId);
                await prisma.projectTeam.upsert({
                    where: { projectId_teamId: { projectId: id, teamId: tid } },
                    create: { projectId: id, teamId: tid, canEdit: t.canEdit !== false, isOwner: t.isOwner === true },
                    update: { canEdit: t.canEdit !== false, isOwner: t.isOwner === true },
                });
            }
        }

        const project = await prisma.project.update({
            where: { id },
            data,
            include: {
                createdBy: { select: { id: true, fullName: true } },
                projectTeams: {
                    include: { team: { select: { id: true, name: true } } },
                }, projectType: { select: { id: true, name: true, category: true } }, projectType: { select: { id: true, name: true, category: true } },
                tags: true,
                _count: { select: { tasks: { where: { isActive: true, parentTaskId: null } } } },
            },
        });

        res.json(project);
    } catch (error) {
        console.error('PUT /projects/:id', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// ============================================
// PATCH /api/projects/:id/deactivate  –  soft-delete project
// ============================================
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!(await canUserEditProject(req, id))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }
        const project = await prisma.project.update({ where: { id }, data: { isActive: false } });
        res.json({ message: 'Project deactivated', project });
    } catch (error) {
        console.error('PATCH /projects/:id/deactivate', error);
        res.status(500).json({ error: 'Failed to deactivate project' });
    }
});

// ============================================
// PATCH /api/projects/:id/activate  –  restore project
// ============================================
router.patch('/:id/activate', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
        const project = await prisma.project.update({ where: { id }, data: { isActive: true } });
        res.json({ message: 'Project activated', project });
    } catch (error) {
        console.error('PATCH /projects/:id/activate', error);
        res.status(500).json({ error: 'Failed to activate project' });
    }
});

// ============================================
// POST /api/projects/:id/teams  –  add team to project
// Body: { teamId, canEdit, isOwner }
// ============================================
router.post('/:id/teams', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        if (!(await canUserEditProject(req, projectId))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { teamId, canEdit = true, isOwner = false } = req.body;
        if (!teamId) return res.status(400).json({ error: 'teamId is required' });

        const pt = await prisma.projectTeam.upsert({
            where: { projectId_teamId: { projectId, teamId: parseInt(teamId) } },
            create: { projectId, teamId: parseInt(teamId), canEdit, isOwner },
            update: { canEdit, isOwner },
            include: { team: { select: { id: true, name: true } } },
        });

        res.status(201).json(pt);
    } catch (error) {
        console.error('POST /projects/:id/teams', error);
        res.status(500).json({ error: 'Failed to add team to project' });
    }
});

// ============================================
// PATCH /api/projects/:id/teams/:teamId  –  update team permissions
// Body: { canEdit, isOwner }
// ============================================
router.patch('/:id/teams/:teamId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        if (!(await canUserEditProject(req, projectId))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { canEdit, isOwner } = req.body;
        const data = {};
        if (canEdit !== undefined) data.canEdit = canEdit;
        if (isOwner !== undefined) data.isOwner = isOwner;

        const pt = await prisma.projectTeam.update({
            where: { projectId_teamId: { projectId, teamId } },
            data,
            include: { team: { select: { id: true, name: true } } },
        });

        res.json(pt);
    } catch (error) {
        console.error('PATCH /projects/:id/teams/:teamId', error);
        res.status(500).json({ error: 'Failed to update team permissions' });
    }
});

// ============================================
// DELETE /api/projects/:id/teams/:teamId  –  remove team from project
// ============================================
router.delete('/:id/teams/:teamId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const teamId = parseInt(req.params.teamId);
        if (!(await canUserEditProject(req, projectId))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        await prisma.projectTeam.delete({
            where: { projectId_teamId: { projectId, teamId } },
        });

        res.json({ message: 'Team removed from project' });
    } catch (error) {
        console.error('DELETE /projects/:id/teams/:teamId', error);
        res.status(500).json({ error: 'Failed to remove team' });
    }
});

// ============================================
// POST /api/projects/:id/tags  –  add tag
// Body: { tagName }
// ============================================
router.post('/:id/tags', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        if (!(await canUserEditProject(req, projectId))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        const { tagName } = req.body;
        if (!tagName?.trim()) return res.status(400).json({ error: 'tagName is required' });

        const tag = await prisma.projectTag.upsert({
            where: { projectId_tagName: { projectId, tagName: tagName.trim().toLowerCase() } },
            create: { projectId, tagName: tagName.trim().toLowerCase() },
            update: {},
        });

        res.status(201).json(tag);
    } catch (error) {
        console.error('POST /projects/:id/tags', error);
        res.status(500).json({ error: 'Failed to add tag' });
    }
});

// ============================================
// DELETE /api/projects/:id/tags/:tagId  –  remove tag
// ============================================
router.delete('/:id/tags/:tagId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const tagId = parseInt(req.params.tagId);
        if (!(await canUserEditProject(req, projectId))) {
            return res.status(403).json({ error: 'Edit access denied' });
        }

        await prisma.projectTag.delete({ where: { id: tagId } });
        res.json({ message: 'Tag removed' });
    } catch (error) {
        console.error('DELETE /projects/:id/tags/:tagId', error);
        res.status(500).json({ error: 'Failed to remove tag' });
    }
});

module.exports = router;
