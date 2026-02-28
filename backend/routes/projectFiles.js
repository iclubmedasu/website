const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Readable } = require('stream');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const githubStorage = require('../services/githubStorageService');

const ADMINISTRATION_TEAM_NAME = 'Administration';

// Multer: memory storage, 25MB limit (GitHub Contents API limit)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

// Allowed MIME types
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
];

// ── Permission helpers (same pattern as projects.js) ──────────────
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
// GET /api/project-files?projectId=X
// Returns all active files for a project
// ============================================
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const files = await prisma.projectFile.findMany({
            where: { projectId: parseInt(projectId), isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
                uploadedBy: {
                    select: { id: true, fullName: true, profilePhotoUrl: true },
                },
            },
        });

        res.json(files);
    } catch (error) {
        console.error('GET /project-files', error);
        res.status(500).json({ error: 'Failed to fetch project files' });
    }
});

// ============================================
// POST /api/project-files/upload
// Upload a file to GitHub and store metadata
// ============================================
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { projectId, uploadedByMemberId } = req.body;

        if (!projectId || !uploadedByMemberId) {
            return res.status(400).json({ error: 'projectId and uploadedByMemberId are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
            return res.status(400).json({ error: 'File type not allowed' });
        }

        // Permission check
        const parsedProjectId = parseInt(projectId);
        if (!(await canUserEditProject(req, parsedProjectId))) {
            return res.status(403).json({ error: 'You do not have permission to upload files to this project' });
        }

        // Check if a file with the same name already exists for this project
        const existing = await prisma.projectFile.findFirst({
            where: {
                projectId: parsedProjectId,
                fileName: req.file.originalname,
                isActive: true,
            },
        });

        let replaceOpts = {};
        if (existing) {
            replaceOpts = { existingPath: existing.githubPath, existingSha: existing.githubSha };
        }

        // Upload (or update) on GitHub
        const ghResult = await githubStorage.uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            parsedProjectId,
            replaceOpts
        );

        let projectFile;
        if (existing) {
            // Update existing record with new SHA / size / mime
            projectFile = await prisma.projectFile.update({
                where: { id: existing.id },
                data: {
                    githubSha: ghResult.githubSha,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    uploadedByMemberId: parseInt(uploadedByMemberId),
                },
                include: {
                    uploadedBy: {
                        select: { id: true, fullName: true, profilePhotoUrl: true },
                    },
                },
            });
            projectFile._replaced = true; // signal to frontend
        } else {
            // Create new ProjectFile record
            projectFile = await prisma.projectFile.create({
                data: {
                    projectId: parsedProjectId,
                    uploadedByMemberId: parseInt(uploadedByMemberId),
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    githubPath: ghResult.githubPath,
                    githubSha: ghResult.githubSha,
                },
                include: {
                    uploadedBy: {
                        select: { id: true, fullName: true, profilePhotoUrl: true },
                    },
                },
            });
        }

        res.status(201).json(projectFile);
    } catch (error) {
        console.error('POST /project-files/upload', error);
        res.status(500).json({ error: error.message || 'Failed to upload file' });
    }
});

// ============================================
// GET /api/project-files/:id/download
// Proxy the file from GitHub so the browser can view/download it.
// Accepts auth via Authorization header OR ?token= query param
// (needed for browser-opened links / <a href>).
// ============================================
router.get('/:id/download', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        // Auth: prefer header, fall back to query param
        let user = req.user; // set by authenticateToken middleware
        if (!user && req.query.token) {
            try {
                user = jwt.verify(req.query.token, process.env.JWT_SECRET);
            } catch {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
        if (!user) return res.status(401).json({ error: 'Authentication required' });

        const file = await prisma.projectFile.findUnique({ where: { id } });
        if (!file || !file.isActive) return res.status(404).json({ error: 'File not found' });

        // Stream from GitHub
        const ghResponse = await githubStorage.downloadFile(file.githubPath);

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
        if (file.fileSize) res.setHeader('Content-Length', file.fileSize);

        // Pipe the readable stream to the response
        Readable.fromWeb(ghResponse.body).pipe(res);
    } catch (error) {
        console.error('GET /project-files/:id/download', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// ============================================
// GET /api/project-files/:id/history
// Returns commit history for a file from GitHub
// ============================================
router.get('/:id/history', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.projectFile.findUnique({ where: { id } });
        if (!file || !file.isActive) return res.status(404).json({ error: 'File not found' });

        const history = await githubStorage.getFileHistory(file.githubPath);
        res.json(history);
    } catch (error) {
        console.error('GET /project-files/:id/history', error);
        res.status(500).json({ error: 'Failed to fetch file history' });
    }
});

// ============================================
// GET /api/project-files/:id/version/:commitSha
// Download a specific version of a file
// ============================================
router.get('/:id/version/:commitSha', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { commitSha } = req.params;
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });
        if (!commitSha) return res.status(400).json({ error: 'commitSha is required' });

        // Auth: prefer header, fall back to query param
        let user = req.user;
        if (!user && req.query.token) {
            try {
                user = jwt.verify(req.query.token, process.env.JWT_SECRET);
            } catch {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
        if (!user) return res.status(401).json({ error: 'Authentication required' });

        const file = await prisma.projectFile.findUnique({ where: { id } });
        if (!file || !file.isActive) return res.status(404).json({ error: 'File not found' });

        const ghResponse = await githubStorage.downloadFileAtVersion(file.githubPath, commitSha);

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);

        Readable.fromWeb(ghResponse.body).pipe(res);
    } catch (error) {
        console.error('GET /project-files/:id/version/:commitSha', error);
        res.status(500).json({ error: 'Failed to download file version' });
    }
});

// ============================================
// DELETE /api/project-files/:id
// Soft-delete file (set isActive=false) and remove from GitHub
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.projectFile.findUnique({ where: { id } });
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Permission check
        if (!(await canUserEditProject(req, file.projectId))) {
            return res.status(403).json({ error: 'You do not have permission to delete files from this project' });
        }

        // Soft-delete in DB
        await prisma.projectFile.update({
            where: { id },
            data: { isActive: false },
        });

        // Delete from GitHub (best-effort — don't fail the request if GitHub errors)
        try {
            await githubStorage.deleteFile(file.githubPath, file.githubSha);
        } catch (ghErr) {
            console.error('GitHub delete failed (DB row already soft-deleted):', ghErr.message);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('DELETE /project-files/:id', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

module.exports = router;
