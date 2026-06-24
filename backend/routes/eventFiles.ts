const express: any = require('express');
const router: any = express.Router();
const multer = require('multer');
const { Readable } = require('stream');
const { prisma }: { prisma: any } = require('../db');
const githubStorage = require('../services/githubStorageService');
const { logEventActivity } = require('../services/activityLogService');
const { extractAuthToken, JWT_SECRET } = require('../middleware/auth');
const {
    canUserViewEvent,
    canUserAccessEventOperations,
} = require('../lib/eventPermissions');

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

function buildFolderGithubPath(eventId, folderName) {
    const safeName = sanitizePathSegment(folderName);
    return `events/${eventId}/folders/${safeName}-${Date.now()}`;
}

function buildFileGithubPath(eventId, folderGithubPath, originalFileName) {
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${safeName}`;
    if (folderGithubPath) {
        return `${folderGithubPath}/${uniqueName}`;
    }
    return `events/${eventId}/${uniqueName}`;
}

async function getFolderById(id) {
    return prisma.eventFolder.findUnique({
        where: { id },
        include: {
            event: { select: { id: true, isActive: true, isFinalized: true, isArchived: true, status: true } },
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
async function ensureCanViewEvent(res, user, eventId) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });

    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return false;
    }

    const canView = await canUserViewEvent(user, eventId, event.isArchived);
    if (!canView) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }

    return true;
}

/**
 * Can the user upload files to an event?
 * Upload authorization follows event visibility scope.
 */
async function canUserUploadToEvent(req, eventId) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });
    if (!event) return false;

    return canUserViewEvent(req.user, eventId, event.isArchived);
}

/**
 * Can the user manage files (delete/rename/restore)?
 * Anyone who can view the event may manage files.
 */
async function canUserManageEventFiles(req, eventId) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });
    if (!event) return false;

    return canUserAccessEventOperations(req.user, eventId, event.isArchived);
}

async function ensureCanManageEventFiles(res, req, eventId) {
    if (!(await canUserManageEventFiles(req, eventId))) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

// ============================================
// GET /api/event-files?eventId=X
// Returns all active files for a project
// ============================================
router.get('/', async (req, res) => {
    try {
        const { eventId } = req.query;
        if (!eventId) return res.status(400).json({ error: 'eventId is required' });

        const parsedEventId = parseInt(eventId);
        if (Number.isNaN(parsedEventId)) return res.status(400).json({ error: 'Invalid event ID' });

        if (!(await ensureCanViewEvent(res, req.user, parsedEventId))) return;

        const files = await prisma.eventFile.findMany({
            where: { eventId: parsedEventId, isActive: true },
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
        console.error('GET /event-files', error);
        res.status(500).json({ error: 'Failed to fetch event files' });
    }
});

// ============================================
// GET /api/event-files/folders?eventId=X[&includeDeleted=true]
// Returns folders for a project
// ============================================
router.get('/folders', async (req, res) => {
    try {
        const { eventId, includeDeleted } = req.query;
        if (!eventId) return res.status(400).json({ error: 'eventId is required' });

        const parsedEventId = parseInt(eventId);
        if (Number.isNaN(parsedEventId)) return res.status(400).json({ error: 'Invalid event ID' });

        if (!(await ensureCanViewEvent(res, req.user, parsedEventId))) return;

        const folders = await prisma.eventFolder.findMany({
            where: {
                eventId: parsedEventId,
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
        console.error('GET /event-files/folders', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// ============================================
// POST /api/event-files/folders
// Create a folder marker (.gitkeep) and persist folder metadata
// Body: { eventId, folderName, createdByMemberId }
// ============================================
router.post('/folders', async (req, res) => {
    try {
        const { eventId, folderName, createdByMemberId } = req.body;
        if (!eventId || !folderName || !createdByMemberId) {
            return res.status(400).json({ error: 'eventId, folderName and createdByMemberId are required' });
        }

        const parsedEventId = parseInt(eventId);
        if (Number.isNaN(parsedEventId)) return res.status(400).json({ error: 'Invalid event ID' });

        if (!(await canUserUploadToEvent(req, parsedEventId))) {
            return res.status(403).json({ error: 'You do not have permission to create folders in this event' });
        }

        const normalizedName = folderName.trim();
        if (!normalizedName) return res.status(400).json({ error: 'folderName is required' });

        const duplicate = await prisma.eventFolder.findFirst({
            where: {
                eventId: parsedEventId,
                isActive: true,
                folderName: normalizedName,
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A folder with this name already exists in this event' });
        }

        const githubPath = buildFolderGithubPath(parsedEventId, normalizedName);
        const markerPath = `${githubPath}/.gitkeep`;

        const ghResult = await githubStorage.uploadContent(Buffer.from(''), markerPath, `Create folder ${normalizedName}`);

        const folder = await prisma.eventFolder.create({
            data: {
                eventId: parsedEventId,
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
        console.error('POST /event-files/folders', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// ============================================
// GET /api/event-files/folders/:id/history
// Returns commit history for a folder marker (.gitkeep)
// ============================================
router.get('/folders/:id/history', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        if (!(await ensureCanViewEvent(res, req.user, folder.eventId))) return;

        const history = await githubStorage.getFileHistory(`${folder.githubPath}/.gitkeep`);
        res.json(history);
    } catch (error) {
        console.error('GET /event-files/folders/:id/history', error);
        res.status(500).json({ error: 'Failed to fetch folder history' });
    }
});

// ============================================
// DELETE /api/event-files/folders/:id
// Soft-delete folder and remove .gitkeep from GitHub
// ============================================
router.delete('/folders/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (!(await ensureCanManageEventFiles(res, req, folder.eventId))) return;
        if (!folder.isActive) return res.status(400).json({ error: 'Folder is already deleted' });

        const updated = await prisma.eventFolder.update({
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
        console.error('DELETE /event-files/folders/:id', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// ============================================
// POST /api/event-files/folders/:id/restore
// Restore a deleted folder and recreate its .gitkeep marker
// ============================================
router.post('/folders/:id/restore', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid folder ID' });

        const folder = await getFolderById(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (!(await ensureCanManageEventFiles(res, req, folder.eventId))) return;
        if (folder.isActive) return res.status(400).json({ error: 'Folder is not deleted' });

        const githubSha = await restoreFolderGitkeep(folder);

        const restored = await prisma.eventFolder.update({
            where: { id },
            data: { isActive: true, deletedAt: null, githubSha },
            include: {
                files: { where: { isActive: true }, select: { id: true } },
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        res.json(restored);
    } catch (error) {
        console.error('POST /event-files/folders/:id/restore', error);
        res.status(500).json({ error: error.message || 'Failed to restore folder' });
    }
});

// ============================================
// PATCH /api/event-files/folders/:id/rename
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
        if (!(await ensureCanManageEventFiles(res, req, folder.eventId))) return;

        const normalizedName = folderName.trim();
        const duplicate = await prisma.eventFolder.findFirst({
            where: {
                eventId: folder.eventId,
                isActive: true,
                folderName: normalizedName,
                id: { not: id },
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A folder with this name already exists in this event' });
        }

        const updated = await prisma.eventFolder.update({
            where: { id },
            data: { folderName: normalizedName },
            include: {
                files: { where: { isActive: true }, select: { id: true } },
                createdBy: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('PATCH /event-files/folders/:id/rename', error);
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});

// ============================================
// POST /api/event-files/upload
// Upload a file to GitHub and store metadata
// ============================================
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { eventId, uploadedByMemberId, folderId } = req.body;

        if (!eventId || !uploadedByMemberId) {
            return res.status(400).json({ error: 'eventId and uploadedByMemberId are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Permission check — all project team members can upload
        const parsedEventId = parseInt(eventId);
        if (Number.isNaN(parsedEventId)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        if (!(await canUserUploadToEvent(req, parsedEventId))) {
            return res.status(403).json({ error: 'You do not have permission to upload files to this event' });
        }

        let folder: any = null;
        if (folderId) {
            const parsedFolderId = parseInt(folderId);
            folder = await prisma.eventFolder.findUnique({ where: { id: parsedFolderId } });
            if (!folder || folder.eventId !== parsedEventId) {
                return res.status(404).json({ error: 'Folder not found' });
            }
            if (!folder.isActive) {
                return res.status(400).json({ error: 'Cannot upload to a deleted folder' });
            }
        }

        // Check if a file with the same name already exists for this event
        const existing = await prisma.eventFile.findFirst({
            where: {
                eventId: parsedEventId,
                fileName: req.file.originalname,
                folderId: folder ? folder.id : null,
                isActive: true,
            },
        });

        let replaceOpts: any = {};
        if (existing) {
            replaceOpts = { existingPath: existing.githubPath, existingSha: existing.githubSha };
        }

        // Upload (or update) on GitHub
        const targetPath = replaceOpts.existingPath || buildFileGithubPath(parsedEventId, folder?.githubPath, req.file.originalname);
        const ghResult = replaceOpts.existingPath
            ? await githubStorage.uploadContent(req.file.buffer, targetPath, `Update ${req.file.originalname}`, replaceOpts.existingSha)
            : await githubStorage.uploadContent(req.file.buffer, targetPath, `Upload ${req.file.originalname}`);

        let eventFile;
        if (existing) {
            // Update existing record with new SHA / size / mime
            eventFile = await prisma.eventFile.update({
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
            eventFile._replaced = true; // signal to frontend
        } else {
            // Create new EventFile record
            eventFile = await prisma.eventFile.create({
                data: {
                    eventId: parsedEventId,
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

        res.status(201).json(eventFile);
    } catch (error) {
        console.error('POST /event-files/upload', error);
        res.status(500).json({ error: error.message || 'Failed to upload file' });
    }
});

// ============================================
// GET /api/event-files/deleted?eventId=X
// Returns all soft-deleted files for a project
// ============================================
router.get('/deleted', async (req, res) => {
    try {
        const { eventId } = req.query;
        if (!eventId) return res.status(400).json({ error: 'eventId is required' });

        const parsedId = parseInt(eventId);
        if (Number.isNaN(parsedId)) return res.status(400).json({ error: 'Invalid event ID' });

        if (!(await ensureCanViewEvent(res, req.user, parsedId))) return;

        // Get active file names to exclude deleted files that share a name
        // with a currently active file (those are version replacements, not true deletions)
        const activeFiles = await prisma.eventFile.findMany({
            where: { eventId: parsedId, isActive: true },
            select: { fileName: true, folderId: true },
        });
        const activeNames = new Set(activeFiles.map((f) => `${f.folderId ?? 'root'}::${f.fileName}`));

        const files = await prisma.eventFile.findMany({
            where: { eventId: parsedId, isActive: false },
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
        console.error('GET /event-files/deleted', error);
        res.status(500).json({ error: 'Failed to fetch deleted files' });
    }
});

// ============================================
// GET /api/event-files/:id/download
// Proxy the file from GitHub so the browser can view/download it.
// Accepts auth via Authorization header OR ?token= query param
// (needed for browser-opened links / <a href>).
// ============================================
router.get('/:id/download', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        // Auth: prefer header/cookie, fall back to query token for legacy browser links
        let user = req.user; // set by authenticateToken middleware
        if (!user) {
            const token = extractAuthToken(req, { allowQueryToken: true });
            if (token) {
                try {
                    user = require('jsonwebtoken').verify(token, JWT_SECRET);
                } catch {
                    return res.status(401).json({ error: 'Invalid token' });
                }
            }
        }
        if (!user) return res.status(401).json({ error: 'Authentication required' });

        const file = await prisma.eventFile.findUnique({ where: { id } });
        if (!file || !file.isActive) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, user, file.eventId))) return;

        // Stream from GitHub
        const ghResponse = await githubStorage.downloadFile(file.githubPath);

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
        if (file.fileSize) res.setHeader('Content-Length', file.fileSize);

        // Pipe the readable stream to the response
        Readable.fromWeb(ghResponse.body).pipe(res);
    } catch (error) {
        console.error('GET /event-files/:id/download', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// ============================================
// GET /api/event-files/:id/history
// Returns commit history for a file from GitHub
// ============================================
router.get('/:id/history', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, req.user, file.eventId))) return;

        const history = await githubStorage.getFileHistory(file.githubPath);
        res.json(history);
    } catch (error) {
        console.error('GET /event-files/:id/history', error);
        res.status(500).json({ error: 'Failed to fetch file history' });
    }
});

// ============================================
// GET /api/event-files/:id/comments
// Returns comments for a file
// ============================================
router.get('/:id/comments', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            select: { id: true, eventId: true },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, req.user, file.eventId))) return;

        const comments = await prisma.eventFileComment.findMany({
            where: { fileId: id },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json(comments);
    } catch (error) {
        console.error('GET /event-files/:id/comments', error);
        res.status(500).json({ error: 'Failed to fetch file comments' });
    }
});

// ============================================
// POST /api/event-files/:id/comments
// Body: { comment }
// ============================================
router.post('/:id/comments', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            select: { id: true, eventId: true, fileName: true },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, req.user, file.eventId))) return;

        if (!req.user.memberId) return res.status(400).json({ error: 'memberId required' });

        const { comment } = req.body;
        if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

        const newComment = await prisma.eventFileComment.create({
            data: {
                fileId: id,
                memberId: req.user.memberId,
                comment: comment.trim(),
            },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logEventActivity({
            eventId: file.eventId,
            memberId: req.user.memberId,
            actionType: 'COMMENTED',
            entityType: 'FILE',
            newValue: comment.trim(),
            description: `Comment added on file ${file.fileName}`,
        });

        res.status(201).json(newComment);
    } catch (error) {
        console.error('POST /event-files/:id/comments', error);
        res.status(500).json({ error: 'Failed to add file comment' });
    }
});

// ============================================
// PUT /api/event-files/:id/comments/:commentId
// Body: { comment }
// ============================================
router.put('/:id/comments/:commentId', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const commentId = parseInt(req.params.commentId);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });
        if (Number.isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            select: { id: true, eventId: true, fileName: true },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, req.user, file.eventId))) return;

        const existing = await prisma.eventFileComment.findFirst({
            where: { id: commentId, fileId: id },
        });
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        const { comment } = req.body;
        if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

        const updated = await prisma.eventFileComment.update({
            where: { id: commentId },
            data: { comment: comment.trim(), isEdited: true },
            include: {
                member: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        await logEventActivity({
            eventId: file.eventId,
            memberId: req.user.memberId,
            actionType: 'COMMENT_EDITED',
            entityType: 'FILE',
            oldValue: existing.comment,
            newValue: comment.trim(),
            description: `Comment edited on file ${file.fileName}`,
        });

        res.json(updated);
    } catch (error) {
        console.error('PUT /event-files/:id/comments/:commentId', error);
        res.status(500).json({ error: 'Failed to edit file comment' });
    }
});

// ============================================
// DELETE /api/event-files/:id/comments/:commentId
// ============================================
router.delete('/:id/comments/:commentId', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const commentId = parseInt(req.params.commentId);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });
        if (Number.isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            select: { id: true, eventId: true, fileName: true },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, req.user, file.eventId))) return;

        const existing = await prisma.eventFileComment.findFirst({
            where: { id: commentId, fileId: id },
        });
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        await prisma.eventFileComment.delete({ where: { id: commentId } });

        await logEventActivity({
            eventId: file.eventId,
            memberId: req.user.memberId,
            actionType: 'COMMENT_DELETED',
            entityType: 'FILE',
            oldValue: existing.comment,
            description: `Comment #${commentId} deleted on file ${file.fileName}`,
        });

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('DELETE /event-files/:id/comments/:commentId', error);
        res.status(500).json({ error: 'Failed to delete file comment' });
    }
});

