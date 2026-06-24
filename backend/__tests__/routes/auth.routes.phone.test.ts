import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    memberFindFirst: vi.fn(),
    memberFindUnique: vi.fn(),
    memberUpdate: vi.fn(),
    teamMemberFindMany: vi.fn(),
    userCreate: vi.fn(),
    transaction: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findFirst: prismaMocks.memberFindFirst,
            findUnique: prismaMocks.memberFindUnique,
            update: prismaMocks.memberUpdate,
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
        },
        user: {
            create: prismaMocks.userCreate,
        },
        $transaction: prismaMocks.transaction,
    },
}))

import authRouter from '../../routes/auth'

const placeholderOfficer = {
    id: 5,
    fullName: 'Pending',
    email: 'pending-officer-123@med.asu.edu.eg',
    phoneNumber: '+201501099918',
    phoneNumber2: null,
    studentId: null,
    user: null,
    profilePhotoUrl: null,
    linkedInUrl: null,
}

function buildAuthApp(): express.Express {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/', authRouter)
    return app
}

describe('auth routes phone sanitization', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        prismaMocks.memberFindFirst
            .mockResolvedValueOnce(placeholderOfficer)
            .mockResolvedValue(null)

        prismaMocks.memberUpdate.mockImplementation(async ({ data }: { data: { phoneNumber: string } }) => ({
            ...placeholderOfficer,
            ...data,
            fullName: 'Officer Name',
        }))

        prismaMocks.userCreate.mockResolvedValue({
            id: 10,
            memberId: placeholderOfficer.id,
            passwordHash: 'hash',
            isVerified: true,
            isActive: true,
        })

        prismaMocks.teamMemberFindMany.mockResolvedValue([])

        prismaMocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations))
    })

    it('stores deduped normalized phone when completing officer profile', async () => {
        const response = await request(buildAuthApp())
            .post('/complete-officer-profile')
            .send({
                identifier: '01501099918',
                fullName: 'Officer Name',
                phoneNumber: '015010999180150109991801501099918',
                password: 'Secure1!',
                confirmPassword: 'Secure1!',
            })

        expect(response.status).toBe(200)
        expect(response.body.user.phoneNumber).toBe('+201501099918')

        expect(prismaMocks.memberUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    phoneNumber: '+201501099918',
                }),
            }),
        )
    })
})
