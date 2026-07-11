import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    eventFindMany: vi.fn(),
    eventFindUnique: vi.fn(),
    eventUpdate: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventRegistrationFindMany: vi.fn(),
    eventRegistrationUpdate: vi.fn(),
    eventRegistrationFindUniqueOrThrow: vi.fn(),
    eventRegistrationDayDelete: vi.fn(),
    eventRegistrationDayCount: vi.fn(),
    transaction: vi.fn(),
    eventCreate: vi.fn(),
    eventActivityFindMany: vi.fn(),
    eventTaskAssignmentFindFirst: vi.fn(),
    eventTaskFindFirst: vi.fn(),
    eventTaskCreate: vi.fn(),
    eventTierCreate: vi.fn(),
    eventTierFindMany: vi.fn(),
    eventTierFindFirst: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventTeamFindFirst: vi.fn(),
    eventTeamFindMany: vi.fn(),
    teamMemberFindMany: vi.fn(),
    eventCustomFieldAggregate: vi.fn(),
    eventCustomFieldCreate: vi.fn(),
}))

const eventCodeMocks = vi.hoisted(() => ({
    generateUniqueConfirmationCode: vi.fn(),
    generateUniqueEventSlug: vi.fn(),
}))

const activityMocks = vi.hoisted(() => ({
    collectChangedFields: vi.fn(),
    changesToPayload: vi.fn(),
    summarizeChanges: vi.fn(),
    logEventActivity: vi.fn()
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
            findFirst: prismaMocks.eventRegistrationFindFirst,
            findMany: prismaMocks.eventRegistrationFindMany,
            update: prismaMocks.eventRegistrationUpdate,
            findUniqueOrThrow: prismaMocks.eventRegistrationFindUniqueOrThrow,
            count: prismaMocks.eventRegistrationCount,
        },
        eventRegistrationDay: {
            delete: prismaMocks.eventRegistrationDayDelete,
            count: prismaMocks.eventRegistrationDayCount,
        },
        $transaction: prismaMocks.transaction,
        eventActivityLog: {
            findMany: prismaMocks.eventActivityFindMany
        },
        eventTaskAssignment: {
            findFirst: prismaMocks.eventTaskAssignmentFindFirst,
        },
        eventTask: {
            findFirst: prismaMocks.eventTaskFindFirst,
            create: prismaMocks.eventTaskCreate,
        },
        eventTier: {
            create: prismaMocks.eventTierCreate,
            findMany: prismaMocks.eventTierFindMany,
            findFirst: prismaMocks.eventTierFindFirst,
        },
        eventTeam: {
            findFirst: prismaMocks.eventTeamFindFirst,
            findMany: prismaMocks.eventTeamFindMany,
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
        },
        eventCustomField: {
            aggregate: prismaMocks.eventCustomFieldAggregate,
            create: prismaMocks.eventCustomFieldCreate,
        },
    }
}))

