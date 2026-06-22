import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    eventFindUnique: vi.fn(),
    eventTaskFindFirst: vi.fn(),
    eventTaskCreate: vi.fn(),
    eventTaskUpdate: vi.fn(),
    eventTaskFindUnique: vi.fn(),
    eventTaskAssignmentDeleteMany: vi.fn(),
    eventTaskAssignmentCreateMany: vi.fn(),
    transaction: vi.fn(),
}))

const notificationMocks = vi.hoisted(() => ({
    emitNotificationEvent: vi.fn(),
}))

vi.mock('../../middleware/auth', () => ({
    authenticateToken: (_req: unknown, _res: unknown, next: () => void) => next(),
    JWT_SECRET: 'test-secret',
}))

vi.mock('../../db', () => ({
    prisma: {
        event: {
            findUnique: prismaMocks.eventFindUnique,
        },
        eventTask: {
            findFirst: prismaMocks.eventTaskFindFirst,
            create: prismaMocks.eventTaskCreate,
            update: prismaMocks.eventTaskUpdate,
            findUnique: prismaMocks.eventTaskFindUnique,
        },
        eventTaskAssignment: {
            deleteMany: prismaMocks.eventTaskAssignmentDeleteMany,
            createMany: prismaMocks.eventTaskAssignmentCreateMany,
        },
        $transaction: prismaMocks.transaction,
    },
}))

vi.mock('../../services/notificationService', () => notificationMocks)
vi.mock('../../services/eventCode', () => ({
    generateUniqueConfirmationCode: vi.fn(),
}))
vi.mock('../../services/eventDates', () => ({
    isWithinEventDays: vi.fn(),
}))

import eventsRouter from '../../routes/events'

const EVENT_ID = 10
const TASK_ID = 50
const TASK_DATE = '2026-06-10T12:00:00.000Z'
const LEADER_SLOT = {
    memberId: 5,
    startDateTime: '2026-06-10T09:00:00.000Z',
    endDateTime: '2026-06-10T10:00:00.000Z',
}
const ASSIGNEE_SLOT = {
    memberId: 7,
    startDateTime: '2026-06-10T10:00:00.000Z',
    endDateTime: '2026-06-10T11:00:00.000Z',
}

function baseCreatePayload(overrides: Record<string, unknown> = {}) {
    return {
        title: 'Setup booth',
        location: 'Hall A',
        taskDate: TASK_DATE,
        leaderId: 5,
        assignments: [LEADER_SLOT, ASSIGNEE_SLOT],
        ...overrides,
    }
}