// ============================================
// GET /api/event-files/:id/version/:commitSha
// Download a specific version of a file
// ============================================
router.get('/:id/version/:commitSha', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { commitSha } = req.params;
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });
        if (!commitSha) return res.status(400).json({ error: 'commitSha is required' });

        // Auth: prefer header/cookie, fall back to query token for legacy browser links
        let user = req.user;
        if (!user) {
            const token = extractAuthToken(req, { allowQueryToken: true });
            if (token) {
                try {
                    user = require('jsonwebtoken').verify(token, JWT_SECRET);
                } catch {
                    return res.status(401).json({ error: 'Invalid token' });
                }
            }
        }
        if (!user) return res.status(401).json({ error: 'Authentication required' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!(await ensureCanViewEvent(res, user, file.eventId))) return;

        const ghResponse = await githubStorage.downloadFileAtVersion(file.githubPath, commitSha);

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);

        Readable.fromWeb(ghResponse.body).pipe(res);
    } catch (error) {
        console.error('GET /event-files/:id/version/:commitSha', error);
        res.status(500).json({ error: 'Failed to download file version' });
    }
});

// ============================================
// DELETE /api/event-files/:id
// Soft-delete file (set isActive=false) and remove from GitHub
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (!(await ensureCanManageEventFiles(res, req, file.eventId))) return;

        // Soft-delete in DB
        await prisma.eventFile.update({
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
        console.error('DELETE /event-files/:id', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// ============================================
// PATCH /api/event-files/:id/rename
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

        const file = await prisma.eventFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (!(await ensureCanManageEventFiles(res, req, file.eventId))) return;

        // Check for duplicate name in the same project
        const duplicate = await prisma.eventFile.findFirst({
            where: {
                eventId: file.eventId,
                fileName: fileName.trim(),
                isActive: true,
                id: { not: id },
            },
        });
        if (duplicate) {
            return res.status(409).json({ error: 'A file with this name already exists in this event' });
        }

        const updated = await prisma.eventFile.update({
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
        console.error('PATCH /event-files/:id/rename', error);
        res.status(500).json({ error: 'Failed to rename file' });
    }
});

// ============================================
// PATCH /api/event-files/:id/move
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

        const file = await prisma.eventFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (!(await ensureCanManageEventFiles(res, req, file.eventId))) return;

        let targetFolder: any = null;
        if (parsedFolderId !== null) {
            targetFolder = await prisma.eventFolder.findUnique({ where: { id: parsedFolderId } });
            if (!targetFolder || targetFolder.eventId !== file.eventId) {
                return res.status(404).json({ error: 'Folder not found' });
            }
            if (!targetFolder.isActive) {
                return res.status(400).json({ error: 'Cannot move files into a deleted folder' });
            }
        }

        const duplicate = await prisma.eventFile.findFirst({
            where: {
                eventId: file.eventId,
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
            : `events/${file.eventId}/${sourceBaseName}`;

        const moveResult = await githubStorage.moveFile(
            file.githubPath,
            targetGithubPath,
            file.githubSha,
            `Move ${file.fileName}${targetFolder ? ` to ${targetFolder.folderName}` : ' to root'}`,
        );

        const moved = await prisma.eventFile.update({
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
        console.error('PATCH /event-files/:id/move', error);
        res.status(500).json({ error: 'Failed to move file' });
    }
});

// ============================================
// POST /api/event-files/:id/restore
// Restore a soft-deleted file from GitHub history
// ============================================
router.post('/:id/restore', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid file ID' });

        const file = await prisma.eventFile.findUnique({
            where: { id },
            include: { folder: { select: { id: true, folderName: true, githubPath: true, isActive: true } } },
        });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.isActive) return res.status(400).json({ error: 'File is not deleted' });
        if (!(await ensureCanManageEventFiles(res, req, file.eventId))) return;

        if (file.folderId && file.folder && !file.folder.isActive) {
            const restoredFolderSha = await restoreFolderGitkeep(file.folder);
            await prisma.eventFolder.update({
                where: { id: file.folder.id },
                data: { isActive: true, deletedAt: null, githubSha: restoredFolderSha },
            });
        }

        // Restore the file on GitHub from commit history
        const ghResult = await githubStorage.restoreDeletedFile(file.githubPath);

        // Re-activate in DB with new SHA
        const restored = await prisma.eventFile.update({
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
        console.error('POST /event-files/:id/restore', error);
        res.status(500).json({ error: error.message || 'Failed to restore file' });
    }
});

export default router;

