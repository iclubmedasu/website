import express, { Request, Response } from 'express';
import { prisma } from '../db';
import {
    ADMINISTRATION_TEAM_NAME,
    ADMIN_SYSTEM_ROLE_KEY,
} from '../lib/authorityFlags';
import {
    canMemberGrantDocument,
    canMemberViewDocument,
    getMemberDocumentRank,
    getMemberTeamIds,
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

/**
 * Recipients for access-request notifications (not every viewer):
 * - Always include active Administration org leadership (Officer / President / VP)
 * - If document.scopeTeamId set: also active Head/Vice on that team
 * - Deduplicate; exclude the requester
 */
async function resolveDocumentGrantReviewerIds(
    document: { scopeTeamId: number | null },
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

    if (document.scopeTeamId != null) {
        const leadershipMemberships = await prisma.teamMember.findMany({
            where: {
                isActive: true,
                teamId: document.scopeTeamId,
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

// GET /api/documents/access-requests?status=PENDING
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

        const requests = await prisma.documentAccessRequest.findMany({
            where: { status },
            include: {
                document: {
                    select: {
                        id: true,
                        title: true,
                        fileType: true,
                        categoryId: true,
                        creatorRank: true,
                        category: { select: { id: true, name: true } },
                    },
                },
                member: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const visible: typeof requests = [];
        for (const request of requests) {
            if (await canMemberGrantDocument(memberId, request.documentId, authOptions(req))) {
                visible.push(request);
            }
        }

        return res.json(visible);
    } catch (error) {
        console.error('GET /documents/access-requests', error);
        return res.status(500).json({ error: 'Failed to fetch access requests' });
    }
});

// PATCH /api/documents/access-requests/:id/approve
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

        const accessRequest = await prisma.documentAccessRequest.findUnique({
            where: { id: requestId },
        });
        if (!accessRequest) {
            return res.status(404).json({ error: 'Access request not found' });
        }
        if (accessRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'Access request is not pending' });
        }

        if (!(await canMemberGrantDocument(reviewerId, accessRequest.documentId, authOptions(req)))) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const ledTeamIds = await getMemberTeamIds(accessRequest.memberId);
        if (ledTeamIds.length === 0) {
            return res.status(400).json({
                error: 'Requester has no Head/Vice team to grant; cannot approve',
            });
        }

        const now = new Date();
        const result = await prisma.$transaction(async (tx) => {
            const grants: Awaited<ReturnType<typeof tx.documentAccessGrant.create>>[] = [];
            for (const teamId of ledTeamIds) {
                const existing = await tx.documentAccessGrant.findFirst({
                    where: {
                        documentId: accessRequest.documentId,
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
                    const updatedGrant = await tx.documentAccessGrant.update({
                        where: { id: existing.id },
                        data: {
                            expiresAt,
                            grantedById: reviewerId,
                        },
                    });
                    grants.push(updatedGrant);
                } else {
                    const grant = await tx.documentAccessGrant.create({
                        data: {
                            documentId: accessRequest.documentId,
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

            const updated = await tx.documentAccessRequest.update({
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
        console.error('PATCH /documents/access-requests/:id/approve', error);
        return res.status(500).json({ error: 'Failed to approve access request' });
    }
});

// PATCH /api/documents/access-requests/:id/deny
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

        const accessRequest = await prisma.documentAccessRequest.findUnique({
            where: { id: requestId },
        });
        if (!accessRequest) {
            return res.status(404).json({ error: 'Access request not found' });
        }
        if (accessRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'Access request is not pending' });
        }

        if (!(await canMemberGrantDocument(reviewerId, accessRequest.documentId, authOptions(req)))) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const reviewNote =
            typeof req.body?.reviewNote === 'string' ? req.body.reviewNote.trim() || null : null;

        const updated = await prisma.documentAccessRequest.update({
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
        console.error('PATCH /documents/access-requests/:id/deny', error);
        return res.status(500).json({ error: 'Failed to deny access request' });
    }
});

// POST /api/documents/:id/access-requests
router.post('/:id/access-requests', async (req: Request, res: Response) => {
    try {
        const requesterId = req.user?.memberId;
        if (!requesterId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const documentId = parseId(req.params.id);
        if (!documentId) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const document = await prisma.document.findUnique({
            where: { id: documentId },
            select: { id: true, title: true, scopeTeamId: true },
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const rank = await getMemberDocumentRank(requesterId, authOptions(req));
        if (rank !== 'TEAM_LEADERSHIP') {
            return res.status(403).json({
                error: 'Only team Head/Vice can request document access',
            });
        }

        if (await canMemberViewDocument(requesterId, documentId, authOptions(req))) {
            return res.status(400).json({ error: 'You already have access to this document' });
        }

        const existingPending = await prisma.documentAccessRequest.findFirst({
            where: {
                documentId,
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

        const accessRequest = await prisma.documentAccessRequest.create({
            data: {
                documentId,
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
            const reviewerIds = await resolveDocumentGrantReviewerIds(document, requesterId);
            await emitNotificationEvent({
                eventType: 'DOCUMENT_ACCESS_REQUESTED',
                audienceType: 'MEMBER',
                actorMemberId: requesterId,
                title: `Access requested: ${document.title}`,
                body: note
                    ? `${requesterName} requested team leadership access. Note: ${note}`
                    : `${requesterName} requested team leadership access.`,
                metadata: { documentId, accessRequestId: accessRequest.id },
                recipientMemberIds: reviewerIds,
                persistEventWhenNoRecipients: true,
            });
        } catch (notifyError) {
            console.error('DOCUMENT_ACCESS_REQUESTED notify', notifyError);
        }

        return res.status(201).json(accessRequest);
    } catch (error) {
        console.error('POST /documents/:id/access-requests', error);
        return res.status(500).json({ error: 'Failed to create access request' });
    }
});

// POST /api/documents/:id/grants
router.post('/:id/grants', async (req: Request, res: Response) => {
    try {
        const granterId = req.user?.memberId;
        if (!granterId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const documentId = parseId(req.params.id);
        if (!documentId) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const document = await prisma.document.findUnique({
            where: { id: documentId },
            select: { id: true },
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!(await canMemberGrantDocument(granterId, documentId, authOptions(req)))) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const target = await resolveGrantTarget(req.body ?? {}, res);
        if (!target) return;

        const ledTeamIds = await getMemberTeamIds(granterId);
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
        const existing = await prisma.documentAccessGrant.findFirst({
            where: {
                documentId,
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
            const grant = await prisma.documentAccessGrant.update({
                where: { id: existing.id },
                data: {
                    expiresAt,
                    grantedById: granterId,
                },
            });
            return res.json(grant);
        }

        const grant = await prisma.documentAccessGrant.create({
            data: {
                documentId,
                grantedToType: target.grantedToType,
                memberId: target.memberId,
                teamId: target.teamId,
                grantedById: granterId,
                expiresAt,
            },
        });

        return res.status(201).json(grant);
    } catch (error) {
        console.error('POST /documents/:id/grants', error);
        return res.status(500).json({ error: 'Failed to create grant' });
    }
});

// PATCH /api/documents/:id/grants/:grantId/revoke
router.patch('/:id/grants/:grantId/revoke', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const documentId = parseId(req.params.id);
        const grantId = parseId(req.params.grantId);
        if (!documentId || !grantId) {
            return res.status(400).json({ error: 'Invalid document or grant ID' });
        }

        if (!(await canMemberGrantDocument(memberId, documentId, authOptions(req)))) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const grant = await prisma.documentAccessGrant.findFirst({
            where: { id: grantId, documentId },
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

        const updated = await prisma.documentAccessGrant.update({
            where: { id: grantId },
            data: {
                revokedAt: now,
                revokedById: memberId,
            },
        });

        return res.json(updated);
    } catch (error) {
        console.error('PATCH /documents/:id/grants/:grantId/revoke', error);
        return res.status(500).json({ error: 'Failed to revoke grant' });
    }
});

// GET /api/documents/:id/grants
router.get('/:id/grants', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const documentId = parseId(req.params.id);
        if (!documentId) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const document = await prisma.document.findUnique({
            where: { id: documentId },
            select: { id: true },
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!(await canMemberGrantDocument(memberId, documentId, authOptions(req)))) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const grants = await prisma.documentAccessGrant.findMany({
            where: { documentId },
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
        console.error('GET /documents/:id/grants', error);
        return res.status(500).json({ error: 'Failed to fetch grants' });
    }
});

// GET /api/documents/:id/access-log?cursor=&limit=
router.get('/:id/access-log', async (req: Request, res: Response) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const documentId = parseId(req.params.id);
        if (!documentId) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        const document = await prisma.document.findUnique({
            where: { id: documentId },
            select: { id: true },
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!(await canMemberGrantDocument(memberId, documentId, authOptions(req)))) {
            return res.status(403).json({ error: 'Document access denied' });
        }

        const cursorRaw = req.query.cursor ? Number.parseInt(String(req.query.cursor), 10) : undefined;
        const cursor = cursorRaw != null && !Number.isNaN(cursorRaw) ? cursorRaw : undefined;

        const limitRaw = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
        const limit = Math.min(Math.max((limitRaw != null && !Number.isNaN(limitRaw) ? limitRaw : 20), 1), 100);

        const where: { documentId: number; id?: { lt: number } } = { documentId };
        if (cursor != null) {
            where.id = { lt: cursor };
        }

        const accessLogs = await prisma.documentAccessLog.findMany({
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
        console.error('GET /documents/:id/access-log', error);
        return res.status(500).json({ error: 'Failed to fetch access log' });
    }
});

export default router;
