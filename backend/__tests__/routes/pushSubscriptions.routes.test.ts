import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    pushSubscriptionUpsert: vi.fn(),
    pushSubscriptionFindFirst: vi.fn(),
    pushSubscriptionDelete: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        pushSubscription: {
            upsert: prismaMocks.pushSubscriptionUpsert,
            findFirst: prismaMocks.pushSubscriptionFindFirst,
            delete: prismaMocks.pushSubscriptionDelete,
        },
    },
}))

import pushSubscriptionsRouter from '../../routes/pushSubscriptions'

describe('push subscriptions routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('upserts a push subscription for the authenticated member', async () => {
        const createdAt = new Date('2026-07-30T00:00:00.000Z')
        prismaMocks.pushSubscriptionUpsert.mockResolvedValue({
            id: 1,
            memberId: 7,
            endpoint: 'https://push.example/sub-1',
            createdAt,
        })

        const app = buildRouteApp(pushSubscriptionsRouter, { memberId: 7 })
        const res = await request(app)
            .post('/')
            .send({
                endpoint: 'https://push.example/sub-1',
                keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
                userAgent: 'TestAgent/1.0',
            })

        expect(res.status).toBe(201)
        expect(res.body.subscription).toEqual({
            id: 1,
            memberId: 7,
            endpoint: 'https://push.example/sub-1',
            createdAt: createdAt.toISOString(),
        })
        expect(prismaMocks.pushSubscriptionUpsert).toHaveBeenCalledWith({
            where: { endpoint: 'https://push.example/sub-1' },
            create: {
                memberId: 7,
                endpoint: 'https://push.example/sub-1',
                p256dh: 'p256dh-key',
                auth: 'auth-key',
                userAgent: 'TestAgent/1.0',
            },
            update: {
                memberId: 7,
                p256dh: 'p256dh-key',
                auth: 'auth-key',
                userAgent: 'TestAgent/1.0',
            },
            select: {
                id: true,
                memberId: true,
                endpoint: true,
                createdAt: true,
            },
        })
    })

    it('returns 400 when subscription keys are missing', async () => {
        const app = buildRouteApp(pushSubscriptionsRouter, { memberId: 7 })
        const res = await request(app)
            .post('/')
            .send({ endpoint: 'https://push.example/sub-1' })

        expect(res.status).toBe(400)
        expect(prismaMocks.pushSubscriptionUpsert).not.toHaveBeenCalled()
    })

    it('deletes an existing subscription by endpoint', async () => {
        prismaMocks.pushSubscriptionFindFirst.mockResolvedValue({ id: 3 })
        prismaMocks.pushSubscriptionDelete.mockResolvedValue({ id: 3 })

        const app = buildRouteApp(pushSubscriptionsRouter, { memberId: 7 })
        const res = await request(app)
            .delete('/')
            .send({ endpoint: 'https://push.example/sub-1' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ success: true })
        expect(prismaMocks.pushSubscriptionFindFirst).toHaveBeenCalledWith({
            where: {
                endpoint: 'https://push.example/sub-1',
                memberId: 7,
            },
            select: { id: true },
        })
        expect(prismaMocks.pushSubscriptionDelete).toHaveBeenCalledWith({
            where: { id: 3 },
        })
    })

    it('returns 404 when unsubscribing an unknown endpoint', async () => {
        prismaMocks.pushSubscriptionFindFirst.mockResolvedValue(null)

        const app = buildRouteApp(pushSubscriptionsRouter, { memberId: 7 })
        const res = await request(app)
            .delete('/')
            .send({ endpoint: 'https://push.example/missing' })

        expect(res.status).toBe(404)
        expect(prismaMocks.pushSubscriptionDelete).not.toHaveBeenCalled()
    })
})
