import express from 'express';
import multer from 'multer';
import { prisma } from '../db';
import * as githubStorage from '../services/githubStorageService';
import { extractAuthToken, JWT_SECRET } from '../middleware/auth';
import {
    canUserViewEvent,
    canUserAccessEventOperations,
} from '../lib/eventPermissions';
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

function buildPhotoGithubPath(eventId, eventDay, originalFileName) {
    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const daySegment = eventDay
        ? String(eventDay).slice(0, 10) // YYYY-MM-DD from Date/ISO string
        : 'undated';
    return `events/${eventId}/photos/${daySegment}/${uuidv4()}-${safeName}`;
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
 * Can the user manage photos (delete/rename/restore)?
 * Anyone who can view the event may manage photos.
 */
async function canUserManageEventPhotos(req, eventId) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isArchived: true },
    });
    if (!event) return false;

    return canUserAccessEventOperations(req.user, eventId, event.isArchived);
}

async function ensureCanManageEventPhotos(res, req, eventId) {
    if (!(await canUserManageEventPhotos(req, eventId))) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }
    return true;
}

const uploadedBySelect = {
    select: { id: true, fullName: true, profilePhotoUrl: true },
};

// ============================================
// GET /api/event-photos?eventId=X[&eventDay=YYYY-MM-DD][&includeInactive=true]
// ============================================
router.get('/', async (req, res) => {
    try {
        const { eventId, eventDay, includeInactive } = req.query;
        if (!eventId) return res.status(400).json({ error: 'eventId is required' });

        const parsedEventId = parseInt(eventId);
        if (Number.isNaN(parsedEventId)) return res.status(400).json({ error: 'Invalid event ID' });

        if (!(await ensureCanViewEvent(res, req.user, parsedEventId))) return;

        const photos = await prisma.eventPhoto.findMany({
            where: {
                eventId: parsedEventId,
                ...(String(includeInactive).toLowerCase() === 'true' ? {} : { isActive: true }),
                ...(eventDay ? { eventDay: new Date(String(eventDay)) } : {}),
            },
            orderBy: [{ eventDay: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.json(photos);
    } catch (error) {
        console.error('GET /event-photos', error);
        res.status(500).json({ error: 'Failed to fetch event photos' });
    }
});

// ============================================
// POST /api/event-photos/upload
// Upload a photo to GitHub and store metadata (always create)
// ============================================
router.post('/upload', upload.single('photo'), async (req, res) => {
    try {
        const { eventId, uploadedByMemberId, eventDay, caption } = req.body;

        if (!eventId || !uploadedByMemberId) {
            return res.status(400).json({ error: 'eventId and uploadedByMemberId are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const parsedEventId = parseInt(eventId);
        if (Number.isNaN(parsedEventId)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
            return res.status(400).json({ error: 'Only JPEG, PNG, WebP, and HEIC images are allowed' });
        }

        if (!(await canUserUploadToEvent(req, parsedEventId))) {
            return res.status(403).json({ error: 'You do not have permission to upload photos to this event' });
        }

        const githubPath = buildPhotoGithubPath(parsedEventId, eventDay || null, req.file.originalname);
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
            console.error('POST /event-photos/upload preview failed (saving original only):', previewErr);
        }

        const photo = await prisma.eventPhoto.create({
            data: {
                eventId: parsedEventId,
                uploadedByMemberId: parseInt(uploadedByMemberId),
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                githubPath: ghResult.githubPath,
                githubSha: ghResult.githubSha,
                ...previewFields,
                ...(eventDay ? { eventDay: new Date(String(eventDay)) } : {}),
                ...(caption !== undefined && caption !== null ? { caption: String(caption) } : {}),
            },
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.status(201).json(photo);
    } catch (error) {
        console.error('POST /event-photos/upload', error);
        res.status(500).json({ error: error.message || 'Failed to upload photo' });
    }
});

// ============================================
// GET /api/event-photos/:id/download
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

        const photo = await prisma.eventPhoto.findUnique({ where: { id } });
        if (!photo || !photo.isActive) return res.status(404).json({ error: 'Photo not found' });

        if (!(await ensureCanViewEvent(res, user, photo.eventId))) return;

        const ghResponse = await githubStorage.downloadFile(photo.githubPath);

        res.setHeader('Content-Type', photo.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${photo.fileName}"`);
        if (photo.fileSize) res.setHeader('Content-Length', photo.fileSize);

        await pipeGithubBodyToResponse(ghResponse, res);
    } catch (error) {
        console.error('GET /event-photos/:id/download', error);
        res.status(500).json({ error: 'Failed to download photo' });
    }
});

const MAX_CORE_PHOTOS_PER_EVENT = 10;

function coerceBoolean(value) {
    return value === true || value === 'true';
}

// ============================================
// PATCH /api/event-photos/:id
// Update caption, eventDay, order, showOnPublic, and/or isCore
// ============================================
router.patch('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

        const photo = await prisma.eventPhoto.findUnique({ where: { id } });
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        if (!(await ensureCanManageEventPhotos(res, req, photo.eventId))) return;

        const data: any = {};
        if (req.body.caption !== undefined) data.caption = req.body.caption;
        if (req.body.eventDay !== undefined) {
            data.eventDay = req.body.eventDay === null || req.body.eventDay === ''
                ? null
                : new Date(String(req.body.eventDay));
        }
        if (req.body.order !== undefined) data.order = parseInt(req.body.order);
        if (req.body.showOnPublic !== undefined) {
            data.showOnPublic = coerceBoolean(req.body.showOnPublic);
        }
        if (req.body.isCore !== undefined) {
            data.isCore = coerceBoolean(req.body.isCore);
        }

        if (data.isCore === true && !photo.isCore) {
            const coreCount = await prisma.eventPhoto.count({
                where: {
                    eventId: photo.eventId,
                    isActive: true,
                    isCore: true,
                    id: { not: id },
                },
            });
            if (coreCount >= MAX_CORE_PHOTOS_PER_EVENT) {
                return res.status(400).json({
                    error: 'Maximum of 10 core photos per event',
                });
            }
        }

        const updated = await prisma.eventPhoto.update({
            where: { id },
            data,
            include: {
                uploadedBy: uploadedBySelect,
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('PATCH /event-photos/:id', error);
        res.status(500).json({ error: 'Failed to update photo' });
    }
});

// ============================================
// DELETE /api/event-photos/:id
// Soft-delete photo and best-effort remove from GitHub
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

        const photo = await prisma.eventPhoto.findUnique({ where: { id } });
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        if (!(await ensureCanManageEventPhotos(res, req, photo.eventId))) return;

        await prisma.eventPhoto.update({
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
        console.error('DELETE /event-photos/:id', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// ============================================
// POST /api/event-photos/:id/restore
// Restore a soft-deleted photo from GitHub history
// ============================================
router.post('/:id/restore', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid photo ID' });

        const photo = await prisma.eventPhoto.findUnique({ where: { id } });
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        if (photo.isActive) return res.status(400).json({ error: 'Photo is not deleted' });
        if (!(await ensureCanManageEventPhotos(res, req, photo.eventId))) return;

        const ghResult = await githubStorage.restoreDeletedFile(photo.githubPath);

        const restored = await prisma.eventPhoto.update({
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
        console.error('POST /event-photos/:id/restore', error);
        res.status(500).json({ error: error.message || 'Failed to restore photo' });
    }
});

export default router;
