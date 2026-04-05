import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    taskActivityCreate: vi.fn(),
    projectActivityCreate: vi.fn(),
    taskFindUnique: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        taskActivityLog: {
            create: prismaMocks.taskActivityCreate
        },
        projectActivityLog: {
            create: prismaMocks.projectActivityCreate
        },
        task: {
            findUnique: prismaMocks.taskFindUnique
        }
    }
}))

import {
    changesToPayload,
    collectChangedFields,
    logTaskAndProjectActivity,
    serializeActivityValue,
    summarizeChanges
} from '../../services/activityLogService'

describe('activityLogService', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('serializes activity values consistently', () => {
        const date = new Date('2026-04-04T00:00:00.000Z')

        expect(serializeActivityValue(undefined)).toBeNull()
        expect(serializeActivityValue(null)).toBeNull()
        expect(serializeActivityValue('text')).toBe('text')
        expect(serializeActivityValue(12)).toBe('12')
        expect(serializeActivityValue(true)).toBe('true')
        expect(serializeActivityValue(date)).toBe('2026-04-04T00:00:00.000Z')
        expect(serializeActivityValue({ field: 'value' })).toBe('{"field":"value"}')
    })

    it('collects changed fields and summarizes change labels', () => {
        const changes = collectChangedFields(
            { title: 'Old', status: 'OPEN', count: 1 },
            { title: 'New', status: 'OPEN', count: 2 },
            { title: 'Title', status: 'Status', count: 'Count' }
        )

        expect(changes).toHaveLength(2)
        expect(changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: 'title', label: 'Title', oldValue: 'Old', newValue: 'New' }),
                expect.objectContaining({ key: 'count', label: 'Count', oldValue: 1, newValue: 2 })
            ])
        )
        expect(summarizeChanges(changes)).toBe('Updated Title, Count')
        expect(summarizeChanges([])).toBeNull()
    })

    it('builds old/new payload dictionaries from change records', () => {
        const payload = changesToPayload([
            { key: 'priority', label: 'Priority', oldValue: 'LOW', newValue: 'HIGH' },
            { key: 'isActive', label: 'Active', oldValue: true, newValue: false }
        ])

        expect(payload.oldValue).toEqual({ priority: 'LOW', isActive: true })
        expect(payload.newValue).toEqual({ priority: 'HIGH', isActive: false })
    })

    it('logs both task and project activity when task resolves to a project', async () => {
        prismaMocks.taskFindUnique.mockResolvedValueOnce({ projectId: 300 })
        prismaMocks.taskActivityCreate.mockResolvedValueOnce({})
        prismaMocks.projectActivityCreate.mockResolvedValueOnce({})

        await logTaskAndProjectActivity({
            taskId: 20,
            memberId: 9,
            actionType: 'UPDATED',
            oldValue: { status: 'TODO' },
            newValue: { status: 'DONE' },
            description: 'Task status updated'
        })

        expect(prismaMocks.taskActivityCreate).toHaveBeenCalledTimes(1)
        expect(prismaMocks.projectActivityCreate).toHaveBeenCalledTimes(1)
        expect(prismaMocks.projectActivityCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                projectId: 300,
                taskId: 20,
                memberId: 9,
                entityType: 'TASK',
                actionType: 'UPDATED'
            })
        })
    })

    it('logs project activity only when project id is provided without task id', async () => {
        prismaMocks.projectActivityCreate.mockResolvedValueOnce({})

        await logTaskAndProjectActivity({
            projectId: 51,
            memberId: 10,
            actionType: 'PROJECT_NOTE_ADDED',
            description: 'Project note added'
        })

        expect(prismaMocks.taskActivityCreate).not.toHaveBeenCalled()
        expect(prismaMocks.projectActivityCreate).toHaveBeenCalledTimes(1)
        expect(prismaMocks.projectActivityCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                projectId: 51,
                taskId: null,
                memberId: 10,
                entityType: 'TASK'
            })
        })
    })

    it('logs task activity only when task has no project relation', async () => {
        prismaMocks.taskFindUnique.mockResolvedValueOnce(null)
        prismaMocks.taskActivityCreate.mockResolvedValueOnce({})

        await logTaskAndProjectActivity({
            taskId: 77,
            memberId: 12,
            actionType: 'UPDATED',
            description: 'Standalone task changed'
        })

        expect(prismaMocks.taskActivityCreate).toHaveBeenCalledTimes(1)
        expect(prismaMocks.projectActivityCreate).not.toHaveBeenCalled()
    })
})
