import express from 'express';
import {
    getUnreadNotificationsCount,
    listNotificationsForMember,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../services/notificationService';

const router: any = express.Router();

// ============================================
// GET /api/notifications
// Query: cursor?, limit?, unreadOnly?
// ============================================
router.get('/', async (req, res) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const cursor = req.query.cursor ? parseInt(String(req.query.cursor), 10) : undefined;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
        const unreadOnly = req.query.unreadOnly === 'true';

        const result = await listNotificationsForMember(memberId, {
            cursor: Number.isNaN(cursor) ? undefined : cursor,
            limit: Number.isNaN(limit) ? undefined : limit,
            unreadOnly,
        });

        return res.json(result);
    } catch (error) {
        console.error('GET /notifications', error);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// ============================================
// GET /api/notifications/unread-count
// ============================================
router.get('/unread-count', async (req, res) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const unreadCount = await getUnreadNotificationsCount(memberId);
        return res.json({ unreadCount });
    } catch (error) {
        console.error('GET /notifications/unread-count', error);
        return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// ============================================
// PATCH /api/notifications/read-all
// ============================================
router.patch('/read-all', async (req, res) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const updatedCount = await markAllNotificationsAsRead(memberId);
        return res.json({ updatedCount });
    } catch (error) {
        console.error('PATCH /notifications/read-all', error);
        return res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// ============================================
// PATCH /api/notifications/:id/read
// ============================================
router.patch('/:id/read', async (req, res) => {
    try {
        const memberId = req.user?.memberId;
        if (!memberId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const notificationId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(notificationId)) {
            return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const notification = await markNotificationAsRead(memberId, notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        return res.json({ notification });
    } catch (error) {
        console.error('PATCH /notifications/:id/read', error);
        return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

export default router;
