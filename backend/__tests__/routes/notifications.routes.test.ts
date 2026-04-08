import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const notificationServiceMocks = vi.hoisted(() => ({
    listNotificationsForMember: vi.fn(),
    getUnreadNotificationsCount: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    markNotificationAsRead: vi.fn()
}))

vi.mock('../../services/notificationService', () => notificationServiceMocks)

import notificationsRouter from '../../routes/notifications'

describe('notifications routes integration', () => {
    beforeEach(() => {
        notificationServiceMocks.listNotificationsForMember.mockResolvedValue({
            notifications: [],
            nextCursor: null
        })
        notificationServiceMocks.getUnreadNotificationsCount.mockResolvedValue(0)
        notificationServiceMocks.markAllNotificationsAsRead.mockResolvedValue(0)
        notificationServiceMocks.markNotificationAsRead.mockResolvedValue(null)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('lists notifications for authenticated user', async () => {
        notificationServiceMocks.listNotificationsForMember.mockResolvedValueOnce({
            notifications: [
                {
                    id: 7,
                    memberId: 1,
                    eventId: 3,
                    eventType: 'TASK_ASSIGNED',
                    title: 'Task Assigned',
                    body: 'You were assigned to Task A.',
                    metadata: { taskId: 9 },
                    isRead: false,
                    readAt: null,
                    createdAt: '2026-04-08T00:00:00.000Z'
                }
            ],
            nextCursor: null
        })

        const response = await request(buildRouteApp(notificationsRouter, { memberId: 1 }))
            .get('/')
            .query({ unreadOnly: 'true', limit: 20 })

        expect(response.status).toBe(200)
        expect(response.body.notifications).toHaveLength(1)
        expect(notificationServiceMocks.listNotificationsForMember).toHaveBeenCalledWith(1, {
            cursor: undefined,
            limit: 20,
            unreadOnly: true
        })
    })

    it('returns unread count for authenticated user', async () => {
        notificationServiceMocks.getUnreadNotificationsCount.mockResolvedValueOnce(4)

        const response = await request(buildRouteApp(notificationsRouter, { memberId: 1 }))
            .get('/unread-count')

        expect(response.status).toBe(200)
        expect(response.body.unreadCount).toBe(4)
    })

    it('marks a notification as read', async () => {
        notificationServiceMocks.markNotificationAsRead.mockResolvedValueOnce({
            id: 12,
            memberId: 1,
            eventId: 3,
            eventType: 'TASK_ASSIGNED',
            title: 'Task Assigned',
            body: 'You were assigned to Task A.',
            metadata: { taskId: 9 },
            isRead: true,
            readAt: '2026-04-08T00:05:00.000Z',
            createdAt: '2026-04-08T00:00:00.000Z'
        })

        const response = await request(buildRouteApp(notificationsRouter, { memberId: 1 }))
            .patch('/12/read')

        expect(response.status).toBe(200)
        expect(response.body.notification.isRead).toBe(true)
        expect(notificationServiceMocks.markNotificationAsRead).toHaveBeenCalledWith(1, 12)
    })

    it('returns not found when marking unknown notification', async () => {
        notificationServiceMocks.markNotificationAsRead.mockResolvedValueOnce(null)

        const response = await request(buildRouteApp(notificationsRouter, { memberId: 1 }))
            .patch('/999/read')

        expect(response.status).toBe(404)
        expect(response.body.error).toContain('Notification not found')
    })

    it('marks all notifications as read', async () => {
        notificationServiceMocks.markAllNotificationsAsRead.mockResolvedValueOnce(5)

        const response = await request(buildRouteApp(notificationsRouter, { memberId: 1 }))
            .patch('/read-all')

        expect(response.status).toBe(200)
        expect(response.body.updatedCount).toBe(5)
        expect(notificationServiceMocks.markAllNotificationsAsRead).toHaveBeenCalledWith(1)
    })
})
