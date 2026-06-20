import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    eventFindMany: vi.fn(),
    eventFindUnique: vi.fn(),
    eventUpdate: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventCreate: vi.fn()
}))

const eventCodeMocks = vi.hoisted(() => ({
    generateUniqueConfirmationCode: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        event: {
            findMany: prismaMocks.eventFindMany,
            findUnique: prismaMocks.eventFindUnique,
            update: prismaMocks.eventUpdate,
            create: prismaMocks.eventCreate
        },
        eventRegistration: {
            findFirst: prismaMocks.eventRegistrationFindFirst
        }
    }
}))

vi.mock('../../services/eventCode', () => eventCodeMocks)

import { JWT_SECRET, authenticateToken } from '../../middleware/auth'
import eventsRouter from '../../routes/events'

function createApp() {
    const app = express()
    app.use(express.json())
    app.use('/events', eventsRouter)
    return app
}

function createAuthedApp() {
    const app = express()
    app.use(express.json())
    app.use('/events', authenticateToken, eventsRouter)
    return app
}

function createToken(payload: Record<string, unknown>) {
    return jwt.sign(payload, JWT_SECRET)
}

describe('events routes auth wiring', () => {
    beforeEach(() => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null)
        prismaMocks.eventCreate.mockResolvedValue({
            id: 101,
            title: 'Launch Night'
        })
        eventCodeMocks.generateUniqueConfirmationCode.mockResolvedValue('CONFIRM-12345')
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('returns 401 when creating an event without a token', async () => {
        const response = await request(createApp())
            .post('/events')
            .send({
                title: 'Launch Night',
                eventDate: '2026-06-10T10:00:00.000Z'
            })

        expect(response.status).toBe(401)
        expect(response.body).toEqual({ error: 'Authentication required' })
        expect(prismaMocks.eventCreate).not.toHaveBeenCalled()
    })

    it('allows a privileged developer with a real member id to create an event', async () => {
        const token = createToken({
            memberId: 12,
            isDeveloper: true,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false
        })

        const response = await request(createApp())
            .post('/events')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Developer Event',
                description: 'Created from the portal',
                eventDate: '2026-06-10T10:00:00.000Z',
                projectTypeId: 3,
                priority: 'HIGH',
                status: 'NOT_STARTED',
                progressStatus: 'NOT_STARTED',
                teamIds: [{ teamId: 1, canEdit: true, isOwner: true }]
            })

        expect(response.status).toBe(201)
        expect(response.body).toEqual(expect.objectContaining({
            id: 101,
            title: 'Launch Night'
        }))
        expect(prismaMocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                title: 'Developer Event',
                createdByMemberId: 12,
                status: 'NOT_STARTED',
                projectTypeId: 3,
                priority: 'HIGH',
                status: 'NOT_STARTED',
                progressStatus: 'NOT_STARTED',
                eventTeams: {
                    create: [{ teamId: 1, canEdit: true, isOwner: true }]
                }
            })
        }))
    })

    it('requires projectTypeId when creating an event', async () => {
        const token = createToken({
            memberId: 12,
            isDeveloper: true,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false
        })

        const response = await request(createApp())
            .post('/events')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Missing Type Event',
                eventDate: '2026-06-10T10:00:00.000Z'
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'projectTypeId is required' })
        expect(prismaMocks.eventCreate).not.toHaveBeenCalled()
    })

    it('rejects a regular member from creating an event', async () => {
        const token = createToken({
            memberId: 13,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false
        })

        const response = await request(createApp())
            .post('/events')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Member Event',
                eventDate: '2026-06-10T10:00:00.000Z'
            })

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Event management access required' })
        expect(prismaMocks.eventCreate).not.toHaveBeenCalled()
    })

    it('rejects the developer backdoor for event creation without a member id', async () => {
        const token = createToken({
            memberId: 0,
            isDeveloper: true,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false
        })

        const response = await request(createApp())
            .post('/events')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Developer Event',
                eventDate: '2026-06-10T10:00:00.000Z'
            })

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Event management access required' })
        expect(prismaMocks.eventCreate).not.toHaveBeenCalled()
    })

    it('returns manager-visible events to authenticated privileged users', async () => {
        prismaMocks.eventFindMany.mockResolvedValueOnce([
            {
                id: 201,
                title: 'Manager Event'
            }
        ])

        const token = createToken({
            memberId: 15,
            isOfficer: false,
            isAdmin: true,
            isLeadership: false
        })

        const response = await request(createAuthedApp())
            .get('/events')
            .set('Authorization', `Bearer ${token}`)
            .query({ scope: 'all' })

        expect(response.status).toBe(200)
        expect(response.body).toEqual([
            {
                id: 201,
                title: 'Manager Event'
            }
        ])

        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                isArchived: false
            })
        }))
        const queryArg = prismaMocks.eventFindMany.mock.calls[0][0]
        expect(queryArg.where.status).toBeUndefined()
    })

    it('allows an officer to create an event', async () => {
        const token = createToken({
            memberId: 14,
            isOfficer: true,
            isAdmin: false,
            isLeadership: false
        })

        prismaMocks.eventCreate.mockResolvedValueOnce({
            id: 102,
            title: 'Officer Event'
        })

        const response = await request(createApp())
            .post('/events')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Officer Event',
                eventDate: '2026-06-10T10:00:00.000Z',
                projectTypeId: 2
            })

        expect(response.status).toBe(201)
        expect(response.body).toEqual(expect.objectContaining({
            id: 102,
            title: 'Officer Event'
        }))
        expect(prismaMocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                title: 'Officer Event',
                createdByMemberId: 14,
                status: 'NOT_STARTED'
            })
        }))
    })

    it('returns archived events when archived=true', async () => {
        prismaMocks.eventFindMany.mockResolvedValueOnce([{ id: 301, title: 'Archived Event' }])

        const token = createToken({
            memberId: 15,
            isAdmin: true
        })

        const response = await request(createAuthedApp())
            .get('/events')
            .set('Authorization', `Bearer ${token}`)
            .query({ archived: 'true', scope: 'all' })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ isArchived: true })
        }))
    })

    it('holds an active event via deactivate', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 55,
            isArchived: false,
            isFinalized: false,
            status: 'IN_PROGRESS',
            isActive: true
        })
        prismaMocks.eventUpdate.mockResolvedValueOnce({ id: 55, isActive: false, title: 'Held Event' })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/55/deactivate')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(prismaMocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 55 },
            data: { isActive: false }
        }))
    })

    it('finalizes an event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 56,
            isArchived: false,
            isFinalized: false,
            status: 'IN_PROGRESS',
            isActive: true
        })
        prismaMocks.eventUpdate.mockResolvedValueOnce({ id: 56, isFinalized: true, status: 'COMPLETED' })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/56/finalize')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(prismaMocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 56 },
            data: expect.objectContaining({
                isFinalized: true,
                status: 'COMPLETED',
            })
        }))
    })

    it('rejects archiving an event that is not finalized or aborted', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 57,
            isFinalized: false,
            status: 'IN_PROGRESS'
        })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/57/archive')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'Only finalized or aborted events can be archived' })
        expect(prismaMocks.eventUpdate).not.toHaveBeenCalled()
    })

    it('archives a finalized event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 58,
            isFinalized: true,
            status: 'COMPLETED',
            isActive: true
        })
        prismaMocks.eventUpdate.mockResolvedValueOnce({ id: 58, isArchived: true, isActive: false })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/58/archive')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(prismaMocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 58 },
            data: expect.objectContaining({ isArchived: true, isActive: false })
        }))
    })
})