import express, { Request, Response } from 'express';
import { prisma } from '../db';
import {
    ADMINISTRATION_TEAM_NAME,
    ADMIN_SYSTEM_ROLE_KEY,
} from '../lib/authorityFlags';
import {
    canMemberGrantCategory,
    canMemberViewCategory,
    getMemberDocumentRank,
    getMemberTeamIds,
    resolveScopeTeamId,
} from '../lib/documentPermissions';
import { emitNotificationEvent } from '../services/notificationService';

const router: any = express.Router();

const DURATION_PRESETS = new Set(['DAY', 'WEEK', 'MONTH', 'INDEFINITE']);
const GRANT_TARGET_TYPES = new Set(['TEAM']);

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function authOptions(req: Request) {
    return { isDeveloper: !!req.user?.isDeveloper };
}

function expiresAtFromPreset(preset: unknown): Date | null | undefined {
    if (preset === 'DAY') return new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    if (preset === 'WEEK') return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (preset === 'MONTH') return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (preset === 'INDEFINITE') return null;
    return undefined;
}

type GrantTarget = { grantedToType: 'TEAM'; memberId: null; teamId: number };

async function resolveGrantTarget(
    body: { grantedToType?: unknown; memberId?: unknown; teamId?: unknown },
    res: Response,
): Promise<GrantTarget | null> {
    const grantedToType = body?.grantedToType;
    if (grantedToType === 'MEMBER') {
        res.status(400).json({ error: 'MEMBER grants are not supported; use TEAM grants' });
        return null;
    }
    if (!GRANT_TARGET_TYPES.has(grantedToType as string)) {
        res.status(400).json({ error: 'Invalid grantedToType' });
        return null;
    }

    const teamId = parseId(body?.teamId);
    if (!teamId) {
        res.status(400).json({ error: 'teamId is required for TEAM grants' });
        return null;
    }
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true },
    });
    if (!team) {
        res.status(400).json({ error: 'Team not found' });
        return null;
    }
    return { grantedToType: 'TEAM', memberId: null, teamId };
}

async function requireCategoryGrantAccess(
    req: Request,
    res: Response,
): Promise<{ memberId: number; categoryId: number } | null> {
    const memberId = req.user?.memberId;
    if (!memberId) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }

    const categoryId = parseId(req.params.id);
    if (!categoryId) {
        res.status(400).json({ error: 'Invalid category ID' });
        return null;
    }

    const category = await prisma.documentCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
    });
    if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return null;
    }

    if (!(await canMemberGrantCategory(memberId, categoryId, authOptions(req)))) {
        res.status(403).json({ error: 'Category access denied' });
        return null;
    }

    return { memberId, categoryId };
}

/**
 * Recipients for category access-request notifications:
 * - Always include active Administration org leadership (Officer / President / VP)
 * - If category.scopeTeamId set: also active Head/Vice on that team
 * - Deduplicate; exclude the requester
 */
async function resolveCategoryGrantReviewerIds(
    category: { scopeTeamId: number | null },
    requesterId: number,
): Promise<number[]> {
    const officerMemberships = await prisma.teamMember.findMany({
        where: {
            isActive: true,
            team: { name: ADMINISTRATION_TEAM_NAME },
            OR: [
                { role: { roleName: 'Officer' } },
                { role: { roleName: 'President' } },
                { role: { roleName: 'Vice President' } },
                { role: { systemRoleKey: ADMIN_SYSTEM_ROLE_KEY.OFFICER } },
                { role: { systemRoleKey: ADMIN_SYSTEM_ROLE_KEY.PRESIDENT } },
                { role: { systemRoleKey: ADMIN_SYSTEM_ROLE_KEY.VICE_PRESIDENT } },
            ],
        },
        select: { memberId: true },
    });

    const ids = new Set<number>();
    for (const tm of officerMemberships) {
        if (tm.memberId !== requesterId) ids.add(tm.memberId);
    }

    if (category.scopeTeamId != null) {
        const leadershipMemberships = await prisma.teamMember.findMany({
            where: {
                isActive: true,
                teamId: category.scopeTeamId,
            },
            select: {
                memberId: true,
                team: { select: { name: true } },
                role: { select: { roleName: true, systemRoleKey: true } },
            },
        });

        for (const tm of leadershipMemberships) {
            if (tm.memberId === requesterId) continue;
            const inAdmin = tm.team?.name === ADMINISTRATION_TEAM_NAME;
            const roleName = tm.role?.roleName;
            const keyNum = tm.role?.systemRoleKey != null ? Number(tm.role.systemRoleKey) : null;
            const isLeadership =
                (!inAdmin && (keyNum === 1 || keyNum === 2))
                || (!inAdmin && (roleName === 'Head of Team' || roleName === 'Vice Head of Team'));
            if (isLeadership) ids.add(tm.memberId);
        }
    }

    return [...ids];
}

