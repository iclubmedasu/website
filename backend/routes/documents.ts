import express, { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../db';
import {
    canMemberGrantCategory,
    canMemberGrantDocument,
    canMemberViewDocument,
    getMemberDocumentRank,
    requireDocumentAccess,
    resolveScopeTeamId,
    type DocumentRank,
} from '../lib/documentPermissions';
import { pipeGithubBodyToResponse } from '../lib/pipeGithubResponse';
import {
    deleteFile,
    downloadFile,
    getCurrentFileSha,
    uploadContent,
} from '../services/githubStorageService';

const { v4: uuidv4 } = require('uuid') as { v4: () => string };
const router: any = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

type UploadRequest = Request & {
    file?: {
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
    };
    files?: Array<{
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
    }>;
};

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function authOptions(req: Request) {
    return { isDeveloper: !!req.user?.isDeveloper };
}

function sanitizeFileName(value: string): string {
    return (
        String(value || '')
            .trim()
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 'file'
    );
}

function buildDocumentGithubPath(documentId: number, originalFileName: string): string {
    const safeName = sanitizeFileName(originalFileName);
    return `documents/${documentId}/${uuidv4()}-${safeName}`;
}

function fileNameFromPath(fileUrl: string): string {
    const segment = fileUrl.split('/').pop() || 'document';
    const withoutUuid = segment.replace(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
        '',
    );
    return withoutUuid || segment;
}

function resolveUploadBytes(req: UploadRequest): {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
} | null {
    if (req.file?.buffer?.length) {
        return {
            buffer: req.file.buffer,
            fileName: req.file.originalname || 'file',
            mimeType: req.file.mimetype || 'application/octet-stream',
        };
    }

    const fileBase64 = typeof req.body?.fileBase64 === 'string' ? req.body.fileBase64.trim() : '';
    if (!fileBase64) return null;

    const buffer = Buffer.from(fileBase64, 'base64');
    if (!buffer.length) return null;

    const fileName =
        typeof req.body?.fileName === 'string' && req.body.fileName.trim()
            ? req.body.fileName.trim()
            : 'file';
    const mimeType =
        typeof req.body?.mimeType === 'string' && req.body.mimeType.trim()
            ? req.body.mimeType.trim()
            : 'application/octet-stream';

    return { buffer, fileName, mimeType };
}

async function resolveCategoryId(
    categoryRaw: unknown,
    { required = false }: { required?: boolean } = {},
): Promise<{ categoryId: number | null; error?: string; status?: number }> {
    if (categoryRaw === undefined || categoryRaw === null || categoryRaw === '') {
        if (required) {
            return { categoryId: null, error: 'categoryId is required', status: 400 };
        }
        return { categoryId: null };
    }

    const categoryId = parseId(categoryRaw);
    if (!categoryId) {
        return { categoryId: null, error: 'Invalid categoryId', status: 400 };
    }

    const category = await prisma.documentCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
        return { categoryId: null, error: 'Category not found', status: 400 };
    }

    return { categoryId };
}

async function createDocumentWithFile(args: {
    memberId: number;
    rank: DocumentRank;
    title: string;
    categoryId: number | null;
    scopeTeamId: number | null;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
}) {
    const created = await prisma.document.create({
        data: {
            categoryId: args.categoryId,
            title: args.title,
            fileUrl: 'pending',
            fileType: 'application/octet-stream',
            fileSizeBytes: null,
            scopeTeamId: args.scopeTeamId,
            creatorRank: args.rank,
            uploadedById: args.memberId,
        },
    });

    try {
        const githubPath = buildDocumentGithubPath(created.id, args.fileName);
        await uploadContent(
            args.buffer,
            githubPath,
            `Upload document ${created.id}: ${args.fileName}`,
        );

        return prisma.document.update({
            where: { id: created.id },
            data: {
                fileUrl: githubPath,
                fileType: args.mimeType,
                fileSizeBytes: args.buffer.length,
            },
        });
    } catch (error) {
        await prisma.document.delete({ where: { id: created.id } }).catch(() => undefined);
        throw error;
    }
}

