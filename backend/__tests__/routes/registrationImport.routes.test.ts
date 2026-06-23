import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    eventFindUnique: vi.fn(),
    eventCustomFieldAggregate: vi.fn(),
    eventCustomFieldCreate: vi.fn(),
    eventCustomFieldFindMany: vi.fn(),
    eventTierFindMany: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventRegistrationCreate: vi.fn(),
    eventRegistrationUpdate: vi.fn(),
    eventRegistrationCount: vi.fn(),
    memberFindFirst: vi.fn(),
}))

const eventCodeMocks = vi.hoisted(() => ({
    generateUniqueConfirmationCode: vi.fn(),
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
            aggregate: prismaMocks.eventCustomFieldAggregate,
            create: prismaMocks.eventCustomFieldCreate,
            findMany: prismaMocks.eventCustomFieldFindMany,
        },
        eventTier: {
            findMany: prismaMocks.eventTierFindMany,
        },
        eventRegistration: {
            findFirst: prismaMocks.eventRegistrationFindFirst,
            create: prismaMocks.eventRegistrationCreate,
            update: prismaMocks.eventRegistrationUpdate,
            count: prismaMocks.eventRegistrationCount,
        },
        member: {
            findFirst: prismaMocks.memberFindFirst,
        },
    },
}))

vi.mock('../../services/eventCode', () => eventCodeMocks)
vi.mock('../../services/activityLogService', () => activityMocks)

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

describe('registration import routes', () => {
    beforeEach(() => {
        prismaMocks.eventFindUnique.mockResolvedValue({ id: 10, capacity: null })
        prismaMocks.eventCustomFieldAggregate.mockResolvedValue({ _max: { order: 0 } })
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([])
        prismaMocks.eventTierFindMany.mockResolvedValue([
            { id: 3, name: 'General', maxCapacity: null },
        ])
        prismaMocks.eventRegistrationCount.mockResolvedValue(0)
        prismaMocks.memberFindFirst.mockResolvedValue(null)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null)
        prismaMocks.eventRegistrationCreate.mockResolvedValue({ id: 1 })
        prismaMocks.eventRegistrationUpdate.mockResolvedValue({ id: 2 })
        eventCodeMocks.generateUniqueConfirmationCode.mockResolvedValue('IMP001')
        activityMocks.logEventActivity.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('creates imported registrations with source IMPORT', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                rows: [{
                    fullName: 'Alice Example',
                    email: 'alice@example.com',
                    tierName: 'General',
                }],
            })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            created: 1,
            updated: 0,
            skipped: 0,
            errors: [],
            createdRegistrationIds: [1],
        })
        expect(prismaMocks.eventRegistrationCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                source: 'IMPORT',
                fullName: 'Alice Example',
                email: 'alice@example.com',
                tierId: 3,
            }),
        }))
        const createPayload = prismaMocks.eventRegistrationCreate.mock.calls[0][0]
        expect(createPayload.data.ticketEmailSentAt).toBeUndefined()
    })

    it('updates an existing registration by email', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 55,
            eventId: 10,
            email: 'alice@example.com',
            fullName: 'Alice',
            phoneNumber: null,
            tierId: null,
            notes: null,
            memberId: null,
            customFieldValues: null,
            status: 'REGISTERED',
        })

        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                rows: [{
                    fullName: 'Alice Updated',
                    email: 'alice@example.com',
                    phoneNumber: '+201234567890',
                }],
            })

        expect(response.status).toBe(200)
        expect(response.body.updated).toBe(1)
        expect(response.body.createdRegistrationIds).toEqual([])
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 55 },
            data: expect.objectContaining({
                fullName: 'Alice Updated',
                phoneNumber: '+201234567890',
            }),
        }))
        expect(prismaMocks.eventRegistrationCreate).not.toHaveBeenCalled()
    })

    it('creates new custom fields before importing rows', async () => {
        prismaMocks.eventCustomFieldCreate.mockResolvedValue({
            id: 90,
            label: 'Company',
            type: 'text',
            required: false,
            options: null,
            showOnPublic: false,
            isActive: true,
        })
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([{
            id: 90,
            label: 'Company',
            type: 'text',
            required: false,
            options: null,
            showOnPublic: false,
            isActive: true,
        }])

        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                newCustomFields: [{
                    excelColumn: 'Company',
                    label: 'Company',
                    type: 'text',
                }],
                rows: [{
                    fullName: 'Bob Example',
                    email: 'bob@example.com',
                    customFieldValues: {
                        Company: 'ACME',
                    },
                }],
            })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventCustomFieldCreate).toHaveBeenCalled()
        expect(prismaMocks.eventRegistrationCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                customFieldValues: { '90': 'ACME' },
            }),
        }))
    })

    it('skips rows missing required full name', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                rows: [{
                    fullName: '',
                    email: 'no-name@example.com',
                }],
            })

        expect(response.status).toBe(200)
        expect(response.body.skipped).toBe(1)
        expect(response.body.errors[0].message).toContain('Full name is required')
    })

    it('creates name-only rows with placeholder email for dedup', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                rows: [{
                    fullName: 'Name Only Guest',
                }],
            })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            created: 1,
            updated: 0,
            skipped: 0,
            errors: [],
            createdRegistrationIds: [1],
        })
        expect(prismaMocks.eventRegistrationCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                fullName: 'Name Only Guest',
                email: 'import.10.name-only-guest@event-import.local',
                source: 'IMPORT',
            }),
        }))
    })

    it('updates name-only rows by matching placeholder or full name', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 77,
            eventId: 10,
            email: 'import.10.name-only-guest@event-import.local',
            fullName: 'Name Only Guest',
            phoneNumber: null,
            tierId: null,
            notes: null,
            memberId: null,
            customFieldValues: null,
            status: 'REGISTERED',
        })

        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                rows: [{
                    fullName: 'Name Only Guest',
                    notes: 'Updated via import',
                }],
            })

        expect(response.status).toBe(200)
        expect(response.body.updated).toBe(1)
        expect(response.body.createdRegistrationIds).toEqual([])
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 77 },
            data: expect.objectContaining({
                fullName: 'Name Only Guest',
                notes: 'Updated via import',
            }),
        }))
        expect(prismaMocks.eventRegistrationCreate).not.toHaveBeenCalled()
    })

    it('skips rows when tier name is not found', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/import')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                rows: [{
                    fullName: 'Carol Example',
                    email: 'carol@example.com',
                    tierName: 'VIP',
                }],
            })

        expect(response.status).toBe(200)
        expect(response.body.skipped).toBe(1)
        expect(response.body.errors[0].message).toContain('Tier "VIP" was not found')
    })
})
