import express from 'express';
import multer from 'multer';
import { prisma } from '../db';
import * as githubStorage from '../services/githubStorageService';
import { extractAuthToken, JWT_SECRET } from '../middleware/auth';
import { canUserViewProject } from '../lib/projectPermissions';
import {
    eventPhotoPreviewGithubPath,
    optimizeEventPhoto,
} from '../lib/optimizeEventPhoto';
import { pipeGithubBodyToResponse } from '../lib/pipeGithubResponse';

const { v4: uuidv4 } = require('uuid') as { v4: () => string };
const router: any = express.Router();

const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) cb(null, true);
        else cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'));
    },
});

function buildPhotoGithubPath(projectId, originalFileName) {
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `projects/${projectId}/photos/${uuidv4()}-${safeName}`;
}

// ── Permission helpers ──────────────
async function ensureCanViewProject(res, user, projectId) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, isArchived: true },
    });

    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return false;
    }

    const canView = await canUserViewProject(user, projectId, project.isArchived);
    if (!canView) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }

    return true;
}

/**
 * Upload + manage authorization follows project visibility scope
 * (anyone who can view the project may upload and manage photos).
 */
async function canUserManageProjectPhotos(req, projectId) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, isArchived: true },
    });
    if (!project) return false;

    return canUserViewProject(req.user, projectId, project.isArchived);
}

