import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    teamMemberFindFirst: vi.fn(),
    teamMemberFindMany: vi.fn(),
    projectFindMany: vi.fn(),
    projectFindUnique: vi.fn(),
    projectFindFirst: vi.fn(),
    projectCreate: vi.fn(),
    projectUpdate: vi.fn(),
    projectPhaseCreate: vi.fn(),
    projectTeamFindFirst: vi.fn(),
    projectTeamDeleteMany: vi.fn(),
    projectTeamUpsert: vi.fn(),
    projectTeamDelete: vi.fn(),
    projectTagUpsert: vi.fn(),
    projectTagDelete: vi.fn(),
    projectActivityFindMany: vi.fn(),
    projectTypeFindMany: vi.fn(),
    taskFindMany: vi.fn(),
    taskUpdate: vi.fn(),
    taskUpdateMany: vi.fn(),
    transaction: vi.fn()
}))

const authMocks = vi.hoisted(() => ({
    requireAdmin: vi.fn((_: unknown, __: unknown, next: () => void) => next())
}))

const activityMocks = vi.hoisted(() => ({
    collectChangedFields: vi.fn(),
    changesToPayload: vi.fn(),
    summarizeChanges: vi.fn(),
    logProjectActivity: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        teamMember: {
            findFirst: prismaMocks.teamMemberFindFirst,
            findMany: prismaMocks.teamMemberFindMany
        },
        project: {
            findMany: prismaMocks.projectFindMany,
            findUnique: prismaMocks.projectFindUnique,
            findFirst: prismaMocks.projectFindFirst,
            create: prismaMocks.projectCreate,
            update: prismaMocks.projectUpdate
        },
        projectPhase: {
            create: prismaMocks.projectPhaseCreate
        },
        projectTeam: {
            findFirst: prismaMocks.projectTeamFindFirst,
            deleteMany: prismaMocks.projectTeamDeleteMany,
            upsert: prismaMocks.projectTeamUpsert,
            delete: prismaMocks.projectTeamDelete
        },
        projectTag: {
            upsert: prismaMocks.projectTagUpsert,
            delete: prismaMocks.projectTagDelete
        },
        projectActivityLog: {
            findMany: prismaMocks.projectActivityFindMany
        },
        projectType: {
            findMany: prismaMocks.projectTypeFindMany
        },
        task: {
            findMany: prismaMocks.taskFindMany,
            update: prismaMocks.taskUpdate,
            updateMany: prismaMocks.taskUpdateMany
        },
        $transaction: prismaMocks.transaction
    }
}))

vi.mock('../../middleware/auth', () => authMocks)
vi.mock('../../services/activityLogService', () => activityMocks)

import projectsRouter from '../../routes/projects'

describe('projects routes integration', () => {
    beforeEach(() => {
        activityMocks.collectChangedFields.mockReturnValue([])
        activityMocks.changesToPayload.mockReturnValue({ oldValue: {}, newValue: {} })
        activityMocks.summarizeChanges.mockReturnValue(null)

        prismaMocks.projectTeamDeleteMany.mockResolvedValue({ count: 0 })
        prismaMocks.projectTeamUpsert.mockResolvedValue({})
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('lists projects with non-admin visibility filters', async () => {
        prismaMocks.teamMemberFindFirst.mockResolvedValueOnce(null)
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ teamId: 10 }])
        prismaMocks.projectFindMany.mockResolvedValueOnce([{ id: 1, title: 'Launch Portal' }])

        const response = await request(buildRouteApp(projectsRouter, { memberId: 7 }))
            .get('/')
            .query({ createdByMe: 'true' })

        expect(response.status).toBe(200)
        expect(response.body).toEqual([{ id: 1, title: 'Launch Portal' }])

        const queryArg = prismaMocks.projectFindMany.mock.calls[0][0]
        expect(queryArg.where).toEqual(expect.objectContaining({
            createdByMemberId: 7,
            isActive: true,
            isArchived: false
        }))
        expect(queryArg.where.OR).toEqual([
            { createdByMemberId: 7 },
            { projectTeams: { some: { teamId: { in: [10] } } } }
        ])
    })

    it('rejects project creation for non-privileged users', async () => {
        const response = await request(buildRouteApp(projectsRouter, { memberId: 9 }))
            .post('/')
            .send({ title: 'new project', projectTypeId: 2 })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Only developer, officer, administration and leadership can create projects')
        expect(prismaMocks.projectCreate).not.toHaveBeenCalled()
    })

    it('creates a project and logs activity for privileged users', async () => {
        prismaMocks.projectCreate.mockResolvedValueOnce({
            id: 31,
            title: 'New Initiative',
            projectTypeId: 2,
            priority: 'MEDIUM',
            status: 'NOT_STARTED',
            createdBy: { id: 5, fullName: 'Officer User' },
            projectTeams: [],
            tags: []
        })
        prismaMocks.projectPhaseCreate.mockResolvedValueOnce({ id: 88 })

        const response = await request(buildRouteApp(projectsRouter, { memberId: 5, isOfficer: true }))
            .post('/')
            .send({
                title: 'new initiative',
                projectTypeId: 2,
                teamIds: [{ teamId: 4 }]
            })

        expect(response.status).toBe(201)
        expect(response.body.id).toBe(31)
        expect(prismaMocks.projectCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                title: 'New Initiative',
                createdByMemberId: 5
            })
        }))
        expect(activityMocks.logProjectActivity).toHaveBeenCalledTimes(1)
    })

    it('rejects finalize for non-privileged users', async () => {
        const response = await request(buildRouteApp(projectsRouter, { memberId: 2 }))
            .patch('/11/finalize')

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Only developer, officer, administration and leadership can finalize projects')
    })

    it('finalizes a project for privileged users', async () => {
        prismaMocks.projectFindUnique.mockResolvedValueOnce({
            id: 11,
            isActive: true,
            isFinalized: false,
            isArchived: false,
            status: 'IN_PROGRESS'
        })
        prismaMocks.projectUpdate.mockResolvedValueOnce({
            id: 11,
            title: 'Ops Revamp',
            status: 'COMPLETED',
            isFinalized: true,
            isArchived: false,
            isActive: true,
            createdBy: { id: 3, fullName: 'Officer User' },
            projectTeams: [],
            projectType: { id: 1, name: 'Internal', category: 'GENERAL' },
            tags: []
        })

        const response = await request(buildRouteApp(projectsRouter, { memberId: 3, isLeadership: true }))
            .patch('/11/finalize')

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('COMPLETED')
        expect(prismaMocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 11 },
            data: expect.objectContaining({
                isFinalized: true,
                status: 'COMPLETED'
            })
        }))
        expect(activityMocks.logProjectActivity).toHaveBeenCalledTimes(1)
    })
})
