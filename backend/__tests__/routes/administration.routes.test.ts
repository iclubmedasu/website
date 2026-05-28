import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    teamFindFirst: vi.fn(),
    teamFindUnique: vi.fn(),
    teamRoleFindFirst: vi.fn(),
    teamRoleFindUnique: vi.fn(),
    memberFindFirst: vi.fn(),
    memberFindUnique: vi.fn(),
    memberCreate: vi.fn(),
    teamMemberFindUnique: vi.fn(),
    teamMemberFindMany: vi.fn(),
    teamMemberUpdate: vi.fn(),
    teamMemberCreate: vi.fn(),
    teamMemberCount: vi.fn(),
    memberRoleHistoryUpdateMany: vi.fn(),
    memberRoleHistoryCreate: vi.fn(),
    memberUpdate: vi.fn(),
    alumniCreate: vi.fn(),
    teamMemberDelete: vi.fn(),
    transaction: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        team: {
            findFirst: prismaMocks.teamFindFirst,
            findUnique: prismaMocks.teamFindUnique,
        },
        teamRole: {
            findFirst: prismaMocks.teamRoleFindFirst,
            findUnique: prismaMocks.teamRoleFindUnique,
        },
        member: {
            findFirst: prismaMocks.memberFindFirst,
            findUnique: prismaMocks.memberFindUnique,
            create: prismaMocks.memberCreate,
            update: prismaMocks.memberUpdate,
        },
        teamMember: {
            findUnique: prismaMocks.teamMemberFindUnique,
            findMany: prismaMocks.teamMemberFindMany,
            update: prismaMocks.teamMemberUpdate,
            create: prismaMocks.teamMemberCreate,
            delete: prismaMocks.teamMemberDelete,
            count: prismaMocks.teamMemberCount,
        },
        memberRoleHistory: {
            updateMany: prismaMocks.memberRoleHistoryUpdateMany,
            create: prismaMocks.memberRoleHistoryCreate,
        },
        alumni: {
            create: prismaMocks.alumniCreate,
        },
        $transaction: prismaMocks.transaction,
    },
}))

import administrationRouter from '../../routes/administration'

const administrationTeamWithoutOfficer = {
    id: 1,
    name: 'Administration',
    roles: [
        { id: 11, teamId: 1, roleName: 'Officer', isActive: true },
        { id: 12, teamId: 1, roleName: 'President', isActive: true },
        { id: 13, teamId: 1, roleName: 'Vice President', isActive: true },
    ],
    members: [
        {
            id: 21,
            memberId: 21,
            isActive: true,
            joinedDate: '2026-01-01T00:00:00.000Z',
            member: { id: 21, fullName: 'President Person' },
            role: { id: 12, roleName: 'President' },
        },
        {
            id: 22,
            memberId: 22,
            isActive: true,
            joinedDate: '2026-01-02T00:00:00.000Z',
            member: { id: 22, fullName: 'Vice President Person' },
            role: { id: 13, roleName: 'Vice President' },
        },
    ],
}

const txMocks = vi.hoisted(() => ({
    teamMemberFindUnique: vi.fn(),
    teamMemberUpdate: vi.fn(),
    teamMemberCreate: vi.fn(),
    teamMemberDelete: vi.fn(),
    memberRoleHistoryUpdateMany: vi.fn(),
    memberRoleHistoryCreate: vi.fn(),
    memberUpdate: vi.fn(),
    alumniCreate: vi.fn(),
}))

function mockAdministrationTeam(team: typeof administrationTeamWithoutOfficer) {
    prismaMocks.teamFindFirst.mockResolvedValue(team)
    prismaMocks.teamFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => (
        where.id === team.id ? team : null
    ))
    prismaMocks.teamRoleFindFirst.mockImplementation(async ({ where }: { where: { teamId: number; roleName: string } }) => ({
        id: where.roleName === 'Officer' ? 11 : where.roleName === 'President' ? 12 : 13,
        teamId: where.teamId,
        roleName: where.roleName,
        isActive: true,
    }))
}