// GET /api/document-categories
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

        const categories = await prisma.documentCategory.findMany({
            orderBy: { order: 'asc' },
        });

        const opts = authOptions(req);
        const payload = await Promise.all(
            categories.map(async (category) => {
                const canView = await canMemberViewCategory(memberId, category.id, opts);
                if (!canView) {
                    return {
                        id: category.id,
                        name: category.name,
                        locked: true as const,
                    };
                }
                const canManageAccess = await canMemberGrantCategory(memberId, category.id, opts);
                return {
                    ...category,
                    canManageAccess,
                };
            }),
        );

        return res.json(payload);
    } catch (error) {
        console.error('GET /document-categories', error);
        return res.status(500).json({ error: 'Failed to fetch document categories' });
    }
});

// GET /api/document-categories/access-requests?status=PENDING
router.get('/access-requests', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const rank = await getMemberDocumentRank(memberId, authOptions(req));
        if (rank == null) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const status =
            typeof req.query.status === 'string' && req.query.status.trim()
                ? req.query.status.trim()
                : 'PENDING';

        const requests = await prisma.documentCategoryAccessRequest.findMany({
            where: { status },
            include: {
                category: true,
                member: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const visible: typeof requests = [];
        for (const request of requests) {
            if (await canMemberGrantCategory(memberId, request.categoryId, authOptions(req))) {
                visible.push(request);
            }
        }

        return res.json(visible);
    } catch (error) {
        console.error('GET /document-categories/access-requests', error);
        return res.status(500).json({ error: 'Failed to fetch category access requests' });
    }
});

// PATCH /api/document-categories/access-requests/:id/approve
router.patch('/access-requests/:id/approve', async (req: Request, res: Response) => {
    try {
        const reviewerId = req.user?.memberId;
        if (!reviewerId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const requestId = parseId(req.params.id);
        if (!requestId) {
            return res.status(400).json({ error: 'Invalid access request ID' });
        }

        const durationPreset = req.body?.durationPreset;
        if (!DURATION_PRESETS.has(durationPreset)) {
            return res.status(400).json({ error: 'Invalid durationPreset' });
        }
        const expiresAt = expiresAtFromPreset(durationPreset);
        if (expiresAt === undefined) {
            return res.status(400).json({ error: 'Invalid durationPreset' });
        }

        const accessRequest = await prisma.documentCategoryAccessRequest.findUnique({
            where: { id: requestId },
        });
        if (!accessRequest) {
            return res.status(404).json({ error: 'Access request not found' });
        }
        if (accessRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'Access request is not pending' });
        }

        if (!(await canMemberGrantCategory(reviewerId, accessRequest.categoryId, authOptions(req)))) {
            return res.status(403).json({ error: 'Category access denied' });
        }

        const ledTeamIds = await getMemberTeamIds(accessRequest.memberId);
        if (ledTeamIds.length === 0) {
            return res.status(400).json({
                error: 'Requester has no Head/Vice team to grant; cannot approve',
            });
        }

        const now = new Date();
        const result = await prisma.$transaction(async (tx) => {
            const grants: Array<{
                id: number;
                categoryId: number;
                grantedToType: string;
                memberId: number | null;
                teamId: number | null;
                grantedById: number;
                expiresAt: Date | null;
                revokedAt: Date | null;
                revokedById: number | null;
                createdAt: Date;
            }> = [];
            for (const teamId of ledTeamIds) {
                const existing = await tx.documentCategoryAccessGrant.findFirst({
                    where: {
                        categoryId: accessRequest.categoryId,
                        grantedToType: 'TEAM',
                        teamId,
                        revokedAt: null,
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: now } },
                        ],
                    },
                });
                if (existing) {
                    const updatedGrant = await tx.documentCategoryAccessGrant.update({
                        where: { id: existing.id },
                        data: {
                            expiresAt,
                            grantedById: reviewerId,
                        },
                    });
                    grants.push(updatedGrant);
                } else {
                    const grant = await tx.documentCategoryAccessGrant.create({
                        data: {
                            categoryId: accessRequest.categoryId,
                            grantedToType: 'TEAM',
                            memberId: null,
                            teamId,
                            grantedById: reviewerId,
                            expiresAt,
                        },
                    });
                    grants.push(grant);
                }
            }

            const updated = await tx.documentCategoryAccessRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    reviewedById: reviewerId,
                    reviewedAt: now,
                },
            });

            return { grants, request: updated };
        });

        return res.json(result);
    } catch (error) {
        console.error('PATCH /document-categories/access-requests/:id/approve', error);
        return res.status(500).json({ error: 'Failed to approve category access request' });
    }
});

