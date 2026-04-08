import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    taskAssignmentFindFirst: vi.fn(),
    projectTeamFindMany: vi.fn(),
    teamMemberFindFirst: vi.fn(),
    taskFindUnique: vi.fn(),
    projectScheduleSlotFindMany: vi.fn(),
    projectScheduleSlotCreate: vi.fn(),
    projectScheduleSlotFindUnique: vi.fn(),
    projectScheduleSlotDelete: vi.fn(),
    projectScheduleSlotUpdate: vi.fn()
}))

const activityMocks = vi.hoisted(() => ({
    collectChangedFields: vi.fn(),
    changesToPayload: vi.fn(),
    summarizeChanges: vi.fn(),
    logProjectActivity: vi.fn()
}))

const notificationMocks = vi.hoisted(() => ({
    emitNotificationEvent: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        taskAssignment: {
            findFirst: prismaMocks.taskAssignmentFindFirst
        },
        projectTeam: {
            findMany: prismaMocks.projectTeamFindMany
        },
        teamMember: {
            findFirst: prismaMocks.teamMemberFindFirst
        },
        task: {
            findUnique: prismaMocks.taskFindUnique
        },
        projectScheduleSlot: {
            findMany: prismaMocks.projectScheduleSlotFindMany,
            create: prismaMocks.projectScheduleSlotCreate,
            findUnique: prismaMocks.projectScheduleSlotFindUnique,
            delete: prismaMocks.projectScheduleSlotDelete,
            update: prismaMocks.projectScheduleSlotUpdate
        }
    }
}))

vi.mock('../../services/activityLogService', () => activityMocks)
vi.mock('../../services/notificationService', () => notificationMocks)

import scheduleSlotsRouter from '../../routes/scheduleSlots'

describe('schedule slots routes', () => {
    beforeEach(() => {
        notificationMocks.emitNotificationEvent.mockResolvedValue(null)
        activityMocks.collectChangedFields.mockReturnValue([])
        activityMocks.changesToPayload.mockReturnValue({ oldValue: {}, newValue: {} })
        activityMocks.summarizeChanges.mockReturnValue(null)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('blocks non-elevated users from reading schedule slots when not assigned to task', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce(null)

        const response = await request(buildRouteApp(scheduleSlotsRouter, { memberId: 8 }))
            .get('/')
            .query({ taskId: 44 })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Schedule access denied')
        expect(prismaMocks.projectScheduleSlotFindMany).not.toHaveBeenCalled()
    })

    it('allows assigned non-elevated users to read schedule slots for their task', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce({ taskId: 44, memberId: 8 })
        prismaMocks.projectScheduleSlotFindMany.mockResolvedValueOnce([])

        const response = await request(buildRouteApp(scheduleSlotsRouter, { memberId: 8 }))
            .get('/')
            .query({ taskId: 44, includeInactive: true })

        expect(response.status).toBe(200)
        expect(prismaMocks.projectScheduleSlotFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ taskId: 44 })
        }))
    })

    it('blocks assigned non-elevated users from creating slots for other members', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce({ taskId: 44, memberId: 8 })

        const response = await request(buildRouteApp(scheduleSlotsRouter, { memberId: 8 }))
            .post('/')
            .send({
                taskId: 44,
                memberId: 22,
                startDateTime: '2026-01-01T09:00:00.000Z',
                endDateTime: '2026-01-01T10:00:00.000Z'
            })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Assigned members can only manage their own schedule slots')
        expect(prismaMocks.projectScheduleSlotCreate).not.toHaveBeenCalled()
    })

    it('allows special role to create schedule slots for project-assigned members', async () => {
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindFirst.mockResolvedValueOnce({ id: 1 })
        prismaMocks.projectScheduleSlotCreate.mockResolvedValueOnce({
            id: 100,
            projectId: 22,
            taskId: 44,
            memberId: 22,
            title: 'Focus block',
            startDateTime: new Date('2026-01-01T09:00:00.000Z'),
            endDateTime: new Date('2026-01-01T10:00:00.000Z'),
            member: { id: 22, fullName: 'Member 22', profilePhotoUrl: null }
        })

        const response = await request(buildRouteApp(scheduleSlotsRouter, { memberId: 12, isSpecial: true }))
            .post('/')
            .send({
                projectId: 22,
                taskId: 44,
                memberId: 22,
                title: 'Focus block',
                startDateTime: '2026-01-01T09:00:00.000Z',
                endDateTime: '2026-01-01T10:00:00.000Z'
            })

        expect(response.status).toBe(201)
        expect(response.body.id).toBe(100)
        expect(prismaMocks.projectScheduleSlotCreate).toHaveBeenCalledTimes(1)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'SCHEDULE_SLOT_ASSIGNED',
            persistEventWhenNoRecipients: true
        }))
        expect(activityMocks.logProjectActivity).toHaveBeenCalledTimes(1)
    })

    it('emits SCHEDULE_SLOT_ASSIGNED when slot assignee changes', async () => {
        prismaMocks.projectScheduleSlotFindUnique.mockResolvedValueOnce({
            projectId: 22,
            taskId: 44,
            memberId: 19,
            title: 'Pairing block',
            notes: null,
            startDateTime: new Date('2026-01-01T10:00:00.000Z'),
            endDateTime: new Date('2026-01-01T11:00:00.000Z'),
            isActive: true
        })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindFirst.mockResolvedValueOnce({ id: 1 })
        prismaMocks.projectScheduleSlotUpdate.mockResolvedValueOnce({
            id: 77,
            projectId: 22,
            taskId: 44,
            memberId: 22,
            title: 'Pairing block',
            notes: null,
            startDateTime: new Date('2026-01-01T10:00:00.000Z'),
            endDateTime: new Date('2026-01-01T11:00:00.000Z'),
            isActive: true,
            project: { id: 22, title: 'Project A' },
            task: { id: 44, title: 'Task A', parentTaskId: null },
            member: { id: 22, fullName: 'Member 22', profilePhotoUrl: null },
            createdBy: { id: 12, fullName: 'Manager' }
        })
        activityMocks.collectChangedFields.mockReturnValueOnce([{ key: 'memberId' }])
        activityMocks.changesToPayload.mockReturnValueOnce({
            oldValue: { memberId: 19 },
            newValue: { memberId: 22 }
        })
        activityMocks.summarizeChanges.mockReturnValueOnce('Schedule slot updated')

        const response = await request(buildRouteApp(scheduleSlotsRouter, { memberId: 12, isSpecial: true }))
            .patch('/77')
            .send({ memberId: 22 })

        expect(response.status).toBe(200)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'SCHEDULE_SLOT_ASSIGNED',
            persistEventWhenNoRecipients: true,
            recipientMemberIds: [22]
        }))
    })

    it('blocks assigned non-elevated users from deleting other members slots', async () => {
        prismaMocks.projectScheduleSlotFindUnique.mockResolvedValueOnce({
            projectId: 22,
            taskId: 44,
            memberId: 19,
            title: 'Pairing block',
            notes: null,
            startDateTime: new Date('2026-01-01T10:00:00.000Z'),
            endDateTime: new Date('2026-01-01T11:00:00.000Z')
        })
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce({ taskId: 44, memberId: 8 })

        const response = await request(buildRouteApp(scheduleSlotsRouter, { memberId: 8 }))
            .delete('/77')

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Assigned members can only manage their own schedule slots')
        expect(prismaMocks.projectScheduleSlotDelete).not.toHaveBeenCalled()
    })
})
