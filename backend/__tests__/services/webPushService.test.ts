import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    pushSubscriptionFindMany: vi.fn(),
    pushSubscriptionDelete: vi.fn(),
    notificationGroupBy: vi.fn(),
}))

const webPushMocks = vi.hoisted(() => ({
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        pushSubscription: {
            findMany: prismaMocks.pushSubscriptionFindMany,
            delete: prismaMocks.pushSubscriptionDelete,
        },
        notification: {
            groupBy: prismaMocks.notificationGroupBy,
        },
    },
}))

vi.mock('web-push', () => ({
    default: webPushMocks,
}))

import { resolvePushClickUrl, sendWebPushToMembers } from '../../services/webPushService'

describe('webPushService', () => {
    beforeEach(() => {
        process.env.VAPID_PUBLIC_KEY = 'public-key'
        process.env.VAPID_PRIVATE_KEY = 'private-key'
        process.env.VAPID_SUBJECT = 'mailto:test@example.com'
        prismaMocks.pushSubscriptionFindMany.mockResolvedValue([])
        prismaMocks.pushSubscriptionDelete.mockResolvedValue({ id: 1 })
        prismaMocks.notificationGroupBy.mockResolvedValue([])
        webPushMocks.sendNotification.mockResolvedValue({})
    })

    afterEach(() => {
        vi.clearAllMocks()
        delete process.env.VAPID_PUBLIC_KEY
        delete process.env.VAPID_PRIVATE_KEY
        delete process.env.VAPID_SUBJECT
    })

    it('maps ANNOUNCEMENT clicks to /dashboard and others to notifications', () => {
        expect(resolvePushClickUrl('ANNOUNCEMENT')).toBe('/dashboard')
        expect(resolvePushClickUrl('TASK_ASSIGNED')).toBe('/user#notifications')
    })

    it('sends push notifications for member subscriptions with badgeCount', async () => {
        prismaMocks.pushSubscriptionFindMany.mockResolvedValue([
            {
                id: 1,
                memberId: 10,
                endpoint: 'https://push.example/a',
                p256dh: 'p256dh-a',
                auth: 'auth-a',
            },
        ])
        prismaMocks.notificationGroupBy.mockResolvedValue([
            { memberId: 10, _count: { _all: 3 } },
        ])

        await sendWebPushToMembers([10], {
            title: 'Hello',
            body: 'World',
            eventType: 'TASK_ASSIGNED',
        })

        expect(webPushMocks.setVapidDetails).toHaveBeenCalledWith(
            'mailto:test@example.com',
            'public-key',
            'private-key',
        )
        expect(prismaMocks.notificationGroupBy).toHaveBeenCalledWith({
            by: ['memberId'],
            where: {
                memberId: { in: [10] },
                isRead: false,
            },
            _count: { _all: true },
        })
        expect(webPushMocks.sendNotification).toHaveBeenCalledWith(
            {
                endpoint: 'https://push.example/a',
                keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
            },
            JSON.stringify({
                title: 'Hello',
                body: 'World',
                eventType: 'TASK_ASSIGNED',
                url: '/user#notifications',
                badgeCount: 3,
            }),
        )
    })

    it('includes per-member badgeCount when members have different unread totals', async () => {
        prismaMocks.pushSubscriptionFindMany.mockResolvedValue([
            {
                id: 1,
                memberId: 10,
                endpoint: 'https://push.example/a',
                p256dh: 'p256dh-a',
                auth: 'auth-a',
            },
            {
                id: 2,
                memberId: 20,
                endpoint: 'https://push.example/b',
                p256dh: 'p256dh-b',
                auth: 'auth-b',
            },
        ])
        prismaMocks.notificationGroupBy.mockResolvedValue([
            { memberId: 10, _count: { _all: 1 } },
            { memberId: 20, _count: { _all: 5 } },
        ])

        await sendWebPushToMembers([10, 20], {
            title: 'Hello',
            body: 'World',
            eventType: 'TASK_ASSIGNED',
        })

        expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(2)
        expect(webPushMocks.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({ endpoint: 'https://push.example/a' }),
            JSON.stringify({
                title: 'Hello',
                body: 'World',
                eventType: 'TASK_ASSIGNED',
                url: '/user#notifications',
                badgeCount: 1,
            }),
        )
        expect(webPushMocks.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({ endpoint: 'https://push.example/b' }),
            JSON.stringify({
                title: 'Hello',
                body: 'World',
                eventType: 'TASK_ASSIGNED',
                url: '/user#notifications',
                badgeCount: 5,
            }),
        )
    })

    it('deletes stale subscriptions on 410 responses', async () => {
        prismaMocks.pushSubscriptionFindMany.mockResolvedValue([
            {
                id: 9,
                memberId: 10,
                endpoint: 'https://push.example/gone',
                p256dh: 'p256dh',
                auth: 'auth',
            },
        ])
        webPushMocks.sendNotification.mockRejectedValue({ statusCode: 410, message: 'Gone' })

        await sendWebPushToMembers([10], {
            title: 'Hello',
            body: 'World',
            eventType: 'ANNOUNCEMENT',
        })

        expect(prismaMocks.pushSubscriptionDelete).toHaveBeenCalledWith({
            where: { id: 9 },
        })
    })

    it('skips sending when VAPID keys are missing', async () => {
        delete process.env.VAPID_PUBLIC_KEY
        delete process.env.VAPID_PRIVATE_KEY

        await sendWebPushToMembers([10], {
            title: 'Hello',
            body: 'World',
            eventType: 'TASK_ASSIGNED',
        })

        expect(prismaMocks.pushSubscriptionFindMany).not.toHaveBeenCalled()
        expect(webPushMocks.sendNotification).not.toHaveBeenCalled()
    })
})
