import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    teamMemberFindFirst: vi.fn(),
    teamMemberFindMany: vi.fn(),
    taskFindMany: vi.fn(),
    taskFindUnique: vi.fn(),
    taskFindFirst: vi.fn(),
    taskCreate: vi.fn(),
    taskUpdate: vi.fn(),
    taskDelete: vi.fn(),
    taskAssignmentFindFirst: vi.fn(),
    taskAssignmentCreateMany: vi.fn(),
    taskAssignmentDeleteMany: vi.fn(),
    taskAssignmentUpsert: vi.fn(),
    taskAssignmentUpdate: vi.fn(),
    taskAssignmentDelete: vi.fn(),
    taskTeamUpsert: vi.fn(),
    taskTeamCreate: vi.fn(),
    taskTeamDelete: vi.fn(),
    taskCommentFindMany: vi.fn(),
    taskCommentFindUnique: vi.fn(),
    taskCommentCreate: vi.fn(),
    taskCommentUpdate: vi.fn(),
    taskCommentDelete: vi.fn(),
    taskActivityFindMany: vi.fn(),
    taskTagUpsert: vi.fn(),
    taskTagDelete: vi.fn(),
    taskDependencyUpsert: vi.fn(),
    taskDependencyDelete: vi.fn()
}))

const activityMocks = vi.hoisted(() => ({
    collectChangedFields: vi.fn(),
    changesToPayload: vi.fn(),
    summarizeChanges: vi.fn(),
    logTaskAndProjectActivity: vi.fn()
}))

const wbsMocks = vi.hoisted(() => ({
    recomputeProjectWbs: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        teamMember: {
            findFirst: prismaMocks.teamMemberFindFirst,
            findMany: prismaMocks.teamMemberFindMany
        },
        task: {
            findMany: prismaMocks.taskFindMany,
            findUnique: prismaMocks.taskFindUnique,
            findFirst: prismaMocks.taskFindFirst,
            create: prismaMocks.taskCreate,
            update: prismaMocks.taskUpdate,
            delete: prismaMocks.taskDelete
        },
        taskAssignment: {
            findFirst: prismaMocks.taskAssignmentFindFirst,
            createMany: prismaMocks.taskAssignmentCreateMany,
            deleteMany: prismaMocks.taskAssignmentDeleteMany,
            upsert: prismaMocks.taskAssignmentUpsert,
            update: prismaMocks.taskAssignmentUpdate,
            delete: prismaMocks.taskAssignmentDelete
        },
        taskTeam: {
            upsert: prismaMocks.taskTeamUpsert,
            create: prismaMocks.taskTeamCreate,
            delete: prismaMocks.taskTeamDelete
        },
        taskComment: {
            findMany: prismaMocks.taskCommentFindMany,
            findUnique: prismaMocks.taskCommentFindUnique,
            create: prismaMocks.taskCommentCreate,
            update: prismaMocks.taskCommentUpdate,
            delete: prismaMocks.taskCommentDelete
        },
        taskActivityLog: {
            findMany: prismaMocks.taskActivityFindMany
        },
        taskTag: {
            upsert: prismaMocks.taskTagUpsert,
            delete: prismaMocks.taskTagDelete
        },
        taskDependency: {
            upsert: prismaMocks.taskDependencyUpsert,
            delete: prismaMocks.taskDependencyDelete
        }
    }
}))

vi.mock('../../services/activityLogService', () => activityMocks)
vi.mock('../../services/wbsService', () => wbsMocks)

import tasksRouter from '../../routes/tasks'

describe('tasks routes integration', () => {
    beforeEach(() => {
        activityMocks.collectChangedFields.mockReturnValue([])
        activityMocks.changesToPayload.mockReturnValue({ oldValue: {}, newValue: {} })
        activityMocks.summarizeChanges.mockReturnValue(null)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('rejects task creation for non-privileged users', async () => {
        const response = await request(buildRouteApp(tasksRouter, { memberId: 10 }))
            .post('/')
            .send({ projectId: 2, title: 'Task A' })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Only privileged and special roles can create tasks')
        expect(prismaMocks.taskCreate).not.toHaveBeenCalled()
    })

    it('creates a task for privileged users with sibling ordering', async () => {
        prismaMocks.taskFindFirst.mockResolvedValueOnce({ order: 2 })
        prismaMocks.taskCreate.mockResolvedValueOnce({
            id: 80,
            title: 'Build Module',
            project: { id: 22, title: 'Platform Upgrade' },
            taskTeams: [],
            assignments: [],
            tags: []
        })
        prismaMocks.taskFindUnique.mockResolvedValueOnce({ projectId: 22, parentTaskId: null })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 12, isSpecial: true }))
            .post('/')
            .send({
                projectId: 22,
                title: 'build module',
                assigneeIds: [],
                teamIds: []
            })

        expect(response.status).toBe(201)
        expect(response.body.id).toBe(80)
        expect(prismaMocks.taskCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                projectId: 22,
                order: 3,
                title: 'Build Module'
            })
        }))
        expect(activityMocks.logTaskAndProjectActivity).toHaveBeenCalledTimes(1)
    })

    it('blocks status change for regular users not assigned to task', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce(null)

        const response = await request(buildRouteApp(tasksRouter, { memberId: 7 }))
            .patch('/55/status')
            .send({ status: 'IN_PROGRESS' })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Only assigned members and privileged roles can change task status')
    })

    it('allows assigned member to change task status', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce({ id: 1 })
        prismaMocks.taskFindUnique
            .mockResolvedValueOnce({ status: 'NOT_STARTED' })
            .mockResolvedValueOnce({ projectId: 44, parentTaskId: null })
            .mockResolvedValueOnce({ parentTaskId: null })
        prismaMocks.taskUpdate.mockResolvedValueOnce({ id: 55, status: 'COMPLETED' })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 7 }))
            .patch('/55/status')
            .send({ status: 'COMPLETED' })

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('COMPLETED')
        expect(prismaMocks.taskUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 55 },
            data: expect.objectContaining({
                status: 'COMPLETED'
            })
        }))
        expect(activityMocks.logTaskAndProjectActivity).toHaveBeenCalledTimes(1)
    })

    it('rejects dependency that references the same task', async () => {
        const response = await request(buildRouteApp(tasksRouter, { memberId: 3, isOfficer: true }))
            .post('/77/dependencies')
            .send({ dependsOnTaskId: 77 })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('A task cannot depend on itself')
        expect(prismaMocks.taskDependencyUpsert).not.toHaveBeenCalled()
    })
})
