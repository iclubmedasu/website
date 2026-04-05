import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    phaseFindMany: vi.fn(),
    taskFindMany: vi.fn(),
    phaseUpdate: vi.fn(),
    taskUpdate: vi.fn(),
    transaction: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        projectPhase: {
            findMany: prismaMocks.phaseFindMany,
            update: prismaMocks.phaseUpdate
        },
        task: {
            findMany: prismaMocks.taskFindMany,
            update: prismaMocks.taskUpdate
        },
        $transaction: prismaMocks.transaction
    }
}))

import { recomputeProjectWbs } from '../../services/wbsService'

describe('recomputeProjectWbs', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('recomputes phase, task, subtask, and orphan task WBS codes', async () => {
        prismaMocks.phaseFindMany.mockResolvedValueOnce([{ id: 10, wbs: null }])

        prismaMocks.taskFindMany.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
            if (where.phaseId === 10 && where.parentTaskId === null) {
                return Promise.resolve([{ id: 100, wbs: null }])
            }
            if (where.parentTaskId === 100) {
                return Promise.resolve([{ id: 101, wbs: null }])
            }
            if (where.projectId === 7 && where.phaseId === null && where.parentTaskId === null) {
                return Promise.resolve([{ id: 200, wbs: null }])
            }
            if (where.parentTaskId === 200) {
                return Promise.resolve([{ id: 201, wbs: null }])
            }
            return Promise.resolve([])
        })

        prismaMocks.phaseUpdate.mockImplementation(({ where, data }: { where: { id: number }; data: { wbs: string } }) =>
            Promise.resolve({ id: where.id, wbs: data.wbs })
        )
        prismaMocks.taskUpdate.mockImplementation(({ where, data }: { where: { id: number }; data: { wbs: string } }) =>
            Promise.resolve({ id: where.id, wbs: data.wbs })
        )
        prismaMocks.transaction.mockResolvedValueOnce([])

        await recomputeProjectWbs(7)

        expect(prismaMocks.phaseUpdate).toHaveBeenCalledWith({
            where: { id: 10 },
            data: { wbs: '1' }
        })

        const taskUpdates = prismaMocks.taskUpdate.mock.calls.map((call) => {
            const arg = call[0] as { where: { id: number }; data: { wbs: string } }
            return {
                id: arg.where.id,
                wbs: arg.data.wbs
            }
        })

        expect(taskUpdates).toEqual(
            expect.arrayContaining([
                { id: 100, wbs: '1.1' },
                { id: 101, wbs: '1.1.1' },
                { id: 200, wbs: '2' },
                { id: 201, wbs: '2.1' }
            ])
        )

        expect(prismaMocks.transaction).toHaveBeenCalledTimes(1)
        expect(prismaMocks.transaction.mock.calls[0][0]).toHaveLength(5)
    })

    it('skips transaction when there are no active phases or tasks', async () => {
        prismaMocks.phaseFindMany.mockResolvedValueOnce([])
        prismaMocks.taskFindMany.mockResolvedValueOnce([])

        await recomputeProjectWbs(99)

        expect(prismaMocks.phaseUpdate).not.toHaveBeenCalled()
        expect(prismaMocks.taskUpdate).not.toHaveBeenCalled()
        expect(prismaMocks.transaction).not.toHaveBeenCalled()
    })
})
