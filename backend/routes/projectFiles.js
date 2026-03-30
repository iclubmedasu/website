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

function sanitizePathSegment(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'folder';
}

function buildFolderGithubPath(projectId, folderName) {
    const safeName = sanitizePathSegment(folderName);
    return `projects/${projectId}/folders/${safeName}-${Date.now()}`;
}

function buildFileGithubPath(projectId, folderGithubPath, originalFileName) {
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${safeName}`;
    if (folderGithubPath) {
        return `${folderGithubPath}/${uniqueName}`;
    }
    return `projects/${projectId}/${uniqueName}`;
}

async function getFolderById(id) {
    return prisma.projectFolder.findUnique({
        where: { id },
        include: {
            project: { select: { id: true, isActive: true, isFinalized: true, isArchived: true, status: true } },
        },
    });
}

async function restoreFolderGitkeep(folder) {
    const markerPath = `${folder.githubPath}/.gitkeep`;
    const result = await githubStorage.uploadContent(Buffer.from(''), markerPath, `Restore folder ${folder.folderName}`);
    return result.githubSha;
}

async function deleteFolderGitkeep(folder) {
    try {
        await githubStorage.deleteFile(`${folder.githubPath}/.gitkeep`, folder.githubSha);
    } catch (error) {
        console.error('GitHub folder delete failed:', error.message);
    }
}

// ── Permission helpers ──────────────
async function getUserTeamIds(memberId) {
    const rows = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
}

/**
 * Is the user a privileged role (developer, officer, administration, leadership)?
 */
function isPrivilegedUser(req) {
    return !!(req.user.isDeveloper || req.user.isOfficer || req.user.isAdmin || req.user.isLeadership);
}

/**
 * Can the user upload files to a project?
 * ALL member types whose team is linked to the project can upload.
 * Privileged users can always upload.
 */
async function canUserUploadToProject(req, projectId) {
    if (!req.user.memberId) return false;
    if (isPrivilegedUser(req)) return true;

    // Check if user is in one of the project's teams (any role, doesn't need canEdit)
    const teamIds = await getUserTeamIds(req.user.memberId);
    if (teamIds.length === 0) return false;

    const access = await prisma.projectTeam.findFirst({
        where: { projectId, teamId: { in: teamIds } },
    });
    return access !== null;
}

/**
 * Can the user manage files (delete/rename/restore)?
 * Only privileged users.
 */
function canUserManageFiles(req) {
    if (!req.user.memberId) return false;
    return isPrivilegedUser(req);
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
                folder: {
                    select: { id: true, folderName: true, githubPath: true, isActive: true },
                },
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
// GET /api/project-files/folders?projectId=X[&includeDeleted=true]
// Returns folders for a project
// ============================================
router.get('/folders', async (req, res) => {
    try {
        const { projectId, includeDeleted } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const folders = await prisma.projectFolder.findMany({
            where: {
                projectId: parseInt(projectId),
                ...(String(includeDeleted).toLowerCase() === 'true' ? {} : { isActive: true }),
            },
            orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
            include: {
                files: {
                    where: { isActive: true },
                    select: { id: true },
                },
                createdBy: {
                    select: { id: true, fullName: true, profilePhotoUrl: true },
                },
            },
        });

        res.json(folders);
    } catch (error) {
        console.error('GET /project-files/folders', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// ============================================
// POST /api/project-files/folders
// Create a folder marker (.gitkeep) and persist folder metadata
// Body: { projectId, folderName, createdByMemberId }
// ============================================
router.post('/folders', async (req, res) => {
    try {
        const { projectId, folderName, createdByMemberId } = req.body;
        if (!projectId || !folderName || !createdByMemberId) {
            return res.status(400).json({ error: 'projectId, folderName and createdByMemberId are required' });
        }

        const parsedProjectId = parseInt(projectId);
        if (Number.isNaN(parsedProjectId)) return res.status(400).json({ error: 'Invalid project ID' });

        if (!(await canUserUploadToProject(req, parsedProjectId))) {
            return res.status(403).json({ error: 'You do not have permission to create folders in this project' });
        }

        const normalizedName = folderName.trim();
        if (!normalizedName) return res.status(400).json({ error: 'folderName is required' });

        const duplicate = await prisma.projectFolder.findFirst({
            where: {
                projectId: parsedProjectId,
                isActive: true,
                folderName: normalizedName,
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A folder with this name already exists in this project' });
        }

        const githubPath = buildFolderGithubPath(parsedProjectId, normalizedName);
        const markerPath = `${githubPath}/.gitkeep`;

        const ghResult = await githubStorage.uploadContent(Buffer.from(''), markerPath, `Create folder ${normalizedName}`);

        const folder = await prisma.projectFolder.create({
            data: {
                projectId: parsedProjectId,
                createdByMemberId: parseInt(createdByMemberId),
                folderName: normalizedName,
                githubPath,
                githubSha: ghResult.githubSha,
            },
            include: {
                files: { where: { isActive: true }, select: { id: true } },
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        res.status(201).json(folder);
    } catch (error) {
        console.error('POST /project-files/folders', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// ============================================
// GET /api/project-files/folders/:id/history
// Returns commit history for a folder marker (.gitkeep)
// ============================================
router.get('/folders/:id/history', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        const history = await githubStorage.getFileHistory(`${folder.githubPath}/.gitkeep`);
        res.json(history);
    } catch (error) {
        console.error('GET /project-files/folders/:id/history', error);
        res.status(500).json({ error: 'Failed to fetch folder history' });
    }
});

// ============================================
// DELETE /api/project-files/folders/:id
// Soft-delete folder and remove .gitkeep from GitHub
// ============================================
router.delete('/folders/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        if (!canUserManageFiles(req)) {
            return res.status(403).json({ error: 'You do not have permission to delete folders in this project' });
        }

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (!folder.isActive) return res.status(400).json({ error: 'Folder is already deleted' });

        const updated = await prisma.projectFolder.update({
            where: { id },
            data: { isActive: false, deletedAt: new Date() },
            include: {
                files: { where: { isActive: true }, select: { id: true } },
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await deleteFolderGitkeep(folder);

        res.json({ success: true, folder: updated });
    } catch (error) {
        console.error('DELETE /project-files/folders/:id', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// ============================================
// POST /api/project-files/folders/:id/restore
// Restore a deleted folder and recreate its .gitkeep marker
// ============================================
router.post('/folders/:id/restore', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        if (!canUserManageFiles(req)) {
            return res.status(403).json({ error: 'You do not have permission to restore folders in this project' });
        }

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (folder.isActive) return res.status(400).json({ error: 'Folder is not deleted' });

        const githubSha = await restoreFolderGitkeep(folder);

        const restored = await prisma.projectFolder.update({
            where: { id },
            data: { isActive: true, deletedAt: null, githubSha },
            include: {
                files: { where: { isActive: true }, select: { id: true } },
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        res.json(restored);
    } catch (error) {
        console.error('POST /project-files/folders/:id/restore', error);
        res.status(500).json({ error: error.message || 'Failed to restore folder' });
    }
});

// ============================================
// PATCH /api/project-files/folders/:id/rename
// Rename a folder (display name only — GitHub path unchanged)
// ============================================
router.patch('/folders/:id/rename', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        const { folderName } = req.body;
        if (!folderName || !folderName.trim()) {
            return res.status(400).json({ error: 'folderName is required' });
        }

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        if (!canUserManageFiles(req)) {
            return res.status(403).json({ error: 'You do not have permission to rename folders in this project' });
        }

        const normalizedName = folderName.trim();
        const duplicate = await prisma.projectFolder.findFirst({
            where: {
                projectId: folder.projectId,
                isActive: true,
                folderName: normalizedName,
                id: { not: id },
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A folder with this name already exists in this project' });
        }

        const updated = await prisma.projectFolder.update({
            where: { id },
            data: { folderName: normalizedName },
            include: {
                files: { where: { isActive: true }, select: { id: true } },
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('PATCH /project-files/folders/:id/rename', error);
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});

// ============================================
// POST /api/project-files/upload
// Upload a file to GitHub and store metadata
// ============================================
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { projectId, uploadedByMemberId, folderId } = req.body;

        if (!projectId || !uploadedByMemberId) {
            return res.status(400).json({ error: 'projectId and uploadedByMemberId are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Permission check — all project team members can upload
        const parsedProjectId = parseInt(projectId);
        if (!(await canUserUploadToProject(req, parsedProjectId))) {
            return res.status(403).json({ error: 'You do not have permission to upload files to this project' });
        }

        let folder = null;
        if (folderId) {
            const parsedFolderId = parseInt(folderId);
            folder = await prisma.projectFolder.findUnique({ where: { id: parsedFolderId } });
            if (!folder || folder.projectId !== parsedProjectId) {
                return res.status(404).json({ error: 'Folder not found' });
            }
            if (!folder.isActive) {
                return res.status(400).json({ error: 'Cannot upload to a deleted folder' });
            }
        }

        // Check if a file with the same name already exists for this project
        const existing = await prisma.projectFile.findFirst({
            where: {
                projectId: parsedProjectId,
                fileName: req.file.originalname,
                folderId: folder ? folder.id : null,
                isActive: true,
            },
        });

        let replaceOpts = {};
        if (existing) {
            replaceOpts = { existingPath: existing.githubPath, existingSha: existing.githubSha };
        }

        // Upload (or update) on GitHub
        const targetPath = replaceOpts.existingPath || buildFileGithubPath(parsedProjectId, folder?.githubPath, req.file.originalname);
        const ghResult = replaceOpts.existingPath
            ? await githubStorage.uploadContent(req.file.buffer, targetPath, `Update ${req.file.originalname}`, replaceOpts.existingSha)
            : await githubStorage.uploadContent(req.file.buffer, targetPath, `Upload ${req.file.originalname}`);

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
                    folderId: folder ? folder.id : null,
                },
                include: {
                    folder: {
                        select: { id: true, folderName: true, githubPath: true, isActive: true },
                    },
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
                    folderId: folder ? folder.id : null,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    githubPath: ghResult.githubPath,
                    githubSha: ghResult.githubSha,
                },
                include: {
                    folder: {
                        select: { id: true, folderName: true, githubPath: true, isActive: true },
                    },
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
// GET /api/project-files/deleted?projectId=X
// Returns all soft-deleted files for a project
// ============================================
router.get('/deleted', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const parsedId = parseInt(projectId);

        // Get active file names to exclude deleted files that share a name
        // with a currently active file (those are version replacements, not true deletions)
        const activeFiles = await prisma.projectFile.findMany({
            where: { projectId: parsedId, isActive: true },
            select: { fileName: true, folderId: true },
        });
        const activeNames = new Set(activeFiles.map((f) => `${f.folderId ?? 'root'}::${f.fileName}`));

        const files = await prisma.projectFile.findMany({
            where: { projectId: parsedId, isActive: false },
            orderBy: { updatedAt: 'desc' },
            include: {
                folder: {
                    select: { id: true, folderName: true, githubPath: true, isActive: true },
                },
                uploadedBy: {
                    select: { id: true, fullName: true, profilePhotoUrl: true },
                },
            },
        });

        // Only return truly deleted files (no active file with the same name)
        const filtered = files.filter((f) => !activeNames.has(`${f.folderId ?? 'root'}::${f.fileName}`));

        res.json(filtered);
    } catch (error) {
        console.error('GET /project-files/deleted', error);
        res.status(500).json({ error: 'Failed to fetch deleted files' });
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

        const file = await prisma.projectFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

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

        const file = await prisma.projectFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

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

        const file = await prisma.projectFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Permission check — only privileged users can delete files
        if (!canUserManageFiles(req)) {
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

// ============================================
// PATCH /api/project-files/:id/rename
// Rename a file (display name only — GitHub path unchanged)
// ============================================
router.patch('/:id/rename', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const { fileName } = req.body;
        if (!fileName || !fileName.trim()) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const file = await prisma.projectFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Permission check — only privileged users can rename files
        if (!canUserManageFiles(req)) {
            return res.status(403).json({ error: 'You do not have permission to rename files in this project' });
        }

        // Check for duplicate name in the same project
        const duplicate = await prisma.projectFile.findFirst({
            where: {
                projectId: file.projectId,
                fileName: fileName.trim(),
                isActive: true,
                id: { not: id },
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A file with this name already exists in this project' });
        }

        const updated = await prisma.projectFile.update({
            where: { id },
            data: { fileName: fileName.trim() },
            include: {
                folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } },
                uploadedBy: {
                    select: { id: true, fullName: true, profilePhotoUrl: true },
                },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('PATCH /project-files/:id/rename', error);
        res.status(500).json({ error: 'Failed to rename file' });
    }
});

// ============================================
// PATCH /api/project-files/:id/move
// Move a file between root and folders (metadata only — GitHub path unchanged)
// Body: { folderId: number | null }
// ============================================
router.patch('/:id/move', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const { folderId = null } = req.body;
        const parsedFolderId = folderId === null || folderId === '' ? null : parseInt(folderId, 10);
        if (folderId !== null && folderId !== '' && Number.isNaN(parsedFolderId)) {
            return res.status(400).json({ error: 'folderId must be a valid folder ID or null' });
        }

        const file = await prisma.projectFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!canUserManageFiles(req)) {
            return res.status(403).json({ error: 'You do not have permission to move files in this project' });
        }

        let targetFolder = null;
        if (parsedFolderId !== null) {
            targetFolder = await prisma.projectFolder.findUnique({ where: { id: parsedFolderId } });
            if (!targetFolder || targetFolder.projectId !== file.projectId) {
                return res.status(404).json({ error: 'Folder not found' });
            }
            if (!targetFolder.isActive) {
                return res.status(400).json({ error: 'Cannot move files into a deleted folder' });
            }
        }

        const duplicate = await prisma.projectFile.findFirst({
            where: {
                projectId: file.projectId,
                fileName: file.fileName,
                isActive: true,
                folderId: targetFolder ? targetFolder.id : null,
                id: { not: id },
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A file with this name already exists in the target folder' });
        }

        const sourceBaseName = file.githubPath.split('/').pop();
        const targetGithubPath = targetFolder
            ? `${targetFolder.githubPath}/${sourceBaseName}`
            : `projects/${file.projectId}/${sourceBaseName}`;

        const moveResult = await githubStorage.moveFile(
            file.githubPath,
            targetGithubPath,
            file.githubSha,
            `Move ${file.fileName}${targetFolder ? ` to ${targetFolder.folderName}` : ' to root'}`,
        );

        const moved = await prisma.projectFile.update({
            where: { id },
            data: {
                folderId: targetFolder ? targetFolder.id : null,
                githubPath: moveResult.githubPath,
                githubSha: moveResult.githubSha,
            },
            include: {
                folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } },
                uploadedBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        res.json(moved);
    } catch (error) {
        console.error('PATCH /project-files/:id/move', error);
        res.status(500).json({ error: 'Failed to move file' });
    }
});

// ============================================
// POST /api/project-files/:id/restore
// Restore a soft-deleted file from GitHub history
// ============================================
router.post('/:id/restore', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.projectFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.isActive) return res.status(400).json({ error: 'File is not deleted' });

        // Permission check — only privileged users can restore files
        if (!canUserManageFiles(req)) {
            return res.status(403).json({ error: 'You do not have permission to restore files in this project' });
        }

        if (file.folderId && file.folder && !file.folder.isActive) {
            const restoredFolderSha = await restoreFolderGitkeep(file.folder);
            await prisma.projectFolder.update({
                where: { id: file.folder.id },
                data: { isActive: true, deletedAt: null, githubSha: restoredFolderSha },
            });
        }

        // Restore the file on GitHub from commit history
        const ghResult = await githubStorage.restoreDeletedFile(file.githubPath);

        // Re-activate in DB with new SHA
        const restored = await prisma.projectFile.update({
            where: { id },
            data: {
                isActive: true,
                githubSha: ghResult.githubSha,
            },
            include: {
                folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } },
                uploadedBy: {
                    select: { id: true, fullName: true, profilePhotoUrl: true },
                },
            },
        });

        res.json(restored);
    } catch (error) {
        console.error('POST /project-files/:id/restore', error);
        res.status(500).json({ error: error.message || 'Failed to restore file' });
    }
});

module.exports = router;
