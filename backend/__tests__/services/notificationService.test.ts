import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixedCreatedAt = new Date('2026-04-08T00:00:00.000Z')

const prismaMocks = vi.hoisted(() => ({
    memberFindMany: vi.fn(),
    teamMemberFindMany: vi.fn(),
    projectTeamFindMany: vi.fn(),
    taskAssignmentFindMany: vi.fn(),
    taskCommentFindMany: vi.fn(),
    notificationEventCreate: vi.fn()
}))

const realtimeMocks = vi.hoisted(() => ({
    publishNotificationCreated: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findMany: prismaMocks.memberFindMany
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany
        },
        projectTeam: {
            findMany: prismaMocks.projectTeamFindMany
        },
        taskAssignment: {
            findMany: prismaMocks.taskAssignmentFindMany
        },
        taskComment: {
            findMany: prismaMocks.taskCommentFindMany
        },
        notificationEvent: {
            create: prismaMocks.notificationEventCreate
        }
    }
}))

vi.mock('../../services/notificationsRealtime', () => realtimeMocks)

import { emitNotificationEvent } from '../../services/notificationService'

describe('notificationService emitNotificationEvent', () => {
    beforeEach(() => {
        prismaMocks.memberFindMany.mockResolvedValue([])
        prismaMocks.notificationEventCreate.mockImplementation(async ({ data }: any) => ({
            id: 501,
            notifications: (data.notifications?.create || []).map((notification: any, index: number) => ({
                id: index + 1,
                memberId: notification.memberId,
                eventType: notification.eventType,
                createdAt: fixedCreatedAt
            }))
        }))
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('skips event when actor-only recipients are excluded', async () => {
        const result = await emitNotificationEvent({
            eventType: 'TASK_ASSIGNED',
            audienceType: 'TASK',
            actorMemberId: 7,
            title: 'Task Assigned',
            body: 'You were assigned',
            recipientMemberIds: [7]
        })

        expect(result).toBeNull()
        expect(prismaMocks.notificationEventCreate).not.toHaveBeenCalled()
    })

    it('keeps actor recipient when includeActor is true', async () => {
        prismaMocks.memberFindMany.mockResolvedValueOnce([{ id: 7 }])

        const result = await emitNotificationEvent({
            eventType: 'TASK_ASSIGNED',
            audienceType: 'TASK',
            actorMemberId: 7,
            includeActor: true,
            title: 'Task Assigned',
            body: 'You were assigned',
            recipientMemberIds: [7]
        })

        expect(result).toEqual({ eventId: 501, notificationCount: 1 })
        expect(prismaMocks.notificationEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                actorMemberId: 7,
                notifications: expect.objectContaining({
                    create: expect.arrayContaining([
                        expect.objectContaining({ memberId: 7 })
                    ])
                })
            })
        }))
        expect(realtimeMocks.publishNotificationCreated).toHaveBeenCalledTimes(1)
    })

    it('persists canonical event with zero recipients when configured', async () => {
        const result = await emitNotificationEvent({
            eventType: 'TEAM_MEMBER_JOINED',
            audienceType: 'TEAM',
            actorMemberId: 9,
            persistEventWhenNoRecipients: true,
            title: 'Team Member Joined',
            body: 'Joined the team',
            recipientMemberIds: [9]
        })

        expect(result).toEqual({ eventId: 501, notificationCount: 0 })
        const createArg = prismaMocks.notificationEventCreate.mock.calls[0][0]
        expect(createArg.data.actorMemberId).toBe(9)
        expect(createArg.data.notifications).toBeUndefined()
        expect(realtimeMocks.publishNotificationCreated).not.toHaveBeenCalled()
    })
})
