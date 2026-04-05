import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    memberFindMany: vi.fn(),
    memberFindUnique: vi.fn(),
    memberFindFirst: vi.fn(),
    memberCreate: vi.fn(),
    memberUpdate: vi.fn(),
    teamMemberFindFirst: vi.fn(),
    transaction: vi.fn()
}))

const githubStorageMocks = vi.hoisted(() => ({
    uploadProfilePhoto: vi.fn(),
    deleteProfilePhoto: vi.fn(),
    invalidatePhotoCache: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findMany: prismaMocks.memberFindMany,
            findUnique: prismaMocks.memberFindUnique,
            findFirst: prismaMocks.memberFindFirst,
            create: prismaMocks.memberCreate,
            update: prismaMocks.memberUpdate
        },
        teamMember: {
            findFirst: prismaMocks.teamMemberFindFirst
        },
        $transaction: prismaMocks.transaction
    }
}))

vi.mock('../../services/githubStorage', () => githubStorageMocks)

import membersRouter from '../../routes/members'

describe('members routes integration', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('validates required student id on member creation', async () => {
        const response = await request(buildRouteApp(membersRouter, { memberId: 1, isAdmin: true }))
            .post('/')
            .send({ fullName: 'Missing Student ID' })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('Student ID is required')
        expect(prismaMocks.memberCreate).not.toHaveBeenCalled()
    })

    it('creates member with placeholder defaults when profile fields are missing', async () => {
        prismaMocks.memberCreate.mockResolvedValueOnce({
            id: 101,
            studentId: 213256,
            fullName: 'Pending',
            email: '213256@med.asu.edu.eg',
            phoneNumber: 'pending-213256'
        })

        const response = await request(buildRouteApp(membersRouter, { memberId: 1, isAdmin: true }))
            .post('/')
            .send({ studentId: 213256 })

        expect(response.status).toBe(201)
        expect(response.body.email).toBe('213256@med.asu.edu.eg')
        expect(prismaMocks.memberCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                fullName: 'Pending',
                phoneNumber: 'pending-213256'
            })
        }))
    })

    it('rejects profile update when requester is neither self nor admin', async () => {
        prismaMocks.teamMemberFindFirst.mockResolvedValueOnce(null)

        const response = await request(buildRouteApp(membersRouter, { memberId: 1 }))
            .put('/2')
            .send({ fullName: 'Unauthorized Update' })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('You can only update your own profile')
        expect(prismaMocks.memberUpdate).not.toHaveBeenCalled()
    })

    it('allows self update and strips protected fields', async () => {
        prismaMocks.memberUpdate.mockResolvedValueOnce({ id: 2, fullName: 'Jane Doe' })

        const response = await request(buildRouteApp(membersRouter, { memberId: 2 }))
            .put('/2')
            .send({
                fullName: 'jane doe',
                email: 'should-not-change@example.com'
            })

        expect(response.status).toBe(200)
        const updateArg = prismaMocks.memberUpdate.mock.calls[0][0]
        expect(updateArg.data.fullName).toBe('Jane Doe')
        expect(updateArg.data.email).toBeUndefined()
    })

    it('rejects leave action for non-admin requesters', async () => {
        prismaMocks.teamMemberFindFirst.mockResolvedValueOnce(null)

        const response = await request(buildRouteApp(membersRouter, { memberId: 11 }))
            .post('/9/leave')
            .send({ leaveType: 'Graduation' })

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Only admins can perform this action')
    })

    it('marks unassigned member as alumni through transaction', async () => {
        prismaMocks.teamMemberFindFirst.mockResolvedValueOnce({ id: 44 })
        prismaMocks.memberFindUnique.mockResolvedValueOnce({ id: 9, assignmentStatus: 'UNASSIGNED' })

        const alumniCreate = vi.fn().mockResolvedValue({ id: 1 })
        const memberUpdate = vi.fn().mockResolvedValue({ id: 9 })
        prismaMocks.transaction.mockImplementationOnce(async (callback: (tx: any) => Promise<unknown>) => callback({
            alumni: { create: alumniCreate },
            member: { update: memberUpdate }
        }))

        const response = await request(buildRouteApp(membersRouter, { memberId: 4, isOfficer: true }))
            .post('/9/leave')
            .send({ leaveType: 'Graduation', notes: 'Batch complete' })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(alumniCreate).toHaveBeenCalledTimes(1)
        expect(memberUpdate).toHaveBeenCalledWith({
            where: { id: 9 },
            data: { assignmentStatus: 'ALUMNI' }
        })
    })
})