vi.mock('../../services/eventCode', () => eventCodeMocks)
vi.mock('../../services/activityLogService', () => activityMocks)

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
        prismaMocks.eventFindUnique.mockResolvedValue(null)
        prismaMocks.eventUpdate.mockResolvedValue(null)
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null)
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([])
        prismaMocks.eventActivityFindMany.mockResolvedValue([])
        prismaMocks.eventTaskAssignmentFindFirst.mockResolvedValue(null)
        prismaMocks.eventTaskFindFirst.mockResolvedValue(null)
        prismaMocks.eventTierFindMany.mockResolvedValue([])
        prismaMocks.eventTeamFindFirst.mockResolvedValue(null)
        prismaMocks.eventTeamFindMany.mockResolvedValue([])
        prismaMocks.teamMemberFindMany.mockResolvedValue([])
        prismaMocks.eventCustomFieldAggregate.mockResolvedValue({ _max: { order: 0 } })
        activityMocks.collectChangedFields.mockReturnValue([])
        activityMocks.changesToPayload.mockReturnValue({ oldValue: {}, newValue: {} })
        activityMocks.summarizeChanges.mockReturnValue(null)
        activityMocks.logEventActivity.mockResolvedValue(undefined)
        prismaMocks.eventCreate.mockResolvedValue({
            id: 101,
            title: 'Launch Night',
            projectTypeId: 3,
            priority: 'HIGH',
            status: 'NOT_STARTED',
            eventDate: new Date('2026-06-10T10:00:00.000Z')
        })
        eventCodeMocks.generateUniqueConfirmationCode.mockResolvedValue('CONFIRM-12345')
        eventCodeMocks.generateUniqueEventSlug.mockResolvedValue('abcdefghjkmn')
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
            where: {
                AND: [{ isArchived: false }],
            },
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
            where: {
                AND: [{ isArchived: true }],
            },
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
        expect(activityMocks.logEventActivity).toHaveBeenCalledTimes(1)
    })

    it('logs activity when creating an event', async () => {
        const token = createToken({
            memberId: 14,
            isOfficer: true,
            isAdmin: false,
            isLeadership: false
        })

        prismaMocks.eventCreate.mockResolvedValueOnce({
            id: 102,
            title: 'Officer Event',
            projectTypeId: 2,
            priority: 'MEDIUM',
            status: 'NOT_STARTED',
            eventDate: new Date('2026-06-10T10:00:00.000Z')
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
        expect(activityMocks.logEventActivity).toHaveBeenCalledWith(expect.objectContaining({
            eventId: 102,
            memberId: 14,
            actionType: 'CREATED',
            entityType: 'EVENT'
        }))
    })

    it('returns empty activity for an existing event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 77,
            title: 'Summit',
            status: 'PUBLISHED',
            isActive: true,
            isArchived: false,
        })
        prismaMocks.eventActivityFindMany.mockResolvedValueOnce([])

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createAuthedApp())
            .get('/events/77/activity')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual([])
        expect(prismaMocks.eventActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { eventId: 77 },
            orderBy: { createdAt: 'desc' }
        }))
    })

    it('returns event activity entries for managers', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 77,
            title: 'Summit',
            status: 'PUBLISHED',
            isActive: true,
            isArchived: false,
        })
        prismaMocks.eventActivityFindMany.mockResolvedValueOnce([
            {
                id: 1,
                eventId: 77,
                actionType: 'CREATED',
                entityType: 'EVENT',
                description: 'Event "Summit" created',
                member: { id: 12, fullName: 'Dev User', profilePhotoUrl: null }
            }
        ])

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createAuthedApp())
            .get('/events/77/activity')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(1)
        expect(response.body[0]).toEqual(expect.objectContaining({
            actionType: 'CREATED',
            entityType: 'EVENT'
        }))
    })

    it('allows a task-assigned member to view a draft event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 88,
            title: 'Draft Summit',
            status: 'DRAFT',
            isActive: true,
            isArchived: false,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })
        prismaMocks.eventTaskAssignmentFindFirst.mockResolvedValueOnce({ id: 1 })

        const token = createToken({
            memberId: 20,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/88')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(expect.objectContaining({
            id: 88,
            title: 'Draft Summit',
            canEdit: false,
        }))
    })

    it('denies an unassigned member from viewing a draft event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 89,
            title: 'Private Draft',
            status: 'DRAFT',
            isActive: true,
            isArchived: false,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })

        const token = createToken({
            memberId: 21,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/89')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Access denied' })
    })

    it('allows a special role to create tiers but not events', async () => {
        const specialToken = createToken({
            memberId: 22,
            isSpecial: true,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
        })

        const createEventResponse = await request(createApp())
            .post('/events')
            .set('Authorization', `Bearer ${specialToken}`)
            .send({
                title: 'Special Event',
                eventDate: '2026-06-10T10:00:00.000Z',
                projectTypeId: 3,
            })

        expect(createEventResponse.status).toBe(403)
        expect(prismaMocks.eventCreate).not.toHaveBeenCalled()

        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 90, isArchived: false })
        prismaMocks.eventTierCreate.mockResolvedValueOnce({
            id: 5,
            eventId: 90,
            name: 'VIP',
            description: null,
            maxCapacity: null,
            price: null,
            currency: 'EGP',
            order: 0,
            _count: { registrations: 0 },
        })

        const createTierResponse = await request(createApp())
            .post('/events/90/tiers')
            .set('Authorization', `Bearer ${specialToken}`)
            .send({ name: 'VIP' })

        expect(createTierResponse.status).toBe(201)
        expect(prismaMocks.eventTierCreate).toHaveBeenCalled()
    })

    it('allows an assigned member to list registrations', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 91, isArchived: false })
        prismaMocks.eventTaskAssignmentFindFirst.mockResolvedValueOnce({ id: 2 })
        prismaMocks.eventRegistrationFindMany.mockResolvedValueOnce([
            { id: 1, fullName: 'Alex', email: 'alex@example.com', attendanceDays: [] },
        ])

        const token = createToken({
            memberId: 23,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/91/registrations')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(1)
    })

    it('denies an unassigned member from listing registrations', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 92, isArchived: false })

        const token = createToken({
            memberId: 24,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/92/registrations')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Access denied' })
        expect(prismaMocks.eventRegistrationFindMany).not.toHaveBeenCalled()
    })

    it('denies an assigned regular member from creating tiers', async () => {
        const token = createToken({
            memberId: 25,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })

        const response = await request(createApp())
            .post('/events/93/tiers')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'General' })

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Access denied' })
        expect(prismaMocks.eventTierCreate).not.toHaveBeenCalled()
    })

    it('allows leadership to view a draft event linked to their team', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 94,
            title: 'Team Draft',
            status: 'DRAFT',
            isActive: true,
            isArchived: false,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ teamId: 3 }])
        prismaMocks.eventTeamFindFirst.mockResolvedValueOnce({ id: 1 })

        const token = createToken({
            memberId: 26,
            isLeadership: true,
            isOfficer: false,
            isAdmin: false,
            isSpecial: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/94')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(expect.objectContaining({ id: 94, title: 'Team Draft' }))
    })

    it('denies leadership from viewing a draft event outside their teams', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 95,
            title: 'Other Team Draft',
            status: 'DRAFT',
            isActive: true,
            isArchived: false,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ teamId: 3 }])
        prismaMocks.eventTeamFindFirst.mockResolvedValueOnce(null)

        const token = createToken({
            memberId: 27,
            isLeadership: true,
            isOfficer: false,
            isAdmin: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/95')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Access denied' })
    })

    it('scopes leadership active event lists to linked teams', async () => {
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ teamId: 4 }])
        prismaMocks.eventFindMany.mockResolvedValueOnce([])

        const token = createToken({
            memberId: 28,
            isLeadership: true,
            isOfficer: false,
            isAdmin: false,
        })

        const response = await request(createAuthedApp())
            .get('/events')
            .set('Authorization', `Bearer ${token}`)
            .query({ scope: 'all' })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                AND: [
                    { isArchived: false },
                    {
                        eventTeams: {
                            some: {
                                teamId: { in: [4] },
                            },
                        },
                    },
                ],
            },
        }))
    })

    it('allows a special role to view a team-linked event without assignment', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 96,
            title: 'Special Team Event',
            status: 'DRAFT',
            isActive: true,
            isArchived: false,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.eventTeamFindFirst.mockResolvedValueOnce({ id: 2 })

        const token = createToken({
            memberId: 29,
            isSpecial: true,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/96')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(expect.objectContaining({ id: 96 }))
    })

    it('denies a regular member from viewing a team-linked event without assignment', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 97,
            title: 'Team Only Event',
            status: 'DRAFT',
            isActive: true,
            isArchived: false,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })

        const token = createToken({
            memberId: 30,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/97')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Access denied' })
    })

    it('rejects task creation when assignees are outside event teams', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 98, title: 'Ops Day' })
        prismaMocks.eventTeamFindMany.mockResolvedValueOnce([{ teamId: 7 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([])

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .post('/events/98/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Gate duty',
                location: 'Main hall',
                taskDate: '2026-06-10T10:00:00.000Z',
                assignments: [{
                    memberId: 99,
                    startDateTime: '2026-06-10T10:00:00.000Z',
                    endDateTime: '2026-06-10T11:00:00.000Z',
                }],
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'All task assignees must belong to a team linked to this event' })
        expect(prismaMocks.eventTaskCreate).not.toHaveBeenCalled()
    })

    it('allows an assigned regular member to create custom fields', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 99, isArchived: false })
        prismaMocks.eventTaskAssignmentFindFirst.mockResolvedValueOnce({ id: 4 })
        prismaMocks.eventCustomFieldCreate.mockResolvedValueOnce({
            id: 11,
            eventId: 99,
            label: 'Dietary',
            type: 'TEXT',
        })

        const token = createToken({
            memberId: 31,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })

        const response = await request(createApp())
            .post('/events/99/custom-fields')
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'Dietary', type: 'TEXT' })

        expect(response.status).toBe(201)
        expect(prismaMocks.eventCustomFieldCreate).toHaveBeenCalled()
    })

    it('allows an unassigned regular member to view an archived event', async () => {
        prismaMocks.eventFindUnique
            .mockResolvedValueOnce({
                id: 100,
                title: 'Archived Gala',
                status: 'COMPLETED',
                isActive: false,
                isArchived: true,
                eventTeams: [],
                tiers: [],
                customFields: [],
                _count: { registrations: 0 },
            })
            .mockResolvedValueOnce({
                isActive: false,
                isFinalized: true,
                isArchived: true,
                status: 'COMPLETED',
            })

        const token = createToken({
            memberId: 32,
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })

        const response = await request(createAuthedApp())
            .get('/events/100')
            .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(expect.objectContaining({ id: 100, title: 'Archived Gala' }))
    })

    it('discloses an archived event for the public website', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 101,
            title: 'Archived Summit',
            isArchived: true,
            isDisclosed: false,
        })
        prismaMocks.eventUpdate.mockResolvedValueOnce({
            id: 101,
            title: 'Archived Summit',
            isArchived: true,
            isDisclosed: true,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/101/disclose')
            .set('Authorization', `Bearer ${token}`)
            .send({ disclosed: true })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 101 },
            data: { isDisclosed: true },
        }))
    })

    it('rejects disclose on a non-archived event', async () => {
        prismaMocks.eventFindUnique.mockReset()
        prismaMocks.eventUpdate.mockReset()
        prismaMocks.eventFindUnique.mockResolvedValue({
            id: 102,
            title: 'Active Summit',
            isArchived: false,
            isDisclosed: false,
        })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/102/disclose')
            .set('Authorization', `Bearer ${token}`)
            .send({ disclosed: true })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'Only archived events can be disclosed on the public website' })
        expect(prismaMocks.eventUpdate).not.toHaveBeenCalled()
    })

    it('publishes an active event for public registration', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 103,
            title: 'Open House',
            isArchived: false,
            isFinalized: false,
            isActive: true,
            status: 'DRAFT',
            isPublished: false,
        })
        prismaMocks.eventUpdate.mockResolvedValueOnce({
            id: 103,
            title: 'Open House',
            isPublished: true,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/103/publish')
            .set('Authorization', `Bearer ${token}`)
            .send({ published: true })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 103 },
            data: { isPublished: true },
        }))
    })

    it('allows a special role to publish an event', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({
            id: 104,
            title: 'Special Summit',
            isArchived: false,
            isFinalized: false,
            isActive: true,
            status: 'DRAFT',
            isPublished: false,
        })
        prismaMocks.eventUpdate.mockResolvedValueOnce({
            id: 104,
            title: 'Special Summit',
            isPublished: true,
            eventTeams: [],
            tiers: [],
            customFields: [],
            _count: { registrations: 0 },
        })

        const token = createToken({ memberId: 15, isSpecial: true })

        const response = await request(createApp())
            .patch('/events/104/publish')
            .set('Authorization', `Bearer ${token}`)
            .send({ published: true })

        expect(response.status).toBe(200)
    })

    it('denies a regular member from publishing an event', async () => {
        const token = createToken({ memberId: 20 })

        const response = await request(createApp())
            .patch('/events/105/publish')
            .set('Authorization', `Bearer ${token}`)
            .send({ published: true })

        expect(response.status).toBe(403)
        expect(prismaMocks.eventUpdate).not.toHaveBeenCalled()
    })

    it('removes attendance for a day and reverts status when it was the last day', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValueOnce({
            id: 12,
            eventId: 110,
            fullName: 'Alex',
            status: 'CHECKED_IN',
            attendanceDays: [{
                id: 77,
                eventDay: new Date('2026-06-22T00:00:00.000Z'),
                checkedInAt: new Date('2026-06-22T09:00:00.000Z'),
            }],
        })
        prismaMocks.transaction.mockImplementationOnce(async (fn: (tx: {
            eventRegistrationDay: { delete: typeof prismaMocks.eventRegistrationDayDelete; count: typeof prismaMocks.eventRegistrationDayCount }
            eventRegistration: { update: typeof prismaMocks.eventRegistrationUpdate; findUniqueOrThrow: typeof prismaMocks.eventRegistrationFindUniqueOrThrow }
        }) => Promise<unknown>) => fn({
            eventRegistrationDay: {
                delete: prismaMocks.eventRegistrationDayDelete,
                count: prismaMocks.eventRegistrationDayCount,
            },
            eventRegistration: {
                update: prismaMocks.eventRegistrationUpdate,
                findUniqueOrThrow: prismaMocks.eventRegistrationFindUniqueOrThrow,
            },
        }))
        prismaMocks.eventRegistrationDayCount.mockResolvedValueOnce(0)
        prismaMocks.eventRegistrationUpdate.mockResolvedValueOnce({
            id: 12,
            eventId: 110,
            fullName: 'Alex',
            email: 'alex@example.com',
            status: 'REGISTERED',
            checkedInAt: null,
            attendanceDays: [],
            tier: null,
            member: null,
        })

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .delete('/events/110/registrations/12/attendance')
            .set('Authorization', `Bearer ${token}`)
            .send({ eventDay: '2026-06-22' })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventRegistrationDayDelete).toHaveBeenCalledWith({ where: { id: 77 } })
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 12 },
            data: { status: 'REGISTERED', checkedInAt: null },
        }))
        expect(response.body.status).toBe('REGISTERED')
    })

    it('removes attendance for one day but keeps checked-in status when other days remain', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValueOnce({
            id: 13,
            eventId: 111,
            fullName: 'Blair',
            status: 'CHECKED_IN',
            attendanceDays: [
                {
                    id: 78,
                    eventDay: new Date('2026-06-22T00:00:00.000Z'),
                    checkedInAt: new Date('2026-06-22T09:00:00.000Z'),
                },
                {
                    id: 79,
                    eventDay: new Date('2026-06-23T00:00:00.000Z'),
                    checkedInAt: new Date('2026-06-23T09:00:00.000Z'),
                },
            ],
        })
        prismaMocks.transaction.mockImplementationOnce(async (fn: (tx: {
            eventRegistrationDay: { delete: typeof prismaMocks.eventRegistrationDayDelete; count: typeof prismaMocks.eventRegistrationDayCount }
            eventRegistration: { update: typeof prismaMocks.eventRegistrationUpdate; findUniqueOrThrow: typeof prismaMocks.eventRegistrationFindUniqueOrThrow }
        }) => Promise<unknown>) => fn({
            eventRegistrationDay: {
                delete: prismaMocks.eventRegistrationDayDelete,
                count: prismaMocks.eventRegistrationDayCount,
            },
            eventRegistration: {
                update: prismaMocks.eventRegistrationUpdate,
                findUniqueOrThrow: prismaMocks.eventRegistrationFindUniqueOrThrow,
            },
        }))
        prismaMocks.eventRegistrationDayCount.mockResolvedValueOnce(1)
        prismaMocks.eventRegistrationFindUniqueOrThrow.mockResolvedValueOnce({
            id: 13,
            eventId: 111,
            fullName: 'Blair',
            email: 'blair@example.com',
            status: 'CHECKED_IN',
            attendanceDays: [{
                eventDay: new Date('2026-06-23T00:00:00.000Z'),
                checkedInAt: new Date('2026-06-23T09:00:00.000Z'),
            }],
            tier: null,
            member: null,
        })

        const token = createToken({ memberId: 12, isLeadership: true })

        const response = await request(createApp())
            .delete('/events/111/registrations/13/attendance')
            .set('Authorization', `Bearer ${token}`)
            .send({ eventDay: '2026-06-22' })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventRegistrationUpdate).not.toHaveBeenCalled()
        expect(prismaMocks.eventRegistrationFindUniqueOrThrow).toHaveBeenCalled()
        expect(response.body.status).toBe('CHECKED_IN')
    })

    it('denies a regular member from removing attendance', async () => {
        const token = createToken({ memberId: 20 })

        const response = await request(createApp())
            .delete('/events/112/registrations/14/attendance')
            .set('Authorization', `Bearer ${token}`)
            .send({ eventDay: '2026-06-22' })

        expect(response.status).toBe(403)
        expect(prismaMocks.eventRegistrationFindFirst).not.toHaveBeenCalled()
    })

    it('returns 404 when attendance day is not found', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValueOnce({
            id: 15,
            eventId: 113,
            fullName: 'Casey',
            status: 'CHECKED_IN',
            attendanceDays: [{
                id: 80,
                eventDay: new Date('2026-06-23T00:00:00.000Z'),
                checkedInAt: new Date('2026-06-23T09:00:00.000Z'),
            }],
        })

        const token = createToken({ memberId: 12, isOfficer: true })

        const response = await request(createApp())
            .delete('/events/113/registrations/15/attendance')
            .set('Authorization', `Bearer ${token}`)
            .send({ eventDay: '2026-06-22' })

        expect(response.status).toBe(404)
        expect(response.body).toEqual({ error: 'Attendance record not found' })
        expect(prismaMocks.transaction).not.toHaveBeenCalled()
    })

    it('updates registration tier when a valid tierId is provided', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 120, isArchived: false })
        prismaMocks.eventRegistrationFindFirst.mockResolvedValueOnce({
            id: 20,
            eventId: 120,
            fullName: 'Alex',
            email: 'alex@example.com',
            tierId: null,
            phoneNumber: null,
            notes: null,
            customFieldValues: null,
        })
        prismaMocks.eventTierFindFirst.mockResolvedValueOnce({ id: 5, maxCapacity: 100 })
        prismaMocks.eventRegistrationCount.mockResolvedValueOnce(10)
        prismaMocks.eventRegistrationUpdate.mockResolvedValueOnce({
            id: 20,
            eventId: 120,
            fullName: 'Alex',
            email: 'alex@example.com',
            tierId: 5,
            tier: { id: 5, name: 'VIP' },
            member: null,
            attendanceDays: [],
        })
        activityMocks.collectChangedFields.mockReturnValueOnce([{ field: 'tierId', oldValue: null, newValue: 5 }])

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/120/registrations/20')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: 5 })

        expect(response.status).toBe(200)
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 20 },
            data: expect.objectContaining({ tierId: 5 }),
        }))
        expect(response.body.tier).toEqual({ id: 5, name: 'VIP' })
    })

    it('returns 400 when updating registration with an unknown tier', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 121, isArchived: false })
        prismaMocks.eventRegistrationFindFirst.mockResolvedValueOnce({
            id: 21,
            eventId: 121,
            fullName: 'Blair',
            email: 'blair@example.com',
            tierId: null,
            phoneNumber: null,
            notes: null,
            customFieldValues: null,
        })
        prismaMocks.eventTierFindFirst.mockResolvedValueOnce(null)

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/121/registrations/21')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: 999 })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'Invalid tier for this event' })
        expect(prismaMocks.eventRegistrationUpdate).not.toHaveBeenCalled()
    })

    it('returns 409 when updating registration to a full tier', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 122, isArchived: false })
        prismaMocks.eventRegistrationFindFirst.mockResolvedValueOnce({
            id: 22,
            eventId: 122,
            fullName: 'Casey',
            email: 'casey@example.com',
            tierId: 3,
            phoneNumber: null,
            notes: null,
            customFieldValues: null,
        })
        prismaMocks.eventTierFindFirst.mockResolvedValueOnce({ id: 6, maxCapacity: 2 })
        prismaMocks.eventRegistrationCount.mockResolvedValueOnce(2)

        const token = createToken({ memberId: 12, isDeveloper: true })

        const response = await request(createApp())
            .patch('/events/122/registrations/22')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: 6 })

        expect(response.status).toBe(409)
        expect(response.body).toEqual({ error: 'Selected tier is at capacity' })
        expect(prismaMocks.eventRegistrationUpdate).not.toHaveBeenCalled()
    })
})