// PATCH /api/document-categories/access-requests/:id/deny
router.patch('/access-requests/:id/deny', async (req: Request, res: Response) => {
    try {
        const reviewerId = req.user?.memberId;
        if (!reviewerId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const requestId = parseId(req.params.id);
        if (!requestId) {
            return res.status(400).json({ error: 'Invalid access request ID' });
        }

        const accessRequest = await prisma.documentCategoryAccessRequest.findUnique({
            where: { id: requestId },
        });
        if (!accessRequest) {
            return res.status(404).json({ error: 'Access request not found' });
        }
        if (accessRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'Access request is not pending' });
        }

        if (!(await canMemberGrantCategory(reviewerId, accessRequest.categoryId, authOptions(req)))) {
            return res.status(403).json({ error: 'Category access denied' });
        }

        const reviewNote =
            typeof req.body?.reviewNote === 'string' ? req.body.reviewNote.trim() || null : null;

        const updated = await prisma.documentCategoryAccessRequest.update({
            where: { id: requestId },
            data: {
                status: 'DENIED',
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                reviewNote,
            },
        });

        return res.json(updated);
    } catch (error) {
        console.error('PATCH /document-categories/access-requests/:id/deny', error);
        return res.status(500).json({ error: 'Failed to deny category access request' });
    }
});

// POST /api/document-categories  — anyone who can upload (org or team leadership)
router.post('/', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const rank = await getMemberDocumentRank(memberId, authOptions(req));
        if (rank == null) {
            return res.status(403).json({ error: 'Folder create requires org or team leadership' });
        }

        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const orderRaw = req.body?.order;
        const order =
            orderRaw === undefined || orderRaw === null || orderRaw === ''
                ? 0
                : Number(orderRaw);
        if (!Number.isFinite(order)) {
            return res.status(400).json({ error: 'order must be a number' });
        }

        const scopeResult = await resolveScopeTeamId(memberId, rank, req.body?.scopeTeamId);
        if (scopeResult.error) {
            return res.status(scopeResult.status ?? 400).json({ error: scopeResult.error });
        }

        const category = await prisma.documentCategory.create({
            data: {
                name,
                order,
                scopeTeamId: scopeResult.scopeTeamId,
            },
        });
        return res.status(201).json(category);
    } catch (error) {
        console.error('POST /document-categories', error);
        return res.status(500).json({ error: 'Failed to create document category' });
    }
});

// PUT /api/document-categories/:id — folder owner (or org admin override)
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }

        const existing = await prisma.documentCategory.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (!(await canMemberGrantCategory(memberId, id, authOptions(req)))) {
            return res.status(403).json({ error: 'Folder update requires ownership' });
        }

        const data: { name?: string; order?: number } = {};

        if (req.body?.name !== undefined) {
            const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
            if (!name) {
                return res.status(400).json({ error: 'name cannot be empty' });
            }
            data.name = name;
        }

        if (req.body?.order !== undefined) {
            const order = Number(req.body.order);
            if (!Number.isFinite(order)) {
                return res.status(400).json({ error: 'order must be a number' });
            }
            data.order = order;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const category = await prisma.documentCategory.update({
            where: { id },
            data,
        });
        return res.json(category);
    } catch (error) {
        console.error('PUT /document-categories/:id', error);
        return res.status(500).json({ error: 'Failed to update document category' });
    }
});

