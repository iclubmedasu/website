import express from 'express';
import { prisma } from '../db';

const router: any = express.Router();

function requireMemberId(req: any, res: any): number | null {
    const memberId = req.user?.memberId;
    if (!memberId) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    return memberId;
}

// ============================================
// POST /api/push-subscriptions
// Body: { endpoint, keys: { p256dh, auth }, userAgent? }
// ============================================
router.post('/', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;

        const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
        const p256dh = typeof req.body?.keys?.p256dh === 'string' ? req.body.keys.p256dh.trim() : '';
        const auth = typeof req.body?.keys?.auth === 'string' ? req.body.keys.auth.trim() : '';
        const userAgent = typeof req.body?.userAgent === 'string'
            ? req.body.userAgent.trim().slice(0, 512)
            : (typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 512) : null);

        if (!endpoint || !p256dh || !auth) {
            return res.status(400).json({ error: 'endpoint, keys.p256dh, and keys.auth are required' });
        }

        const db = prisma as any;
        const subscription = await db.pushSubscription.upsert({
            where: { endpoint },
            create: {
                memberId,
                endpoint,
                p256dh,
                auth,
                userAgent,
            },
            update: {
                memberId,
                p256dh,
                auth,
                userAgent,
            },
            select: {
                id: true,
                memberId: true,
                endpoint: true,
                createdAt: true,
            },
        });

        return res.status(201).json({ subscription });
    } catch (error) {
        console.error('POST /push-subscriptions', error);
        return res.status(500).json({ error: 'Failed to save push subscription' });
    }
});

// ============================================
// DELETE /api/push-subscriptions
// Body: { endpoint }
// ============================================
router.delete('/', async (req, res) => {
    try {
        const memberId = requireMemberId(req, res);
        if (!memberId) return;

        const endpoint = typeof req.body?.endpoint === 'string'
            ? req.body.endpoint.trim()
            : (typeof req.query?.endpoint === 'string' ? String(req.query.endpoint).trim() : '');

        if (!endpoint) {
            return res.status(400).json({ error: 'endpoint is required' });
        }

        const db = prisma as any;
        const existing = await db.pushSubscription.findFirst({
            where: {
                endpoint,
                memberId,
            },
            select: { id: true },
        });

        if (!existing) {
            return res.status(404).json({ error: 'Push subscription not found' });
        }

        await db.pushSubscription.delete({
            where: { id: existing.id },
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('DELETE /push-subscriptions', error);
        return res.status(500).json({ error: 'Failed to delete push subscription' });
    }
});

export default router;
