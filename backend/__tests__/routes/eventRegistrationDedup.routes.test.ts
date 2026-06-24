import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    eventFindUnique: vi.fn(),
    eventCustomFieldFindMany: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventRegistrationCreate: vi.fn(),
    eventRegistrationUpdate: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventRegistrationDayCreate: vi.fn(),
    memberFindFirst: vi.fn(),
    eventTierFindFirst: vi.fn(),
    eventTierFindMany: vi.fn(),
    transaction: vi.fn(),
}))

const eventCodeMocks = vi.hoisted(() => ({
    generateUniqueConfirmationCode: vi.fn(),
}))

const eventDatesMocks = vi.hoisted(() => ({
    isWithinEventDays: vi.fn(() => true),
    resolveCheckInEventDay: vi.fn(() => ({
        eventDay: '2026-06-22',
        eventDayDate: new Date('2026-06-22T00:00:00.000Z'),
    })),
}))

const activityMocks = vi.hoisted(() => ({
    logEventActivity: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        event: {
            findUnique: prismaMocks.eventFindUnique,
        },
        eventCustomField: {
            findMany: prismaMocks.eventCustomFieldFindMany,
        },
        eventRegistration: {
            findFirst: prismaMocks.eventRegistrationFindFirst,
            create: prismaMocks.eventRegistrationCreate,
            update: prismaMocks.eventRegistrationUpdate,
            count: prismaMocks.eventRegistrationCount,
        },
        eventRegistrationDay: {
            create: prismaMocks.eventRegistrationDayCreate,
        },
        member: {
            findFirst: prismaMocks.memberFindFirst,
        },
        eventTier: {
            findFirst: prismaMocks.eventTierFindFirst,
            findMany: prismaMocks.eventTierFindMany,
        },
        $transaction: prismaMocks.transaction,
    },
}))

vi.mock('../../services/eventCode', () => eventCodeMocks)
vi.mock('../../services/activityLogService', () => activityMocks)
vi.mock('../../services/eventTicketEmailService', () => ({
    sendEventTicketEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../services/eventDates', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/eventDates')>()
    return {
        ...actual,
        isWithinEventDays: eventDatesMocks.isWithinEventDays,
        resolveCheckInEventDay: eventDatesMocks.resolveCheckInEventDay,
    }
})

import { JWT_SECRET } from '../../middleware/auth'
import eventsRouter from '../../routes/events'

function createApp() {
    const app = express()
    app.use(express.json())
    app.use('/events', eventsRouter)
    return app
}

function createManagerToken(memberId = 12) {
    return jwt.sign({
        memberId,
        isDeveloper: true,
        isOfficer: false,
        isAdmin: false,
        isLeadership: false,
    }, JWT_SECRET)
}

const publishedEvent = {
    id: 10,
    title: 'Summit',
    status: 'PUBLISHED',
    isActive: true,
    isArchived: false,
    isPublished: true,
    allowWalkIns: true,
    eventDate: new Date('2026-06-20T10:00:00.000Z'),
    eventEndDate: new Date('2026-06-24T18:00:00.000Z'),
    registrationDeadline: null,
    capacity: null,
}

const registrationIncludeShape = expect.objectContaining({
    include: expect.objectContaining({
        attendanceDays: expect.anything(),
    }),
})