describe('administration routes', () => {
    beforeEach(() => {
        mockAdministrationTeam(administrationTeamWithoutOfficer)
        prismaMocks.memberFindFirst.mockResolvedValue(null)
        prismaMocks.memberFindUnique.mockResolvedValue(null)
        prismaMocks.memberCreate.mockResolvedValue({ id: 99, fullName: 'Pending' })
        prismaMocks.teamMemberFindUnique.mockResolvedValue(null)
        prismaMocks.teamMemberFindMany.mockResolvedValue([])
        prismaMocks.teamMemberUpdate.mockResolvedValue(null)
        prismaMocks.teamMemberCreate.mockResolvedValue(null)
        prismaMocks.teamMemberDelete.mockResolvedValue({ id: 31 })
        prismaMocks.teamMemberCount.mockResolvedValue(0)
        prismaMocks.memberRoleHistoryUpdateMany.mockResolvedValue({ count: 0 })
        prismaMocks.memberRoleHistoryCreate.mockResolvedValue({ id: 77 })
        prismaMocks.memberUpdate.mockResolvedValue({ id: 1, assignmentStatus: 'UNASSIGNED' })
        prismaMocks.alumniCreate.mockResolvedValue({ id: 88 })
        prismaMocks.teamRoleFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
            id: where.id,
            teamId: where.id === 41 ? 9 : 1,
            roleName: where.id === 41 ? 'Coordinator' : 'Officer',
            isActive: true,
        }))
        prismaMocks.teamFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => (
            where.id === administrationTeamWithoutOfficer.id
                ? administrationTeamWithoutOfficer
                : where.id === 9
                    ? {
                        id: 9,
                        name: 'Events',
                        description: 'Student activities and events',
                        icon: 'calendar',
                        isActive: true,
                        roles: [],
                        members: [],
                    }
                    : null
        ))
        prismaMocks.transaction.mockImplementation(async (callback: any) => callback({
            teamMember: {
                findUnique: txMocks.teamMemberFindUnique,
                update: txMocks.teamMemberUpdate,
                create: txMocks.teamMemberCreate,
                delete: txMocks.teamMemberDelete,
            },
            memberRoleHistory: {
                updateMany: txMocks.memberRoleHistoryUpdateMany,
                create: txMocks.memberRoleHistoryCreate,
            },
            member: {
                update: txMocks.memberUpdate,
            },
            alumni: {
                create: txMocks.alumniCreate,
            },
        }))

        txMocks.teamMemberFindUnique.mockReset()
        txMocks.teamMemberUpdate.mockReset()
        txMocks.teamMemberCreate.mockReset()
        txMocks.teamMemberDelete.mockReset()
        txMocks.memberRoleHistoryUpdateMany.mockReset()
        txMocks.memberRoleHistoryCreate.mockReset()
        txMocks.memberUpdate.mockReset()
        txMocks.alumniCreate.mockReset()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('blocks first officer bootstrap when no officer exists and caller is not president or vice president', async () => {
        const response = await request(buildRouteApp(administrationRouter, { memberId: 5, isOfficer: true, isAdmin: false }))
            .post('/officer')
            .send({ identifier: 'new.officer@med.asu.edu.eg' })

        expect(response.status).toBe(403)
        expect(prismaMocks.memberFindFirst).not.toHaveBeenCalled()
        expect(prismaMocks.memberCreate).not.toHaveBeenCalled()
    })

    it('allows president or vice president to bootstrap the first officer', async () => {
        const response = await request(buildRouteApp(administrationRouter, { memberId: 5, isAdmin: true, isOfficer: false }))
            .post('/officer')
            .send({ identifier: 'new.officer@med.asu.edu.eg' })

        expect(response.status).toBe(201)
        expect(prismaMocks.memberCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                fullName: 'Pending',
                email: 'new.officer@med.asu.edu.eg',
            }),
        }))
    })

    it('blocks leadership handover for non-admin callers', async () => {
        prismaMocks.teamMemberFindUnique.mockResolvedValue({
            id: 31,
            memberId: 31,
            teamId: 1,
            roleId: 12,
            isActive: true,
            team: { id: 1, name: 'Administration' },
            member: { id: 31, fullName: 'Current President' },
            role: { id: 12, roleName: 'President' },
        })

        const response = await request(buildRouteApp(administrationRouter, { memberId: 31, isAdmin: false }))
            .post('/leadership-handover')
            .send({ currentAssignmentId: 31, targetMemberId: 77 })

        expect(response.status).toBe(403)
    })

    it('hands over leadership and retires the outgoing leader from the club', async () => {
        prismaMocks.teamMemberFindUnique.mockResolvedValue({
            id: 31,
            memberId: 31,
            teamId: 1,
            roleId: 12,
            isActive: true,
            team: { id: 1, name: 'Administration' },
            member: { id: 31, fullName: 'Current President' },
            role: { id: 12, roleName: 'President' },
        })
        prismaMocks.memberFindUnique.mockResolvedValue({ id: 77, fullName: 'Replacement Member' })
        prismaMocks.teamMemberFindMany.mockResolvedValue([
            {
                id: 55,
                memberId: 77,
                teamId: 9,
                roleId: 4,
                isActive: true,
                team: { id: 9, name: 'Events' },
                member: { id: 77, fullName: 'Replacement Member' },
                role: { id: 4, roleName: 'Coordinator' },
            },
        ])
        prismaMocks.teamMemberCount
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
        txMocks.memberRoleHistoryUpdateMany.mockResolvedValue({ count: 1 })
        txMocks.teamMemberDelete.mockResolvedValue({ id: 31 })
        txMocks.teamMemberUpdate
            .mockResolvedValueOnce({
                id: 55,
                memberId: 77,
                teamId: 1,
                roleId: 12,
                isActive: true,
                team: { id: 1, name: 'Administration' },
                member: { id: 77, fullName: 'Replacement Member' },
                role: { id: 12, roleName: 'President' },
            })
        txMocks.memberRoleHistoryCreate.mockResolvedValue({ id: 88 })
        txMocks.alumniCreate.mockResolvedValue({ id: 66 })
        txMocks.memberUpdate.mockResolvedValueOnce({ id: 31, assignmentStatus: 'ALUMNI' })

        const response = await request(buildRouteApp(administrationRouter, { memberId: 31, isAdmin: true }))
            .post('/leadership-handover')
            .send({
                currentAssignmentId: 31,
                targetMemberId: 77,
                outgoingDisposition: 'leave',
                outgoingChangeType: 'Retirement',
                outgoingChangeReason: 'Passing the role forward',
                outgoingNotes: 'Completed as part of handover',
            })

        expect(response.status).toBe(200)
        expect(txMocks.teamMemberDelete).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 31 },
        }))
        expect(txMocks.teamMemberUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 55 },
            data: expect.objectContaining({
                teamId: 1,
                roleId: 12,
                isActive: true,
            }),
        }))
        expect(txMocks.memberRoleHistoryCreate).toHaveBeenCalledTimes(2)
        expect(txMocks.alumniCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                memberId: 31,
                leaveType: 'Retirement',
            }),
        }))
        expect(txMocks.memberUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 31 },
            data: { assignmentStatus: 'ALUMNI' },
        }))
    })

    it('transfers the outgoing leader to another team during handover', async () => {
        prismaMocks.teamMemberFindUnique.mockResolvedValue({
            id: 31,
            memberId: 31,
            teamId: 1,
            roleId: 13,
            isActive: true,
            team: { id: 1, name: 'Administration' },
            member: { id: 31, fullName: 'Current Vice President' },
            role: { id: 13, roleName: 'Vice President' },
        })
        prismaMocks.memberFindUnique.mockResolvedValue({ id: 77, fullName: 'Replacement Member' })
        prismaMocks.teamFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => (
            where.id === administrationTeamWithoutOfficer.id
                ? administrationTeamWithoutOfficer
                : where.id === 9
                    ? {
                        id: 9,
                        name: 'Events',
                        description: 'Student activities and events',
                        icon: 'calendar',
                        isActive: true,
                        roles: [],
                        members: [],
                    }
                    : null
        ))
        prismaMocks.teamRoleFindUnique.mockResolvedValue({ id: 41, teamId: 9, roleName: 'Coordinator', isActive: true })
        prismaMocks.teamMemberFindMany.mockResolvedValue([
            {
                id: 55,
                memberId: 77,
                teamId: 9,
                roleId: 41,
                isActive: true,
                team: { id: 9, name: 'Events' },
                member: { id: 77, fullName: 'Replacement Member' },
                role: { id: 41, roleName: 'Coordinator' },
            },
        ])
        txMocks.memberRoleHistoryUpdateMany.mockResolvedValue({ count: 1 })
        txMocks.teamMemberDelete.mockResolvedValue({ id: 31 })
        txMocks.teamMemberFindUnique.mockResolvedValue(null)
        txMocks.teamMemberCreate.mockResolvedValueOnce({
            id: 98,
            memberId: 31,
            teamId: 9,
            roleId: 41,
            isActive: true,
            team: { id: 9, name: 'Events' },
            member: { id: 31, fullName: 'Current Vice President' },
            role: { id: 41, roleName: 'Coordinator' },
        })
        txMocks.teamMemberUpdate.mockResolvedValueOnce({
            id: 55,
            memberId: 77,
            teamId: 1,
            roleId: 13,
            isActive: true,
            team: { id: 1, name: 'Administration' },
            member: { id: 77, fullName: 'Replacement Member' },
            role: { id: 13, roleName: 'Vice President' },
        })
        txMocks.memberRoleHistoryCreate.mockResolvedValue({ id: 88 })
        txMocks.memberUpdate.mockResolvedValueOnce({ id: 31, assignmentStatus: 'ASSIGNED' })

        const response = await request(buildRouteApp(administrationRouter, { memberId: 31, isAdmin: true }))
            .post('/leadership-handover')
            .send({
                currentAssignmentId: 31,
                targetMemberId: 77,
                outgoingDisposition: 'transfer',
                outgoingTransferTeamId: 9,
                outgoingTransferRoleId: 41,
            })

        expect(response.status).toBe(200)
        expect(txMocks.teamMemberDelete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 31 } }))
        expect(txMocks.teamMemberCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                memberId: 31,
                teamId: 9,
                roleId: 41,
            }),
        }))
        expect(txMocks.teamMemberUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 55 },
            data: expect.objectContaining({
                teamId: 1,
                roleId: 13,
                isActive: true,
            }),
        }))
        expect(txMocks.memberUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 31 },
            data: { assignmentStatus: 'ASSIGNED' },
        }))
    })
})