// DELETE /api/document-categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }

        const existing = await prisma.documentCategory.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (!(await canMemberGrantCategory(memberId, id, authOptions(req)))) {
            return res.status(403).json({ error: 'Folder delete requires ownership' });
        }

        const documentsCount = await prisma.document.count({ where: { categoryId: id } });
        if (documentsCount > 0) {
            return res.status(409).json({
                error: 'Category still has documents...',
            });
        }

        await prisma.documentCategory.delete({ where: { id } });
        return res.json({ success: true });
    } catch (error) {
        console.error('DELETE /document-categories/:id', error);
        return res.status(500).json({ error: 'Failed to delete document category' });
    }
});

// POST /api/document-categories/:id/access-requests
router.post('/:id/access-requests', async (req: Request, res: Response) => {
    try {
        const requesterId = req.user?.memberId;
        if (!requesterId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const categoryId = parseId(req.params.id);
        if (!categoryId) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }

        const category = await prisma.documentCategory.findUnique({
            where: { id: categoryId },
            select: { id: true, name: true, scopeTeamId: true },
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const rank = await getMemberDocumentRank(requesterId, authOptions(req));
        if (rank !== 'TEAM_LEADERSHIP') {
            return res.status(403).json({
                error: 'Only team Head/Vice can request folder access',
            });
        }

        if (await canMemberViewCategory(requesterId, categoryId, authOptions(req))) {
            return res.status(400).json({ error: 'You already have access to this folder' });
        }

        const existingPending = await prisma.documentCategoryAccessRequest.findFirst({
            where: {
                categoryId,
                memberId: requesterId,
                status: 'PENDING',
            },
            select: { id: true },
        });
        if (existingPending) {
            return res.status(409).json({ error: 'A pending access request already exists' });
        }

        const note =
            typeof req.body?.note === 'string' ? req.body.note.trim() || null : null;

        const accessRequest = await prisma.documentCategoryAccessRequest.create({
            data: {
                categoryId,
                memberId: requesterId,
                status: 'PENDING',
            },
        });

        const requester = await prisma.member.findUnique({
            where: { id: requesterId },
            select: { fullName: true },
        });
        const requesterName = requester?.fullName || 'A member';

        try {
            const reviewerIds = await resolveCategoryGrantReviewerIds(category, requesterId);
            await emitNotificationEvent({
                eventType: 'DOCUMENT_ACCESS_REQUESTED',
                audienceType: 'MEMBER',
                actorMemberId: requesterId,
                title: `Access requested: ${category.name}`,
                body: note
                    ? `${requesterName} requested team leadership access to folder. Note: ${note}`
                    : `${requesterName} requested team leadership access to folder.`,
                metadata: { categoryId, accessRequestId: accessRequest.id },
                recipientMemberIds: reviewerIds,
                persistEventWhenNoRecipients: true,
            });
        } catch (notifyError) {
            console.error('DOCUMENT_ACCESS_REQUESTED (category) notify', notifyError);
        }

        return res.status(201).json(accessRequest);
    } catch (error) {
        console.error('POST /document-categories/:id/access-requests', error);
        return res.status(500).json({ error: 'Failed to create category access request' });
    }
});

// GET /api/document-categories/:id/grants
router.get('/:id/grants', async (req: Request, res: Response) => {
    try {
        const access = await requireCategoryGrantAccess(req, res);
        if (!access) return;

        const grants = await prisma.documentCategoryAccessGrant.findMany({
            where: { categoryId: access.categoryId },
            include: {
                member: { select: { id: true, fullName: true } },
                team: { select: { id: true, name: true } },
                grantedBy: { select: { id: true, fullName: true } },
                revokedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return res.json(grants);
    } catch (error) {
        console.error('GET /document-categories/:id/grants', error);
        return res.status(500).json({ error: 'Failed to fetch category grants' });
    }
});

// POST /api/document-categories/:id/grants
router.post('/:id/grants', async (req: Request, res: Response) => {
    try {
        const access = await requireCategoryGrantAccess(req, res);
        if (!access) return;

        const target = await resolveGrantTarget(req.body ?? {}, res);
        if (!target) return;

        const ledTeamIds = await getMemberTeamIds(access.memberId);
        if (ledTeamIds.includes(target.teamId)) {
            return res.status(400).json({
                error: 'Cannot grant access to your own team',
            });
        }

        const durationPreset = req.body?.durationPreset;
        if (!DURATION_PRESETS.has(durationPreset)) {
            return res.status(400).json({ error: 'Invalid durationPreset' });
        }
        const expiresAt = expiresAtFromPreset(durationPreset);
        if (expiresAt === undefined) {
            return res.status(400).json({ error: 'Invalid durationPreset' });
        }

        const now = new Date();
        const existing = await prisma.documentCategoryAccessGrant.findFirst({
            where: {
                categoryId: access.categoryId,
                grantedToType: 'TEAM',
                teamId: target.teamId,
                revokedAt: null,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
        });

        if (existing) {
            const grant = await prisma.documentCategoryAccessGrant.update({
                where: { id: existing.id },
                data: {
                    expiresAt,
                    grantedById: access.memberId,
                },
            });
            return res.json(grant);
        }

        const grant = await prisma.documentCategoryAccessGrant.create({
            data: {
                categoryId: access.categoryId,
                grantedToType: target.grantedToType,
                memberId: target.memberId,
                teamId: target.teamId,
                grantedById: access.memberId,
                expiresAt,
            },
        });

        return res.status(201).json(grant);
    } catch (error) {
        console.error('POST /document-categories/:id/grants', error);
        return res.status(500).json({ error: 'Failed to create category grant' });
    }
});

// PATCH /api/document-categories/:id/grants/:grantId/revoke
router.patch('/:id/grants/:grantId/revoke', async (req: Request, res: Response) => {
    try {
        const access = await requireCategoryGrantAccess(req, res);
        if (!access) return;

        const grantId = parseId(req.params.grantId);
        if (!grantId) {
            return res.status(400).json({ error: 'Invalid grant ID' });
        }

        const grant = await prisma.documentCategoryAccessGrant.findFirst({
            where: { id: grantId, categoryId: access.categoryId },
        });
        if (!grant) {
            return res.status(404).json({ error: 'Grant not found' });
        }

        const now = new Date();
        if (grant.revokedAt != null) {
            return res.status(400).json({ error: 'Grant is already revoked' });
        }
        if (grant.expiresAt != null && grant.expiresAt <= now) {
            return res.status(400).json({ error: 'Grant is already expired' });
        }

        const updated = await prisma.documentCategoryAccessGrant.update({
            where: { id: grantId },
            data: {
                revokedAt: now,
                revokedById: access.memberId,
            },
        });

        return res.json(updated);
    } catch (error) {
        console.error('PATCH /document-categories/:id/grants/:grantId/revoke', error);
        return res.status(500).json({ error: 'Failed to revoke category grant' });
    }
});

// GET /api/document-categories/:id/access-log?cursor=&limit=
router.get('/:id/access-log', async (req: Request, res: Response) => {
    try {
        const access = await requireCategoryGrantAccess(req, res);
        if (!access) return;

        // Log folder open as VIEW when listing access log isn't ideal — clients should
        // POST a view via opening the folder. Keep read-only list here.
        const cursorRaw = req.query.cursor ? Number.parseInt(String(req.query.cursor), 10) : undefined;
        const cursor = cursorRaw != null && !Number.isNaN(cursorRaw) ? cursorRaw : undefined;

        const limitRaw = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
        const limit = Math.min(Math.max((limitRaw != null && !Number.isNaN(limitRaw) ? limitRaw : 20), 1), 100);

        const where: { categoryId: number; id?: { lt: number } } = {
            categoryId: access.categoryId,
        };
        if (cursor != null) {
            where.id = { lt: cursor };
        }

        const accessLogs = await prisma.documentCategoryAccessLog.findMany({
            where,
            include: {
                member: { select: { id: true, fullName: true } },
            },
            orderBy: { id: 'desc' },
            take: limit,
        });

        const nextCursor =
            accessLogs.length === limit ? accessLogs[accessLogs.length - 1]?.id ?? null : null;

        return res.json({ accessLogs, nextCursor });
    } catch (error) {
        console.error('GET /document-categories/:id/access-log', error);
        return res.status(500).json({ error: 'Failed to fetch category access log' });
    }
});

// POST /api/document-categories/:id/view-log — record folder open
router.post('/:id/view-log', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const categoryId = parseId(req.params.id);
        if (!categoryId) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }

        const category = await prisma.documentCategory.findUnique({
            where: { id: categoryId },
            select: { id: true },
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const log = await prisma.documentCategoryAccessLog.create({
            data: { categoryId, memberId, action: 'VIEW' },
        });

        return res.status(201).json(log);
    } catch (error) {
        console.error('POST /document-categories/:id/view-log', error);
        return res.status(500).json({ error: 'Failed to log category view' });
    }
});

export default router;
