import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    memberFindFirst: vi.fn(),
    memberFindUnique: vi.fn(),
    memberUpdate: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findFirst: prismaMocks.memberFindFirst,
            findUnique: prismaMocks.memberFindUnique,
            update: prismaMocks.memberUpdate,
        },
    },
}))

import authRouter from '../../routes/auth'

const PRIVATE_FIELDS = ['fullName', 'phoneNumber', 'phoneNumber2', 'email2', 'email3', 'memberId']

const invitedMember = {
    id: 42,
    fullName: 'Real Member Name',
    email: '213256@med.asu.edu.eg',
    email2: 'personal@gmail.com',
    email3: 'other@outlook.com',
    phoneNumber: '+201001234567',
    phoneNumber2: '+201112345678',
    studentId: 213256,
    user: null,
}

function buildAuthApp(): express.Express {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/', authRouter)
    return app
}

describe('unauthenticated identity checks do not leak profile details', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMocks.memberFindFirst.mockResolvedValue(null)
        prismaMocks.memberFindUnique.mockResolvedValue(null)
    })

    it('/check-email by student ID returns only what the next step needs', async () => {
        prismaMocks.memberFindUnique.mockResolvedValue(invitedMember)

        const res = await request(buildAuthApp())
            .post('/check-email')
            .send({ email: '213256' })

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({
            exists: true,
            needsSetup: true,
            email: invitedMember.email,
            studentId: invitedMember.studentId,
        })
        for (const field of PRIVATE_FIELDS) {
            expect(res.body).not.toHaveProperty(field)
        }
    })

    it('/check-email by phone does not echo the stored phones or name', async () => {
        prismaMocks.memberFindFirst.mockResolvedValue({ ...invitedMember, studentId: null })

        const res = await request(buildAuthApp())
            .post('/check-email')
            .send({ email: '01001234567' })

        expect(res.status).toBe(200)
        expect(res.body.needsSetup).toBe(true)
        for (const field of PRIVATE_FIELDS) {
            expect(res.body).not.toHaveProperty(field)
        }
        expect(JSON.stringify(res.body)).not.toContain('Real Member Name')
        expect(JSON.stringify(res.body)).not.toContain('+20111')
    })

    it('/check-officer-identifier returns no id, email, or phone', async () => {
        prismaMocks.memberFindFirst.mockResolvedValue({
            ...invitedMember,
            fullName: 'Pending',
            studentId: null,
        })

        const res = await request(buildAuthApp())
            .post('/check-officer-identifier')
            .send({ identifier: '01001234567' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ exists: true, needsSetup: true })
    })
})

describe('/update-invited-profile keeps stored optional fields left blank', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // First lookup finds the invited member; uniqueness checks find nobody.
        prismaMocks.memberFindFirst
            .mockResolvedValueOnce(invitedMember)
            .mockResolvedValue(null)
        prismaMocks.memberUpdate.mockResolvedValue(invitedMember)
    })

    it('does not overwrite phone 2 / email 2 / email 3 with null', async () => {
        const res = await request(buildAuthApp())
            .post('/update-invited-profile')
            .send({
                email: invitedMember.email,
                fullName: 'Real Member Name',
                phoneNumber: '+201001234567',
                phoneNumber2: '',
                email2: '',
                email3: '',
            })

        expect(res.status).toBe(200)
        const { data } = prismaMocks.memberUpdate.mock.calls[0][0]
        expect(data).not.toHaveProperty('phoneNumber2')
        expect(data).not.toHaveProperty('email2')
        expect(data).not.toHaveProperty('email3')
    })

    it('still saves optional fields the member does fill in', async () => {
        const res = await request(buildAuthApp())
            .post('/update-invited-profile')
            .send({
                email: invitedMember.email,
                fullName: 'Real Member Name',
                phoneNumber: '+201001234567',
                email2: 'new@gmail.com',
            })

        expect(res.status).toBe(200)
        const { data } = prismaMocks.memberUpdate.mock.calls[0][0]
        expect(data.email2).toBe('new@gmail.com')
    })
})