async function ensureCanManageProjectPhotos(res, req, projectId) {
    if (!(await canUserManageProjectPhotos(req, projectId))) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

const uploadedBySelect = {
    select: { id: true, fullName: true, profilePhotoUrl: true },
};

// ============================================
// GET /api/project-photos?projectId=X[&includeInactive=true]
// ============================================
router.get('/', async (req, res) => {
    try {
        const { projectId, includeInactive } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const parsedProjectId = parseInt(projectId);
        if (Number.isNaN(parsedProjectId)) return res.status(400).json({ error: 'Invalid project ID' });

        if (!(await ensureCanViewProject(res, req.user, parsedProjectId))) return;

        const photos = await prisma.projectPhoto.findMany({
            where: {
                projectId: parsedProjectId,
                ...(String(includeInactive).toLowerCase() === 'true' ? {} : { isActive: true }),
            },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.json(photos);
    } catch (error) {
        console.error('GET /project-photos', error);
        res.status(500).json({ error: 'Failed to fetch project photos' });
    }
});

// ============================================
// POST /api/project-photos/upload
// Upload a photo to GitHub and store metadata (always create)
// ============================================
router.post('/upload', upload.single('photo'), async (req, res) => {
    try {
        const { projectId, uploadedByMemberId, caption } = req.body;

        if (!projectId || !uploadedByMemberId) {
            return res.status(400).json({ error: 'projectId and uploadedByMemberId are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const parsedProjectId = parseInt(projectId);
        if (Number.isNaN(parsedProjectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }

        if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
            return res.status(400).json({ error: 'Only JPEG, PNG, WebP, and HEIC images are allowed' });
        }

        if (!(await canUserManageProjectPhotos(req, parsedProjectId))) {
            return res.status(403).json({ error: 'You do not have permission to upload photos to this project' });
        }

        const githubPath = buildPhotoGithubPath(parsedProjectId, req.file.originalname);
        const ghResult = await githubStorage.uploadContent(
            req.file.buffer,
            githubPath,
            `Upload ${req.file.originalname}`,
        );

        let previewFields: {
            previewGithubPath?: string;
            previewGithubSha?: string;
            previewFileSize?: number;
        } = {};
        try {
            const optimized = await optimizeEventPhoto(req.file.buffer);
            const previewPath = eventPhotoPreviewGithubPath(ghResult.githubPath);
            const previewResult = await githubStorage.uploadContent(
                optimized.buffer,
                previewPath,
                `Upload preview ${req.file.originalname}`,
            );
            previewFields = {
                previewGithubPath: previewResult.githubPath,
                previewGithubSha: previewResult.githubSha,
                previewFileSize: optimized.buffer.length,
            };
        } catch (previewErr) {
            console.error('POST /project-photos/upload preview failed (saving original only):', previewErr);
        }

        const photo = await prisma.projectPhoto.create({
            data: {
                projectId: parsedProjectId,
                uploadedByMemberId: parseInt(uploadedByMemberId),
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                githubPath: ghResult.githubPath,
                githubSha: ghResult.githubSha,
                ...previewFields,
                ...(caption !== undefined && caption !== null ? { caption: String(caption) } : {}),
            },
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.status(201).json(photo);
    } catch (error) {
        console.error('POST /project-photos/upload', error);
        res.status(500).json({ error: error.message || 'Failed to upload photo' });
    }
});

// ============================================
// GET /api/project-photos/:id/download
// Proxy the photo from GitHub. Auth via header OR ?token=
// ============================================
router.get('/:id/download', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

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

        const photo = await prisma.projectPhoto.findUnique({ where: { id } });
        if (!photo || !photo.isActive) return res.status(404).json({ error: 'Photo not found' });

        if (!(await ensureCanViewProject(res, user, photo.projectId))) return;

        const ghResponse = await githubStorage.downloadFile(photo.githubPath);

        res.setHeader('Content-Type', photo.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${photo.fileName}"`);
        if (photo.fileSize) res.setHeader('Content-Length', photo.fileSize);

        await pipeGithubBodyToResponse(ghResponse, res);
    } catch (error) {
        console.error('GET /project-photos/:id/download', error);
        res.status(500).json({ error: 'Failed to download photo' });
    }
});

const MAX_CORE_PHOTOS_PER_PROJECT = 10;

function coerceBoolean(value) {
    return value === true || value === 'true';
}

// ============================================
// PATCH /api/project-photos/:id
// Update caption, order, showOnPublic, and/or isCore
// ============================================
router.patch('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

        const photo = await prisma.projectPhoto.findUnique({ where: { id } });
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        if (!(await ensureCanManageProjectPhotos(res, req, photo.projectId))) return;

        const data: any = {};
        if (req.body.caption !== undefined) data.caption = req.body.caption;
        if (req.body.order !== undefined) data.order = parseInt(req.body.order);
        if (req.body.showOnPublic !== undefined) {
            data.showOnPublic = coerceBoolean(req.body.showOnPublic);
        }
        if (req.body.isCore !== undefined) {
            data.isCore = coerceBoolean(req.body.isCore);
        }

        if (data.isCore === true && !photo.isCore) {
            const coreCount = await prisma.projectPhoto.count({
                where: {
                    projectId: photo.projectId,
                    isActive: true,
                    isCore: true,
                    id: { not: id },
                },
            });
            if (coreCount >= MAX_CORE_PHOTOS_PER_PROJECT) {
                return res.status(400).json({
                    error: 'Maximum of 10 core photos per project',
                });
            }
        }

        const updated = await prisma.projectPhoto.update({
            where: { id },
            data,
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('PATCH /project-photos/:id', error);
        res.status(500).json({ error: 'Failed to update photo' });
    }
});

// ============================================
// DELETE /api/project-photos/:id
// Soft-delete photo and best-effort remove from GitHub
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

        const photo = await prisma.projectPhoto.findUnique({ where: { id } });
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        if (!(await ensureCanManageProjectPhotos(res, req, photo.projectId))) return;

        await prisma.projectPhoto.update({
            where: { id },
            data: { isActive: false },
        });

        try {
            await githubStorage.deleteFile(photo.githubPath, photo.githubSha);
        } catch (ghErr) {
            console.error('GitHub delete failed (DB row already soft-deleted):', ghErr.message);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('DELETE /project-photos/:id', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// ============================================
// POST /api/project-photos/:id/restore
// Restore a soft-deleted photo from GitHub history
// ============================================
router.post('/:id/restore', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

        const photo = await prisma.projectPhoto.findUnique({ where: { id } });
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        if (photo.isActive) return res.status(400).json({ error: 'Photo is not deleted' });
        if (!(await ensureCanManageProjectPhotos(res, req, photo.projectId))) return;

        const ghResult = await githubStorage.restoreDeletedFile(photo.githubPath);

        const restored = await prisma.projectPhoto.update({
            where: { id },
            data: {
                isActive: true,
                githubSha: ghResult.githubSha,
            },
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.json(restored);
    } catch (error) {
        console.error('POST /project-photos/:id/restore', error);
        res.status(500).json({ error: error.message || 'Failed to restore photo' });
    }
});

export default router;