describe('event task assignment notifications', () => {
    beforeEach(() => {
        notificationMocks.emitNotificationEvent.mockResolvedValue(null)

        prismaMocks.eventFindUnique.mockResolvedValue({
            id: EVENT_ID,
            title: 'Annual Gala',
        })

        prismaMocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                eventTask: {
                    update: prismaMocks.eventTaskUpdate,
                    findUnique: prismaMocks.eventTaskFindUnique,
                },
                eventTaskAssignment: {
                    deleteMany: prismaMocks.eventTaskAssignmentDeleteMany,
                    createMany: prismaMocks.eventTaskAssignmentCreateMany,
                },
            }
            return callback(tx)
        })

        prismaMocks.eventTaskUpdate.mockResolvedValue({})
        prismaMocks.eventTaskAssignmentDeleteMany.mockResolvedValue({ count: 0 })
        prismaMocks.eventTaskAssignmentCreateMany.mockResolvedValue({ count: 1 })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('emits EVENT_TASK_LEADER_ASSIGNED and EVENT_TASK_ASSIGNED when creating with leader and assignees', async () => {
        prismaMocks.eventTaskCreate.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: 5,
            assignments: [
                { memberId: 5, startDateTime: LEADER_SLOT.startDateTime, endDateTime: LEADER_SLOT.endDateTime },
                { memberId: 7, startDateTime: ASSIGNEE_SLOT.startDateTime, endDateTime: ASSIGNEE_SLOT.endDateTime },
            ],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .post(`/${EVENT_ID}/tasks`)
            .send(baseCreatePayload())

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledTimes(2)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_LEADER_ASSIGNED',
            audienceType: 'EVENT',
            recipientMemberIds: [5],
            includeActor: false,
            persistEventWhenNoRecipients: true,
            body: 'You were assigned as the leader for task "Setup booth" for event "Annual Gala".',
            metadata: expect.objectContaining({
                eventTaskId: TASK_ID,
                eventId: EVENT_ID,
                eventTitle: 'Annual Gala',
                leaderMemberId: 5,
            }),
        }))
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_ASSIGNED',
            audienceType: 'EVENT',
            recipientMemberIds: [7],
            includeActor: false,
            persistEventWhenNoRecipients: true,
            body: 'You were assigned to task "Setup booth" for event "Annual Gala".',
            metadata: expect.objectContaining({
                eventTaskId: TASK_ID,
                eventId: EVENT_ID,
                eventTitle: 'Annual Gala',
                assignedMemberIds: [7],
            }),
        }))
    })

    it('emits EVENT_TASK_ASSIGNED only when creating with assignees and no leader', async () => {
        prismaMocks.eventTaskCreate.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: null,
            assignments: [
                { memberId: 7, startDateTime: ASSIGNEE_SLOT.startDateTime, endDateTime: ASSIGNEE_SLOT.endDateTime },
            ],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .post(`/${EVENT_ID}/tasks`)
            .send(baseCreatePayload({
                leaderId: null,
                assignments: [ASSIGNEE_SLOT],
            }))

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledTimes(1)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_ASSIGNED',
            recipientMemberIds: [7],
        }))
    })

    it('emits EVENT_TASK_LEADER_ASSIGNED only when creating with leader-only assignment', async () => {
        prismaMocks.eventTaskCreate.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: 5,
            assignments: [
                { memberId: 5, startDateTime: LEADER_SLOT.startDateTime, endDateTime: LEADER_SLOT.endDateTime },
            ],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .post(`/${EVENT_ID}/tasks`)
            .send(baseCreatePayload({
                assignments: [LEADER_SLOT],
            }))

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledTimes(1)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_LEADER_ASSIGNED',
            recipientMemberIds: [5],
        }))
    })

    it('sets includeActor true when the actor assigns themselves as assignee', async () => {
        prismaMocks.eventTaskCreate.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: 5,
            assignments: [
                { memberId: 5, startDateTime: LEADER_SLOT.startDateTime, endDateTime: LEADER_SLOT.endDateTime },
                { memberId: 12, startDateTime: ASSIGNEE_SLOT.startDateTime, endDateTime: ASSIGNEE_SLOT.endDateTime },
            ],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .post(`/${EVENT_ID}/tasks`)
            .send(baseCreatePayload({
                assignments: [
                    LEADER_SLOT,
                    {
                        memberId: 12,
                        startDateTime: ASSIGNEE_SLOT.startDateTime,
                        endDateTime: ASSIGNEE_SLOT.endDateTime,
                    },
                ],
            }))

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_ASSIGNED',
            recipientMemberIds: [12],
            includeActor: true,
        }))
    })

    it('emits EVENT_TASK_ASSIGNED when PUT update adds a new assignee', async () => {
        prismaMocks.eventTaskFindFirst.mockResolvedValueOnce({
            id: TASK_ID,
            leaderId: 5,
            assignments: [{ memberId: 5 }, { memberId: 7 }],
        })
        prismaMocks.eventTaskFindUnique.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: 5,
            assignments: [
                { memberId: 5 },
                { memberId: 7 },
                { memberId: 99 },
            ],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .put(`/${EVENT_ID}/tasks/${TASK_ID}`)
            .send({
                assignments: [
                    LEADER_SLOT,
                    ASSIGNEE_SLOT,
                    {
                        memberId: 99,
                        startDateTime: '2026-06-10T11:00:00.000Z',
                        endDateTime: '2026-06-10T12:00:00.000Z',
                    },
                ],
            })

        expect(response.status).toBe(200)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledTimes(1)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_ASSIGNED',
            recipientMemberIds: [99],
            includeActor: false,
            body: 'You were assigned to task "Setup booth" for event "Annual Gala".',
        }))
    })

    it('does not emit EVENT_TASK_ASSIGNED when PUT update assignees are unchanged', async () => {
        prismaMocks.eventTaskFindFirst.mockResolvedValueOnce({
            id: TASK_ID,
            leaderId: 5,
            assignments: [{ memberId: 5 }, { memberId: 7 }],
        })
        prismaMocks.eventTaskFindUnique.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: 5,
            assignments: [{ memberId: 5 }, { memberId: 7 }],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .put(`/${EVENT_ID}/tasks/${TASK_ID}`)
            .send({
                assignments: [LEADER_SLOT, ASSIGNEE_SLOT],
            })

        expect(response.status).toBe(200)
        expect(notificationMocks.emitNotificationEvent).not.toHaveBeenCalled()
    })

    it('emits EVENT_TASK_LEADER_ASSIGNED when PUT update changes leader', async () => {
        prismaMocks.eventTaskFindFirst.mockResolvedValueOnce({
            id: TASK_ID,
            leaderId: 5,
            assignments: [{ memberId: 5 }, { memberId: 7 }],
        })
        prismaMocks.eventTaskFindUnique.mockResolvedValueOnce({
            id: TASK_ID,
            title: 'Setup booth',
            leaderId: 99,
            assignments: [
                { memberId: 99 },
                { memberId: 7 },
            ],
        })

        const response = await request(buildRouteApp(eventsRouter, { memberId: 12, isLeadership: true }))
            .put(`/${EVENT_ID}/tasks/${TASK_ID}`)
            .send({
                leaderId: 99,
                assignments: [
                    {
                        memberId: 99,
                        startDateTime: LEADER_SLOT.startDateTime,
                        endDateTime: LEADER_SLOT.endDateTime,
                    },
                    ASSIGNEE_SLOT,
                ],
            })

        expect(response.status).toBe(200)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'EVENT_TASK_LEADER_ASSIGNED',
            recipientMemberIds: [99],
            includeActor: false,
            metadata: expect.objectContaining({
                previousLeaderMemberId: 5,
                leaderMemberId: 99,
            }),
        }))
    })
})