describe('event registration deduplication', () => {
    beforeEach(() => {
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([])
        prismaMocks.memberFindFirst.mockResolvedValue(null)
        prismaMocks.eventRegistrationCount.mockResolvedValue(0)
        prismaMocks.eventTierFindFirst.mockResolvedValue(null)
        prismaMocks.eventTierFindMany.mockResolvedValue([])
        eventCodeMocks.generateUniqueConfirmationCode.mockResolvedValue('ABC123')
        activityMocks.logEventActivity.mockResolvedValue(undefined)
        prismaMocks.transaction.mockImplementation(async (fn: (tx: {
            eventRegistrationDay: { create: typeof prismaMocks.eventRegistrationDayCreate }
            eventRegistration: { update: typeof prismaMocks.eventRegistrationUpdate }
        }) => Promise<unknown>) => fn({
            eventRegistrationDay: { create: prismaMocks.eventRegistrationDayCreate },
            eventRegistration: { update: prismaMocks.eventRegistrationUpdate },
        }))
        eventDatesMocks.resolveCheckInEventDay.mockReturnValue({
            eventDay: '2026-06-22',
            eventDayDate: new Date('2026-06-22T00:00:00.000Z'),
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('rejects a duplicate walk-in on the same day', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 50,
            eventId: 10,
            email: 'alice@example.com',
            fullName: 'Alice',
            confirmationCode: 'KEEP01',
            status: 'CHECKED_IN',
            isWalkIn: true,
            customFieldValues: null,
            attendanceDays: [{
                eventDay: new Date('2026-06-22T00:00:00.000Z'),
                checkedInAt: new Date('2026-06-22T09:00:00.000Z'),
            }],
            tier: null,
            member: null,
        })

        const response = await request(createApp())
            .post('/events/10/registrations/walk-in')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                fullName: 'Alice',
                email: 'alice@example.com',
            })

        expect(response.status).toBe(409)
        expect(response.body).toEqual({ error: 'This person is already checked in today' })
        expect(prismaMocks.eventRegistrationCreate).not.toHaveBeenCalled()
        expect(prismaMocks.eventRegistrationDayCreate).not.toHaveBeenCalled()
    })

    it('reuses an existing registration for a walk-in on a new day', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent)
        eventDatesMocks.resolveCheckInEventDay.mockReturnValue({
            eventDay: '2026-06-23',
            eventDayDate: new Date('2026-06-23T00:00:00.000Z'),
        })
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 50,
            eventId: 10,
            email: 'alice@example.com',
            fullName: 'Alice',
            confirmationCode: 'KEEP01',
            status: 'CHECKED_IN',
            isWalkIn: true,
            customFieldValues: null,
            attendanceDays: [{
                eventDay: new Date('2026-06-22T00:00:00.000Z'),
                checkedInAt: new Date('2026-06-22T09:00:00.000Z'),
            }],
            tier: null,
            member: null,
        })
        prismaMocks.eventRegistrationDayCreate.mockResolvedValue({ id: 99 })
        prismaMocks.eventRegistrationUpdate.mockResolvedValue({
            id: 50,
            eventId: 10,
            email: 'alice@example.com',
            fullName: 'Alice',
            confirmationCode: 'KEEP01',
            status: 'CHECKED_IN',
            isWalkIn: true,
            customFieldValues: null,
            attendanceDays: [
                {
                    eventDay: new Date('2026-06-22T00:00:00.000Z'),
                    checkedInAt: new Date('2026-06-22T09:00:00.000Z'),
                },
                {
                    eventDay: new Date('2026-06-23T00:00:00.000Z'),
                    checkedInAt: new Date('2026-06-23T09:00:00.000Z'),
                },
            ],
            tier: null,
            member: null,
        })

        const response = await request(createApp())
            .post('/events/10/registrations/walk-in')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                fullName: 'Alice',
                email: 'alice@example.com',
            })

        expect(response.status).toBe(200)
        expect(response.body).toEqual(expect.objectContaining({
            id: 50,
            confirmationCode: 'KEEP01',
            action: 'checked_in_existing',
        }))
        expect(prismaMocks.eventRegistrationCreate).not.toHaveBeenCalled()
        expect(prismaMocks.eventRegistrationDayCreate).toHaveBeenCalled()
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith(registrationIncludeShape)
    })

    it('creates a new walk-in when no active registration exists', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null)
        prismaMocks.eventRegistrationCreate.mockResolvedValue({
            id: 60,
            eventId: 10,
            email: 'bob@example.com',
            fullName: 'Bob',
            confirmationCode: 'NEW001',
            status: 'CHECKED_IN',
            isWalkIn: true,
            customFieldValues: null,
            attendanceDays: [{
                eventDay: new Date('2026-06-22T00:00:00.000Z'),
                checkedInAt: new Date('2026-06-22T09:00:00.000Z'),
            }],
            tier: null,
            member: null,
        })

        const response = await request(createApp())
            .post('/events/10/registrations/walk-in')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                fullName: 'Bob',
                email: 'bob@example.com',
            })

        expect(response.status).toBe(201)
        expect(response.body).toEqual(expect.objectContaining({
            id: 60,
            confirmationCode: 'NEW001',
            action: 'created',
        }))
        expect(prismaMocks.eventRegistrationCreate).toHaveBeenCalled()
    })

    it('rejects duplicate public registration for the same email', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 70,
            eventId: 10,
            email: 'carol@example.com',
            fullName: 'Carol',
            confirmationCode: 'CAR001',
            status: 'REGISTERED',
            isWalkIn: false,
            attendanceDays: [],
            tier: null,
            member: null,
        })

        const response = await request(createApp())
            .post('/events/10/registrations')
            .send({
                fullName: 'Carol',
                email: 'carol@example.com',
            })

        expect(response.status).toBe(409)
        expect(response.body).toEqual({ error: 'Already registered for this event' })
        expect(prismaMocks.eventRegistrationCreate).not.toHaveBeenCalled()
    })

    it('requires a public tier when public tiers exist', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null)
        prismaMocks.eventTierFindMany.mockResolvedValue([
            { id: 3, maxCapacity: null },
        ])

        const response = await request(createApp())
            .post('/events/10/registrations')
            .send({
                fullName: 'Eve',
                email: 'eve@example.com',
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'A valid registration tier is required' })
        expect(prismaMocks.eventRegistrationCreate).not.toHaveBeenCalled()
    })

    it('allows registration again after a previous one was cancelled', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null)
        prismaMocks.eventRegistrationCreate.mockResolvedValue({
            id: 80,
            eventId: 10,
            email: 'dana@example.com',
            fullName: 'Dana',
            confirmationCode: 'DAN001',
            status: 'REGISTERED',
            isWalkIn: false,
            tier: null,
            member: null,
        })

        const response = await request(createApp())
            .post('/events/10/registrations')
            .send({
                fullName: 'Dana',
                email: 'dana@example.com',
            })

        expect(response.status).toBe(201)
        expect(prismaMocks.eventRegistrationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                OR: [
                    { eventId: 10, email: 'dana@example.com', status: { not: 'CANCELLED' } },
                ],
            },
        }))
        expect(prismaMocks.eventRegistrationCreate).toHaveBeenCalled()
    })
})