// GET /api/documents
router.get('/', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const rank = await getMemberDocumentRank(memberId, authOptions(req));
        if (rank == null) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const where: { categoryId?: number | null; scopeTeamId?: number } = {};

        const rootFlag = String(req.query.root ?? '').toLowerCase();
        if (rootFlag === '1' || rootFlag === 'true') {
            where.categoryId = null;
        } else if (req.query.categoryId !== undefined) {
            const raw = String(req.query.categoryId);
            if (raw === '' || raw.toLowerCase() === 'null') {
                where.categoryId = null;
            } else {
                const categoryId = parseId(req.query.categoryId);
                if (!categoryId) {
                    return res.status(400).json({ error: 'Invalid categoryId' });
                }
                where.categoryId = categoryId;
            }
        }

        if (req.query.scopeTeamId !== undefined) {
            const scopeTeamId = parseId(req.query.scopeTeamId);
            if (!scopeTeamId) {
                return res.status(400).json({ error: 'Invalid scopeTeamId' });
            }
            where.scopeTeamId = scopeTeamId;
        }

        const documents = await prisma.document.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        const opts = authOptions(req);
        // Inside a folder: omit non-viewable docs (no locked stubs). Root keeps stubs for request-access UX.
        const omitLocked = typeof where.categoryId === 'number';
        const payload = (
            await Promise.all(
                documents.map(async (doc) => {
                    const canView = await canMemberViewDocument(memberId, doc.id, opts);
                    if (!canView) {
                        if (omitLocked) return null;
                        return {
                            id: doc.id,
                            title: doc.title,
                            categoryId: doc.categoryId,
                            locked: true as const,
                        };
                    }
                    const canManageAccess = await canMemberGrantDocument(memberId, doc.id, opts);
                    return {
                        ...doc,
                        canManageAccess,
                    };
                }),
            )
        ).filter((item): item is NonNullable<typeof item> => item != null);

        return res.json(payload);
    } catch (error) {
        console.error('GET /documents', error);
        return res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// GET /api/documents/:id/download
router.get('/:id/download', requireDocumentAccess, async (req: Request, res: Response) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        void prisma.documentAccessLog
            .create({
                data: { documentId: id, memberId, action: 'DOWNLOAD' },
            })
            .catch((err) => console.error('document DOWNLOAD log', err));

        const ghResponse = await downloadFile(doc.fileUrl);
        const fileName = fileNameFromPath(doc.fileUrl);

        res.setHeader('Content-Type', doc.fileType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        if (doc.fileSizeBytes) {
            res.setHeader('Content-Length', doc.fileSizeBytes);
        }

        await pipeGithubBodyToResponse(ghResponse, res);
        return;
    } catch (error) {
        console.error('GET /documents/:id/download', error);
        return res.status(500).json({ error: 'Failed to download document' });
    }
});

// GET /api/documents/:id
router.get('/:id', requireDocumentAccess, async (req: Request, res: Response) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const doc = await prisma.document.findUnique({
            where: { id },
            include: {
                category: { select: { id: true, name: true } },
                uploadedBy: { select: { id: true, fullName: true } },
            },
        });
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        void prisma.documentAccessLog
            .create({
                data: { documentId: id, memberId, action: 'VIEW' },
            })
            .catch((err) => console.error('document VIEW log', err));

        const canManageAccess = await canMemberGrantDocument(memberId, id, authOptions(req));
        return res.json({
            ...doc,
            canManageAccess,
        });
    } catch (error) {
        console.error('GET /documents/:id', error);
        return res.status(500).json({ error: 'Failed to fetch document' });
    }
});

// POST /api/documents  (single file; categoryId optional for root)
router.post('/', upload.single('file'), async (req: UploadRequest, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const rank = await getMemberDocumentRank(memberId, authOptions(req));
        if (!rank) {
            return res.status(403).json({
                error: 'Document upload requires org or team leadership rank',
            });
        }

        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        if (!title) {
            return res.status(400).json({ error: 'title is required' });
        }

        const categoryResult = await resolveCategoryId(req.body?.categoryId);
        if (categoryResult.error) {
            return res.status(categoryResult.status ?? 400).json({ error: categoryResult.error });
        }

        if (
            categoryResult.categoryId != null
            && !(await canMemberGrantCategory(memberId, categoryResult.categoryId, authOptions(req)))
        ) {
            return res.status(403).json({ error: 'Not authorised to upload into this folder' });
        }

        const uploadBytes = resolveUploadBytes(req);
        if (!uploadBytes) {
            return res.status(400).json({ error: 'file or fileBase64 is required' });
        }

        const scopeResult = await resolveScopeTeamId(memberId, rank, req.body?.scopeTeamId);
        if (scopeResult.error) {
            return res.status(scopeResult.status ?? 400).json({ error: scopeResult.error });
        }

        const updated = await createDocumentWithFile({
            memberId,
            rank,
            title,
            categoryId: categoryResult.categoryId,
            scopeTeamId: scopeResult.scopeTeamId,
            buffer: uploadBytes.buffer,
            fileName: uploadBytes.fileName,
            mimeType: uploadBytes.mimeType,
        });

        return res.status(201).json(updated);
    } catch (error) {
        console.error('POST /documents', error);
        return res.status(500).json({ error: 'Failed to create document' });
    }
});

