const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const ADMINISTRATION_TEAM_NAME = 'Administration';

// Title-case utility for project titles
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

// ── helpers ──────────────────────────────────────────────
/** Return the team-IDs for every team the requesting user belongs to (active). */
async function getUserTeamIds(memberId) {
    const rows = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
}

/**
 * Is the user a privileged role (developer, officer, administration, leadership)?
 * Uses JWT flags set by computeAuthorityFlags in auth.
 */
function isPrivilegedUser(req) {
    return !!(req.user.isDeveloper || req.user.isOfficer || req.user.isAdmin || req.user.isLeadership);
}

/** Legacy isAdmin kept for backward-compat on list queries (non-admin visibility filter). */
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
 * Only privileged roles (developer, officer, administration, leadership) can edit.
 * Blocked if the project is inactive, finalized, archived, or aborted.
 */
async function canUserEditProject(req, projectId) {
    if (!req.user.memberId) return false;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { isActive: true, isFinalized: true, isArchived: true, status: true },
    });
    if (!project || project.isArchived || !project.isActive || project.isFinalized || project.status === 'CANCELLED') return false;

    return isPrivilegedUser(req);
}

/**
 * Can the requesting user manage (finalize / archive / deactivate) a project?
 * Same privileged-role check but NOT blocked by isFinalized.
 */
function canUserManageProject(req) {
    if (!req.user.memberId) return false;
    return isPrivilegedUser(req);
}

async function getProjectById(projectId) {
    return prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, isActive: true, isFinalized: true, isArchived: true, status: true },
    });
}

function buildProjectInclude() {
    return {
        createdBy: { select: { id: true, fullName: true } },
        projectTeams: { include: { team: { select: { id: true, name: true } } } },
        projectType: { select: { id: true, name: true, category: true } },
        tags: true,
    };
}

// ============================================
// GET /api/projects  –  list projects
// Query: status, priority, teamId, createdByMe, isActive (default true)
// ============================================
router.get('/', async (req, res) => {
    try {
        const { status, priority, teamId, createdByMe, isActive, archived } = req.query;
        const admin = await isAdmin(req);

        const where = {};
        if (isActive !== undefined) where.isActive = isActive === 'true';
        else where.isActive = true;

        // archived=true → show only archived; default → exclude archived
        if (archived === 'true') {
            where.isArchived = true;
            // Archived projects are inactive, so override isActive filter
            delete where.isActive;
        } else {
            where.isArchived = false;
        }

        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (createdByMe === 'true' && req.user.memberId) {
            where.createdByMemberId = req.user.memberId;
        }

        // Non-admins can only see projects they created or projects whose projectTeams overlap with their own teams
        if (!admin && req.user.memberId) {
            const myTeamIds = await getUserTeamIds(req.user.memberId);
            const accessFilter = teamId
                ? { teamId: parseInt(teamId) }
                : { in: myTeamIds };
            where.OR = [
                { createdByMemberId: req.user.memberId },
                { projectTeams: { some: { teamId: accessFilter } } },
            ];
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
                _count: {
                    select: {
                        tasks: { where: { isActive: true, parentTaskId: null } },
                        phases: { where: { isActive: true } },
                    },
                },
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

        // Access check for non-admins: must be a participant (creator or team member)
        if (!admin && req.user.memberId) {
            const myTeamIds = await getUserTeamIds(req.user.memberId);
            const access = await prisma.projectTeam.findFirst({
                where: { projectId: id, teamId: { in: myTeamIds } },
            });
            const createdByMe = await prisma.project.findFirst({
                where: { id, createdByMemberId: req.user.memberId },
                select: { id: true },
            });
            if (!access && !createdByMe) return res.status(403).json({ error: 'Access denied' });
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
                phases: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' },
                    include: {
                        tasks: {
                            where: { isActive: true, parentTaskId: null },
                            include: {
                                subtasks: {
                                    where: { isActive: true },
                                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                                    include: {
                                        assignments: {
                                            include: {
                                                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                                            },
                                        },
                                        tags: true,
                                    },
                                },
                                assignments: {
                                    include: {
                                        member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                                    },
                                },
                                tags: true,
                            },
                            orderBy: [{ order: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
                        },
                    },
                },
                tasks: {
                    where: { isActive: true, parentTaskId: null },
                    include: {
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
                    orderBy: [{ order: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
                },
            },
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });
        // Team access has already been verified above for non-admin users.
        // Allow read-only viewing of inactive, aborted, and archived projects.

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

        // Only privileged roles can create projects
        if (!isPrivilegedUser(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can create projects' });
        }

        const project = await prisma.project.create({
            data: {
                title: toTitleCase(title.trim()),
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

        // Auto-create default Phase 1
        try {
            await prisma.projectPhase.create({
                data: {
                    projectId: project.id,
                    title: 'Phase 1',
                    order: 1,
                },
            });
        } catch (phaseErr) {
            console.error('Failed to create default phase for project', project.id, phaseErr);
        }

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
        if (title !== undefined) data.title = toTitleCase(title.trim());
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
// PATCH /api/projects/:id/finalize  –  mark project as completed (read-only)
// ============================================
router.patch('/:id/finalize', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });
        if (!canUserManageProject(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can finalize projects' });
        }
        const current = await getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });
        if (current.isArchived) return res.status(400).json({ error: 'Archived projects cannot be finalized' });
        const project = await prisma.project.update({
            where: { id },
            data: {
                isFinalized: true,
                isActive: true,
                isArchived: false,
                status: 'COMPLETED',
                completedDate: new Date(),
            },
            include: buildProjectInclude(),
        });
        res.json(project);
    } catch (error) {
        console.error('PATCH /projects/:id/finalize', error);
        res.status(500).json({ error: 'Failed to finalize project' });
    }
});

// ============================================
// PATCH /api/projects/:id/archive  –  finalize + archive (move to past projects)
// ============================================
router.patch('/:id/archive', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });
        if (!canUserManageProject(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can archive projects' });
        }
        const current = await getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });
        if (!current.isFinalized && current.status !== 'CANCELLED') {
            return res.status(400).json({ error: 'Only finalized or aborted projects can be archived' });
        }
        const project = await prisma.project.update({
            where: { id },
            data: {
                isArchived: true,
                isActive: false,
                isFinalized: current.isFinalized,
                status: current.status,
            },
            include: buildProjectInclude(),
        });
        res.json(project);
    } catch (error) {
        console.error('PATCH /projects/:id/archive', error);
        res.status(500).json({ error: 'Failed to archive project' });
    }
});

