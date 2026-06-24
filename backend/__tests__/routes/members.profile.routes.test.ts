import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    memberFindMany: vi.fn(),
    memberFindUnique: vi.fn(),
    memberFindFirst: vi.fn(),
    memberCreate: vi.fn(),
    memberUpdate: vi.fn(),
    memberRoleHistoryFindMany: vi.fn(),
    teamMemberFindFirst: vi.fn(),
    transaction: vi.fn(),
}))

const githubStorageMocks = vi.hoisted(() => ({
    uploadProfilePhoto: vi.fn(),
    deleteProfilePhoto: vi.fn(),
    invalidatePhotoCache: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findMany: prismaMocks.memberFindMany,
            findUnique: prismaMocks.memberFindUnique,
            findFirst: prismaMocks.memberFindFirst,
            create: prismaMocks.memberCreate,
            update: prismaMocks.memberUpdate,
        },
        memberRoleHistory: {
            findMany: prismaMocks.memberRoleHistoryFindMany,
        },
        teamMember: {
            findFirst: prismaMocks.teamMemberFindFirst,
        },
        $transaction: prismaMocks.transaction,
    },
}))

vi.mock('../../services/githubStorage', () => githubStorageMocks)

import membersRouter from '../../routes/members'

const baseMember = {
    id: 42,
    fullName: 'Test Member',
    email: '213256@med.asu.edu.eg',
    email2: 'extra@example.com',
    email3: null,
    phoneNumber: '+201012345678',
    phoneNumber2: null,
    studentId: 213256,
    profilePhotoUrl: null,
    linkedInUrl: 'https://linkedin.com/in/test',
    joinDate: new Date('2025-01-01T00:00:00.000Z'),
    showPhoneNumber: false,
    showPhoneNumber2: false,
    showEmail2: false,
    showEmail3: false,
    showStudentId: false,
    isActive: true,
}

describe('members profile routes', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('omits hidden contact fields from member profile response', async () => {
        prismaMocks.memberFindUnique.mockResolvedValueOnce(baseMember)
        prismaMocks.memberRoleHistoryFindMany.mockResolvedValueOnce([])

        const response = await request(buildRouteApp(membersRouter, { memberId: 1 }))
            .get('/42/profile')

        expect(response.status).toBe(200)
        expect(response.body.fullName).toBe('Test Member')
        expect(response.body.email).toBe('213256@med.asu.edu.eg')
        expect(response.body.phoneNumber).toBeNull()
        expect(response.body.email2).toBeNull()
        expect(response.body.studentId).toBeNull()
        expect(response.body.linkedInUrl).toBe('https://linkedin.com/in/test')
        expect(response.body.roleHistory).toEqual([])
    })

    it('includes contact fields when visibility flags are enabled', async () => {
        prismaMocks.memberFindUnique.mockResolvedValueOnce({
            ...baseMember,
            showPhoneNumber: true,
            showEmail2: true,
            showStudentId: true,
        })
        prismaMocks.memberRoleHistoryFindMany.mockResolvedValueOnce([])

        const response = await request(buildRouteApp(membersRouter, { memberId: 1 }))
            .get('/42/profile')

        expect(response.status).toBe(200)
        expect(response.body.phoneNumber).toBe('+201012345678')
        expect(response.body.email2).toBe('extra@example.com')
        expect(response.body.studentId).toBe(213256)
    })

    it('allows self-update of visibility flags', async () => {
        prismaMocks.memberFindUnique.mockResolvedValueOnce({
            ...baseMember,
            id: 1,
        })
        prismaMocks.memberUpdate.mockResolvedValueOnce({
            ...baseMember,
            id: 1,
            showPhoneNumber: true,
        })

        const response = await request(buildRouteApp(membersRouter, { memberId: 1 }))
            .put('/1')
            .send({ showPhoneNumber: true })

        expect(response.status).toBe(200)
        expect(prismaMocks.memberUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ showPhoneNumber: true }),
            }),
        )
    })

    it('rejects invalid visibility field types', async () => {
        const response = await request(buildRouteApp(membersRouter, { memberId: 1 }))
            .put('/1')
            .send({ showPhoneNumber: 'yes' })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('showPhoneNumber')
        expect(prismaMocks.memberUpdate).not.toHaveBeenCalled()
    })
})