// POST /api/documents/batch  (multipart files[])
router.post('/batch', upload.array('files', 20), async (req: UploadRequest, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const rank = await getMemberDocumentRank(memberId, authOptions(req));
        if (!rank) {
            return res.status(403).json({
                error: 'Document upload requires org or team leadership rank',
            });
        }

        const categoryResult = await resolveCategoryId(req.body?.categoryId);
        if (categoryResult.error) {
            return res.status(categoryResult.status ?? 400).json({ error: categoryResult.error });
        }

        if (
            categoryResult.categoryId != null
            && !(await canMemberGrantCategory(memberId, categoryResult.categoryId, authOptions(req)))
        ) {
            return res.status(403).json({ error: 'Not authorised to upload into this folder' });
        }

        const scopeResult = await resolveScopeTeamId(memberId, rank, req.body?.scopeTeamId);
        if (scopeResult.error) {
            return res.status(scopeResult.status ?? 400).json({ error: scopeResult.error });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length === 0) {
            return res.status(400).json({ error: 'files are required' });
        }

        const titlesRaw = req.body?.titles;
        let titles: string[] = [];
        if (typeof titlesRaw === 'string') {
            try {
                const parsed = JSON.parse(titlesRaw);
                titles = Array.isArray(parsed) ? parsed.map((t) => String(t ?? '')) : [];
            } catch {
                titles = [titlesRaw];
            }
        } else if (Array.isArray(titlesRaw)) {
            titles = titlesRaw.map((t) => String(t ?? ''));
        }

        const created: Awaited<ReturnType<typeof createDocumentWithFile>>[] = [];
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const fallbackTitle = (file.originalname || 'file').replace(/\.[^.]+$/, '');
            const title = (titles[i] ?? '').trim() || fallbackTitle;
            const doc = await createDocumentWithFile({
                memberId,
                rank,
                title,
                categoryId: categoryResult.categoryId,
                scopeTeamId: scopeResult.scopeTeamId,
                buffer: file.buffer,
                fileName: file.originalname || 'file',
                mimeType: file.mimetype || 'application/octet-stream',
            });
            created.push(doc);
        }

        return res.status(201).json(created);
    } catch (error) {
        console.error('POST /documents/batch', error);
        return res.status(500).json({ error: 'Failed to create documents' });
    }
});

async function updateDocumentHandler(req: Request, res: Response) {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const existing = await prisma.document.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!(await canMemberGrantDocument(memberId, id, authOptions(req)))) {
            return res.status(403).json({ error: 'Not authorised to update this document' });
        }

        const data: { title?: string; categoryId?: number | null } = {};

        if (req.body?.title !== undefined) {
            const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
            if (!title) {
                return res.status(400).json({ error: 'title cannot be empty' });
            }
            data.title = title;
        }

        if (req.body?.categoryId !== undefined) {
            if (req.body.categoryId === null || req.body.categoryId === '') {
                data.categoryId = null;
            } else {
                const categoryResult = await resolveCategoryId(req.body.categoryId, {
                    required: true,
                });
                if (categoryResult.error) {
                    return res
                        .status(categoryResult.status ?? 400)
                        .json({ error: categoryResult.error });
                }
                if (
                    categoryResult.categoryId != null
                    && !(await canMemberGrantCategory(
                        memberId,
                        categoryResult.categoryId,
                        authOptions(req),
                    ))
                ) {
                    return res.status(403).json({
                        error: 'Not authorised to move into this folder',
                    });
                }
                data.categoryId = categoryResult.categoryId;
            }
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updated = await prisma.document.update({
            where: { id },
            data,
        });
        return res.json(updated);
    } catch (error) {
        console.error(`${req.method} /documents/:id`, error);
        return res.status(500).json({ error: 'Failed to update document' });
    }
}

// PUT /api/documents/:id  (title / move categoryId, including null for root)
router.put('/:id', updateDocumentHandler);
// PATCH /api/documents/:id  (same; preferred for drag-drop moves)
router.patch('/:id', updateDocumentHandler);

// DELETE /api/documents/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const existing = await prisma.document.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!(await canMemberGrantDocument(memberId, id, authOptions(req)))) {
            return res.status(403).json({ error: 'Not authorised to delete this document' });
        }

        if (existing.fileUrl && existing.fileUrl !== 'pending') {
            try {
                const sha = await getCurrentFileSha(existing.fileUrl);
                if (sha) {
                    await deleteFile(existing.fileUrl, sha);
                } else {
                    console.warn(
                        `DELETE /documents/${id}: no GitHub SHA for ${existing.fileUrl}; skipping storage delete`,
                    );
                }
            } catch (ghError) {
                console.warn(`DELETE /documents/${id}: failed to remove file from storage`, ghError);
            }
        }

        await prisma.document.delete({ where: { id } });
        return res.json({ success: true });
    } catch (error) {
        console.error('DELETE /documents/:id', error);
        return res.status(500).json({ error: 'Failed to delete document' });
    }
});

export default router;