// ============================================
// PATCH /api/projects/:id/reactivate  –  restore a deactivated project
// ============================================
router.patch('/:id/reactivate', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });
        if (!canUserManageProject(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can reactivate projects' });
        }
        const current = await getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });
        if (current.isArchived) return res.status(400).json({ error: 'Archived projects cannot be reactivated' });
        if (current.isFinalized) return res.status(400).json({ error: 'Finalized projects must be published instead of reactivated' });

        const project = await prisma.project.update({
            where: { id },
            data: {
                isActive: true,
                status: current.status === 'CANCELLED' ? 'NOT_STARTED' : current.status,
            },
            include: buildProjectInclude(),
        });
        res.json(project);
    } catch (error) {
        console.error('PATCH /projects/:id/reactivate', error);
        res.status(500).json({ error: 'Failed to reactivate project' });
    }
});

// ============================================
// PATCH /api/projects/:id/abort  –  cancel a project
// ============================================
router.patch('/:id/abort', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });
        if (!canUserManageProject(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can abort projects' });
        }
        const current = await getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });
        if (current.isArchived || current.isFinalized) return res.status(400).json({ error: 'Only active or inactive projects can be aborted' });

        const project = await prisma.project.update({
            where: { id },
            data: {
                isActive: false,
                isFinalized: false,
                isArchived: false,
                status: 'CANCELLED',
                completedDate: null,
            },
            include: buildProjectInclude(),
        });
        res.json(project);
    } catch (error) {
        console.error('PATCH /projects/:id/abort', error);
        res.status(500).json({ error: 'Failed to abort project' });
    }
});

// ============================================
// PATCH /api/projects/:id/publish  –  unfinalize and return to active workflow
// ============================================
router.patch('/:id/publish', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });
        if (!canUserManageProject(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can publish projects' });
        }
        const current = await getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });
        if (!current.isFinalized) return res.status(400).json({ error: 'Only finalized projects can be published' });

        const project = await prisma.project.update({
            where: { id },
            data: {
                isActive: true,
                isFinalized: false,
                isArchived: false,
                status: 'NOT_STARTED',
                completedDate: null,
            },
            include: buildProjectInclude(),
        });
        res.json(project);
    } catch (error) {
        console.error('PATCH /projects/:id/publish', error);
        res.status(500).json({ error: 'Failed to publish project' });
    }
});

// ============================================
// PATCH /api/projects/:id/deactivate  –  soft-delete project
// ============================================
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!canUserManageProject(req)) {
            return res.status(403).json({ error: 'Only developer, officer, administration and leadership can deactivate projects' });
        }
        const current = await getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });
        if (current.isArchived || current.isFinalized || current.status === 'CANCELLED' || !current.isActive) {
            return res.status(400).json({ error: 'Only active projects can be deactivated' });
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

// ──────────────────────────────────────────────────────────
//  POST /projects/:id/set-baseline
//  Copy current startDate/dueDate → baselineStartDate/baselineDueDate
//  for all active tasks in the project.
// ──────────────────────────────────────────────────────────
router.post('/:id/set-baseline', requireAdmin, async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        const tasks = await prisma.task.findMany({
            where: { projectId, isActive: true },
            select: { id: true, startDate: true, dueDate: true },
        });

        const ops = tasks.map((t) =>
            prisma.task.update({
                where: { id: t.id },
                data: {
                    baselineStartDate: t.startDate,
                    baselineDueDate: t.dueDate,
                },
            })
        );
        await prisma.$transaction(ops);

        res.json({ message: 'Baseline set', updated: tasks.length });
    } catch (error) {
        console.error('POST /projects/:id/set-baseline', error);
        res.status(500).json({ error: 'Failed to set baseline' });
    }
});

// ──────────────────────────────────────────────────────────
//  POST /projects/:id/clear-baseline
//  Clear baseline dates for all active tasks in the project.
// ──────────────────────────────────────────────────────────
router.post('/:id/clear-baseline', requireAdmin, async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        await prisma.task.updateMany({
            where: { projectId, isActive: true },
            data: { baselineStartDate: null, baselineDueDate: null },
        });
        res.json({ message: 'Baseline cleared' });
    } catch (error) {
        console.error('POST /projects/:id/clear-baseline', error);
        res.status(500).json({ error: 'Failed to clear baseline' });
    }
});

module.exports = router;
