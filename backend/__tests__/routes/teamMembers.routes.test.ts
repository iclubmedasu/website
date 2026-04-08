import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    memberFindUnique: vi.fn(),
    teamFindUnique: vi.fn(),
    teamRoleFindUnique: vi.fn(),
    teamMemberCount: vi.fn(),
    transaction: vi.fn(),
}))

const txMocks = vi.hoisted(() => ({
    teamMemberFindUnique: vi.fn(),
    teamMemberUpdate: vi.fn(),
    teamMemberCreate: vi.fn(),
    teamMemberDeleteMany: vi.fn(),
    memberRoleHistoryCreate: vi.fn(),
    memberUpdate: vi.fn(),
}))

const notificationMocks = vi.hoisted(() => ({
    emitNotificationEvent: vi.fn(),
    resolveTeamMemberIds: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findUnique: prismaMocks.memberFindUnique,
        },
        team: {
            findUnique: prismaMocks.teamFindUnique,
        },
        teamRole: {
            findUnique: prismaMocks.teamRoleFindUnique,
        },
        teamMember: {
            count: prismaMocks.teamMemberCount,
        },
        $transaction: prismaMocks.transaction,
    },
}))

vi.mock('../../services/notificationService', () => notificationMocks)

import teamMembersRouter from '../../routes/teamMembers'

describe('team members routes integration', () => {
    beforeEach(() => {
        notificationMocks.emitNotificationEvent.mockResolvedValue(null)
        notificationMocks.resolveTeamMemberIds.mockResolvedValue([7, 8])

        prismaMocks.memberFindUnique.mockResolvedValue({ id: 7, fullName: 'Member Seven' })
        prismaMocks.teamFindUnique.mockResolvedValue({ id: 5, name: 'Tech Team' })
        prismaMocks.teamRoleFindUnique.mockResolvedValue({ id: 4, teamId: 5, roleName: 'Developer', maxCount: null })
        prismaMocks.teamMemberCount.mockResolvedValue(0)

        txMocks.teamMemberFindUnique.mockResolvedValue(null)
        txMocks.teamMemberCreate.mockResolvedValue({
            id: 12,
            memberId: 7,
            teamId: 5,
            roleId: 4,
            isActive: true,
            team: { id: 5, name: 'Tech Team' },
            member: { id: 7, fullName: 'Member Seven' },
            role: { id: 4, roleName: 'Developer' },
        })
        txMocks.teamMemberUpdate.mockResolvedValue(null)
        txMocks.teamMemberDeleteMany.mockResolvedValue({ count: 0 })
        txMocks.memberRoleHistoryCreate.mockResolvedValue({ id: 44 })
        txMocks.memberUpdate.mockResolvedValue({ id: 7, assignmentStatus: 'ASSIGNED' })

        prismaMocks.transaction.mockImplementation(async (callback: any) => callback({
            teamMember: {
                findUnique: txMocks.teamMemberFindUnique,
                update: txMocks.teamMemberUpdate,
                create: txMocks.teamMemberCreate,
                deleteMany: txMocks.teamMemberDeleteMany,
            },
            memberRoleHistory: {
                create: txMocks.memberRoleHistoryCreate,
            },
            member: {
                update: txMocks.memberUpdate,
            },
        }))
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('emits TEAM_MEMBER_JOINED after successful team assignment', async () => {
        const response = await request(buildRouteApp(teamMembersRouter, { memberId: 9, isOfficer: true }))
            .post('/assign')
            .send({ memberId: 7, teamId: 5, roleId: 4 })

        expect(response.status).toBe(201)
        expect(notificationMocks.resolveTeamMemberIds).toHaveBeenCalledWith([5])
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TEAM_MEMBER_JOINED',
            persistEventWhenNoRecipients: true,
            recipientMemberIds: [7, 8],
            includeActor: false,
        }))
    })

    it('returns 400 and does not emit notification when assignment is already active', async () => {
        prismaMocks.transaction.mockRejectedValueOnce(Object.assign(new Error('already active'), { code: 'ALREADY_ACTIVE' }))

        const response = await request(buildRouteApp(teamMembersRouter, { memberId: 9, isOfficer: true }))
            .post('/assign')
            .send({ memberId: 7, teamId: 5, roleId: 4 })

        expect(response.status).toBe(400)
        expect(notificationMocks.emitNotificationEvent).not.toHaveBeenCalled()
    })
})
