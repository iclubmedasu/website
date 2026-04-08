import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    teamMemberFindFirst: vi.fn(),
    teamMemberFindMany: vi.fn(),
    projectTeamFindMany: vi.fn(),
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

const notificationMocks = vi.hoisted(() => ({
    emitNotificationEvent: vi.fn(),
    resolveProjectTeamMemberIds: vi.fn(),
    resolveTaskAssigneeMemberIds: vi.fn(),
    resolveTaskCommenterMemberIds: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        teamMember: {
            findFirst: prismaMocks.teamMemberFindFirst,
            findMany: prismaMocks.teamMemberFindMany
        },
        projectTeam: {
            findMany: prismaMocks.projectTeamFindMany
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
vi.mock('../../services/notificationService', () => notificationMocks)

import tasksRouter from '../../routes/tasks'

describe('tasks routes integration', () => {
    beforeEach(() => {
        activityMocks.collectChangedFields.mockReturnValue([])
        activityMocks.changesToPayload.mockReturnValue({ oldValue: {}, newValue: {} })
        activityMocks.summarizeChanges.mockReturnValue(null)
        notificationMocks.emitNotificationEvent.mockResolvedValue(null)
        notificationMocks.resolveProjectTeamMemberIds.mockResolvedValue([])
        notificationMocks.resolveTaskAssigneeMemberIds.mockResolvedValue([])
        notificationMocks.resolveTaskCommenterMemberIds.mockResolvedValue([])
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('rejects task creation for non-privileged users', async () => {
        const response = await request(buildRouteApp(tasksRouter, { memberId: 10 }))
            .post('/')
            .send({ projectId: 2, title: 'Task A' })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Only developer, officer, administration, leadership, and special roles can create tasks')
        expect(prismaMocks.taskCreate).not.toHaveBeenCalled()
    })

    it('allows task creation for special roles under work-item policy', async () => {
        prismaMocks.taskFindFirst.mockResolvedValueOnce({ order: 4 })
        prismaMocks.taskCreate.mockResolvedValueOnce({
            id: 81,
            title: 'Task A',
            project: { id: 22, title: 'Platform Upgrade' },
            taskTeams: [],
            assignments: [],
            tags: []
        })
        prismaMocks.taskFindUnique.mockResolvedValueOnce({ projectId: 22, parentTaskId: null })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 12, isSpecial: true }))
            .post('/')
            .send({ projectId: 22, title: 'Task A' })

        expect(response.status).toBe(201)
        expect(response.body.id).toBe(81)
        expect(prismaMocks.taskCreate).toHaveBeenCalledTimes(1)
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

        const response = await request(buildRouteApp(tasksRouter, { memberId: 12, isLeadership: true }))
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

    it('emits TASK_ASSIGNED when task creation includes assignees', async () => {
        prismaMocks.taskFindFirst.mockResolvedValueOnce({ order: 2 })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ memberId: 7 }])
        prismaMocks.taskCreate.mockResolvedValueOnce({
            id: 90,
            title: 'Assigned Task',
            project: { id: 22, title: 'Platform Upgrade' },
            taskTeams: [],
            assignments: [
                { memberId: 7, member: { id: 7, fullName: 'Assigned Member', profilePhotoUrl: null } }
            ],
            tags: []
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 12, isLeadership: true }))
            .post('/')
            .send({
                projectId: 22,
                title: 'assigned task',
                assigneeIds: [7],
            })

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TASK_ASSIGNED',
            recipientMemberIds: [7],
            includeActor: false,
            persistEventWhenNoRecipients: true,
            body: 'You were assigned to task "Assigned Task" in project "Platform Upgrade".',
            metadata: expect.objectContaining({
                projectTitle: 'Platform Upgrade'
            })
        }))
    })

    it('does not emit TASK_ASSIGNED when task creation has no assignees', async () => {
        prismaMocks.taskFindFirst.mockResolvedValueOnce({ order: 2 })
        prismaMocks.taskCreate.mockResolvedValueOnce({
            id: 91,
            title: 'Unassigned Task',
            project: { id: 22, title: 'Platform Upgrade' },
            taskTeams: [],
            assignments: [],
            tags: []
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 12, isLeadership: true }))
            .post('/')
            .send({
                projectId: 22,
                title: 'unassigned task',
                assigneeIds: [],
            })

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).not.toHaveBeenCalled()
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
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TASK_STATUS_CHANGED',
            persistEventWhenNoRecipients: true
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

    it('rejects task assignment when member is outside project teams', async () => {
        prismaMocks.taskFindUnique.mockResolvedValueOnce({ id: 77, projectId: 22, isActive: true })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([])

        const response = await request(buildRouteApp(tasksRouter, { memberId: 3, isOfficer: true }))
            .post('/77/assign')
            .send({ memberId: 99 })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Assignee must belong to a team that is assigned to this project')
        expect(prismaMocks.taskAssignmentUpsert).not.toHaveBeenCalled()
    })

    it('allows task assignment when member belongs to a project team', async () => {
        prismaMocks.taskFindUnique
            .mockResolvedValueOnce({ id: 77, projectId: 22, title: 'Task A', isActive: true, project: { id: 22, title: 'Project A' } })
            .mockResolvedValueOnce({ projectId: 22, parentTaskId: null })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ memberId: 99 }])
        prismaMocks.taskAssignmentUpsert.mockResolvedValueOnce({
            taskId: 77,
            memberId: 99,
            status: 'ASSIGNED',
            member: { id: 99, fullName: 'Assigned Member', profilePhotoUrl: null }
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 3, isOfficer: true }))
            .post('/77/assign')
            .send({ memberId: 99 })

        expect(response.status).toBe(201)
        expect(response.body.memberId).toBe(99)
        expect(prismaMocks.taskAssignmentUpsert).toHaveBeenCalled()
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TASK_ASSIGNED',
            recipientMemberIds: [99],
            includeActor: false,
            persistEventWhenNoRecipients: true,
            body: 'You were assigned to task "Task A" in project "Project A".',
            metadata: expect.objectContaining({
                projectTitle: 'Project A'
            })
        }))
    })

    it('keeps self target recipient when actor assigns themselves', async () => {
        prismaMocks.taskFindUnique
            .mockResolvedValueOnce({ id: 77, projectId: 22, title: 'Self Assignable', isActive: true, project: { id: 22, title: 'Project A' } })
            .mockResolvedValueOnce({ projectId: 22, parentTaskId: null })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ memberId: 3 }])
        prismaMocks.taskAssignmentUpsert.mockResolvedValueOnce({
            taskId: 77,
            memberId: 3,
            status: 'ASSIGNED',
            member: { id: 3, fullName: 'Self Member', profilePhotoUrl: null }
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 3, isOfficer: true }))
            .post('/77/assign')
            .send({ memberId: 3 })

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TASK_ASSIGNED',
            recipientMemberIds: [3],
            includeActor: true,
            persistEventWhenNoRecipients: true
        }))
    })

    it('emits TASK_ASSIGNED when PUT update adds new assignees', async () => {
        prismaMocks.taskFindUnique
            .mockResolvedValueOnce({
                title: 'Task With New Assignee',
                description: null,
                type: 'TASK',
                priority: 'MEDIUM',
                status: 'NOT_STARTED',
                difficulty: 'MEDIUM',
                phaseId: null,
                parentTaskId: null,
                order: 1,
                startDate: null,
                dueDate: null,
                completedDate: null,
                estimatedHours: null,
                actualHours: null,
                projectId: 22,
                assignments: [{ memberId: 10 }]
            })
            .mockResolvedValueOnce({ parentTaskId: null })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ memberId: 10 }, { memberId: 99 }])
        prismaMocks.taskUpdate.mockResolvedValueOnce({
            id: 77,
            title: 'Task With New Assignee',
            description: null,
            type: 'TASK',
            priority: 'MEDIUM',
            status: 'NOT_STARTED',
            difficulty: 'MEDIUM',
            phaseId: null,
            parentTaskId: null,
            order: 1,
            startDate: null,
            dueDate: null,
            completedDate: null,
            estimatedHours: null,
            actualHours: null,
            project: { id: 22, title: 'Project A' },
            taskTeams: [],
            assignments: [
                { memberId: 10, member: { id: 10, fullName: 'Existing Member', profilePhotoUrl: null } },
                { memberId: 99, member: { id: 99, fullName: 'New Member', profilePhotoUrl: null } }
            ],
            tags: []
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 3, isOfficer: true }))
            .put('/77')
            .send({ assigneeIds: [10, 99] })

        expect(response.status).toBe(200)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TASK_ASSIGNED',
            recipientMemberIds: [99],
            includeActor: false,
            persistEventWhenNoRecipients: true,
            body: 'You were assigned to task "Task With New Assignee" in project "Project A".',
            metadata: expect.objectContaining({
                projectTitle: 'Project A'
            })
        }))
    })

    it('does not emit TASK_ASSIGNED when PUT update assignees are unchanged', async () => {
        prismaMocks.taskFindUnique
            .mockResolvedValueOnce({
                title: 'Task Without Assignee Delta',
                description: null,
                type: 'TASK',
                priority: 'MEDIUM',
                status: 'NOT_STARTED',
                difficulty: 'MEDIUM',
                phaseId: null,
                parentTaskId: null,
                order: 1,
                startDate: null,
                dueDate: null,
                completedDate: null,
                estimatedHours: null,
                actualHours: null,
                projectId: 22,
                assignments: [{ memberId: 10 }, { memberId: 99 }]
            })
            .mockResolvedValueOnce({ parentTaskId: null })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([{ memberId: 10 }, { memberId: 99 }])
        prismaMocks.taskUpdate.mockResolvedValueOnce({
            id: 77,
            title: 'Task Without Assignee Delta',
            description: null,
            type: 'TASK',
            priority: 'MEDIUM',
            status: 'NOT_STARTED',
            difficulty: 'MEDIUM',
            phaseId: null,
            parentTaskId: null,
            order: 1,
            startDate: null,
            dueDate: null,
            completedDate: null,
            estimatedHours: null,
            actualHours: null,
            project: { id: 22, title: 'Project A' },
            taskTeams: [],
            assignments: [
                { memberId: 10, member: { id: 10, fullName: 'Existing Member', profilePhotoUrl: null } },
                { memberId: 99, member: { id: 99, fullName: 'Existing Member Two', profilePhotoUrl: null } }
            ],
            tags: []
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 3, isOfficer: true }))
            .put('/77')
            .send({ assigneeIds: [10, 99] })

        expect(response.status).toBe(200)
        expect(notificationMocks.emitNotificationEvent).not.toHaveBeenCalled()
    })

    it('rejects self-assignment when member is outside project teams', async () => {
        prismaMocks.taskFindUnique.mockResolvedValueOnce({ id: 77, projectId: 22, isActive: true })
        prismaMocks.projectTeamFindMany.mockResolvedValueOnce([{ teamId: 5 }])
        prismaMocks.teamMemberFindMany.mockResolvedValueOnce([])

        const response = await request(buildRouteApp(tasksRouter, { memberId: 7 }))
            .post('/77/self-assign')

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('You must belong to a team that is assigned to this project to self-assign')
        expect(prismaMocks.taskAssignmentUpsert).not.toHaveBeenCalled()
    })

    it('blocks task comments for unassigned non-elevated users', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce(null)

        const response = await request(buildRouteApp(tasksRouter, { memberId: 31 }))
            .get('/99/comments')

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Task collaboration access denied')
        expect(prismaMocks.taskCommentFindMany).not.toHaveBeenCalled()
    })

    it('allows assigned users to fetch task comments', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce({ taskId: 99, memberId: 31 })
        prismaMocks.taskCommentFindMany.mockResolvedValueOnce([])

        const response = await request(buildRouteApp(tasksRouter, { memberId: 31 }))
            .get('/99/comments')

        expect(response.status).toBe(200)
        expect(prismaMocks.taskCommentFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { taskId: 99 }
        }))
    })

    it('emits TASK_COMMENTED with persistence when adding a comment', async () => {
        prismaMocks.taskAssignmentFindFirst.mockResolvedValueOnce({ taskId: 99, memberId: 31 })
        prismaMocks.taskCommentCreate.mockResolvedValueOnce({
            id: 15,
            taskId: 99,
            memberId: 31,
            comment: 'Looks good',
            member: { id: 31, fullName: 'Commenter', profilePhotoUrl: null }
        })
        prismaMocks.taskFindUnique.mockResolvedValueOnce({ id: 99, title: 'Task A', projectId: 22 })
        notificationMocks.resolveTaskAssigneeMemberIds.mockResolvedValueOnce([31, 44])
        notificationMocks.resolveTaskCommenterMemberIds.mockResolvedValueOnce([31])

        const response = await request(buildRouteApp(tasksRouter, { memberId: 31 }))
            .post('/99/comments')
            .send({ comment: 'Looks good' })

        expect(response.status).toBe(201)
        expect(notificationMocks.emitNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'TASK_COMMENTED',
            persistEventWhenNoRecipients: true
        }))
    })

    it('allows special role to edit non-owned comments', async () => {
        prismaMocks.taskCommentFindUnique.mockResolvedValueOnce({
            id: 7,
            taskId: 77,
            memberId: 44,
            comment: 'Initial note'
        })
        prismaMocks.taskCommentUpdate.mockResolvedValueOnce({
            id: 7,
            taskId: 77,
            memberId: 44,
            comment: 'Updated by special role',
            isEdited: true,
            member: { id: 44, fullName: 'Comment Author', profilePhotoUrl: null }
        })

        const response = await request(buildRouteApp(tasksRouter, { memberId: 12, isSpecial: true }))
            .put('/77/comments/7')
            .send({ comment: 'Updated by special role' })

        expect(response.status).toBe(200)
        expect(response.body.comment).toBe('Updated by special role')
        expect(prismaMocks.taskCommentUpdate).toHaveBeenCalledTimes(1)
    })
})
