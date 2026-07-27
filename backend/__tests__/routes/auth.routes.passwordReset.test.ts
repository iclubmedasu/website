import cookieParser from 'cookie-parser'
import crypto from 'crypto'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    memberFindFirst: vi.fn(),
    userUpdate: vi.fn(),
    userFindFirst: vi.fn(),
}))

const emailMocks = vi.hoisted(() => ({
    sendPasswordResetEmail: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findFirst: prismaMocks.memberFindFirst,
        },
        user: {
            update: prismaMocks.userUpdate,
            findFirst: prismaMocks.userFindFirst,
        },
    },
}))

vi.mock('../../services/passwordResetEmailService', () => ({
    sendPasswordResetEmail: emailMocks.sendPasswordResetEmail,
}))

import authRouter from '../../routes/auth'

function buildAuthApp(): express.Express {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/', authRouter)
    return app
}

function hashResetToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex')
}

const GENERIC_MESSAGE =
    'If an account exists for that email, we sent password reset instructions.'

describe('auth forgot / reset password routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        emailMocks.sendPasswordResetEmail.mockResolvedValue(undefined)
        prismaMocks.userUpdate.mockResolvedValue({})
    })

    describe('POST /forgot-password', () => {
        it('returns generic success for unknown email without sending mail', async () => {
            prismaMocks.memberFindFirst.mockResolvedValue(null)

            const response = await request(buildAuthApp())
                .post('/forgot-password')
                .send({ email: 'unknown@example.com' })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                success: true,
                message: GENERIC_MESSAGE,
            })
            expect(prismaMocks.userUpdate).not.toHaveBeenCalled()
            expect(emailMocks.sendPasswordResetEmail).not.toHaveBeenCalled()
        })

        it('returns generic success when member has no user account', async () => {
            prismaMocks.memberFindFirst.mockResolvedValue({
                id: 1,
                email: 'needs-setup@med.asu.edu.eg',
                fullName: 'Needs Setup',
                isActive: true,
                user: null,
            })

            const response = await request(buildAuthApp())
                .post('/forgot-password')
                .send({ email: 'needs-setup@med.asu.edu.eg' })

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(prismaMocks.userUpdate).not.toHaveBeenCalled()
            expect(emailMocks.sendPasswordResetEmail).not.toHaveBeenCalled()
        })

        it('returns generic success for inactive users without sending mail', async () => {
            prismaMocks.memberFindFirst.mockResolvedValue({
                id: 2,
                email: 'inactive@med.asu.edu.eg',
                fullName: 'Inactive User',
                isActive: true,
                user: {
                    id: 20,
                    isActive: false,
                    passwordHash: 'hash',
                },
            })

            const response = await request(buildAuthApp())
                .post('/forgot-password')
                .send({ email: 'inactive@med.asu.edu.eg' })

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(prismaMocks.userUpdate).not.toHaveBeenCalled()
            expect(emailMocks.sendPasswordResetEmail).not.toHaveBeenCalled()
        })

        it('stores hashed token and sends reset email for an existing active user', async () => {
            prismaMocks.memberFindFirst.mockResolvedValue({
                id: 3,
                email: 'member@med.asu.edu.eg',
                fullName: 'Active Member',
                isActive: true,
                user: {
                    id: 30,
                    isActive: true,
                    passwordHash: 'hash',
                },
            })

            const response = await request(buildAuthApp())
                .post('/forgot-password')
                .send({ email: 'member@med.asu.edu.eg' })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                success: true,
                message: GENERIC_MESSAGE,
            })

            expect(prismaMocks.userUpdate).toHaveBeenCalledTimes(1)
            const updateArgs = prismaMocks.userUpdate.mock.calls[0][0]
            expect(updateArgs.where).toEqual({ id: 30 })
            expect(typeof updateArgs.data.resetToken).toBe('string')
            expect(updateArgs.data.resetToken).toHaveLength(64)
            expect(updateArgs.data.resetTokenExpiry).toBeInstanceOf(Date)
            expect(updateArgs.data.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now())

            expect(emailMocks.sendPasswordResetEmail).toHaveBeenCalledTimes(1)
            const emailArgs = emailMocks.sendPasswordResetEmail.mock.calls[0][0]
            expect(emailArgs.to).toBe('member@med.asu.edu.eg')
            expect(emailArgs.recipientName).toBe('Active Member')
            expect(typeof emailArgs.rawToken).toBe('string')
            expect(emailArgs.rawToken).toHaveLength(64)
            expect(hashResetToken(emailArgs.rawToken)).toBe(updateArgs.data.resetToken)
        })

        it('returns 500 when email send fails after token write', async () => {
            prismaMocks.memberFindFirst.mockResolvedValue({
                id: 4,
                email: 'member@med.asu.edu.eg',
                fullName: 'Active Member',
                isActive: true,
                user: {
                    id: 40,
                    isActive: true,
                    passwordHash: 'hash',
                },
            })
            emailMocks.sendPasswordResetEmail.mockRejectedValue(new Error('Resend down'))

            const response = await request(buildAuthApp())
                .post('/forgot-password')
                .send({ email: 'member@med.asu.edu.eg' })

            expect(response.status).toBe(500)
            expect(response.body.error).toMatch(/Failed to send password reset email/i)
            expect(prismaMocks.userUpdate).toHaveBeenCalledTimes(1)
            expect(emailMocks.sendPasswordResetEmail).toHaveBeenCalledTimes(1)
        })
    })

    describe('POST /reset-password', () => {
        const validPassword = 'Secure1!'

        it('rejects expired or invalid tokens', async () => {
            prismaMocks.userFindFirst.mockResolvedValue(null)

            const response = await request(buildAuthApp())
                .post('/reset-password')
                .send({
                    token: 'deadbeef',
                    password: validPassword,
                    confirmPassword: validPassword,
                })

            expect(response.status).toBe(400)
            expect(response.body.error).toMatch(/invalid or has expired/i)
            expect(prismaMocks.userUpdate).not.toHaveBeenCalled()
        })

        it('rejects when password confirmation does not match', async () => {
            const response = await request(buildAuthApp())
                .post('/reset-password')
                .send({
                    token: 'abc123',
                    password: validPassword,
                    confirmPassword: 'Different1!',
                })

            expect(response.status).toBe(400)
            expect(response.body.error).toMatch(/do not match/i)
            expect(prismaMocks.userFindFirst).not.toHaveBeenCalled()
        })

        it('resets password and clears token on success', async () => {
            const rawToken = 'a'.repeat(64)
            prismaMocks.userFindFirst.mockResolvedValue({
                id: 50,
                memberId: 5,
                passwordHash: 'old-hash',
                resetToken: hashResetToken(rawToken),
                resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
                isActive: true,
                member: {
                    isActive: true,
                    email: 'member@med.asu.edu.eg',
                    email2: null,
                    email3: null,
                },
            })

            const response = await request(buildAuthApp())
                .post('/reset-password')
                .send({
                    token: rawToken,
                    password: validPassword,
                    confirmPassword: validPassword,
                })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                success: true,
                message: 'Password updated. You can sign in with your new password.',
            })

            expect(prismaMocks.userFindFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        resetToken: hashResetToken(rawToken),
                        resetTokenExpiry: { gt: expect.any(Date) },
                        isActive: true,
                    }),
                }),
            )

            expect(prismaMocks.userUpdate).toHaveBeenCalledWith({
                where: { id: 50 },
                data: {
                    passwordHash: expect.any(String),
                    resetToken: null,
                    resetTokenExpiry: null,
                },
            })

            const newHash = prismaMocks.userUpdate.mock.calls[0][0].data.passwordHash
            expect(newHash).not.toBe('old-hash')
            expect(newHash.length).toBeGreaterThan(20)
        })

        it('rejects passwords that contain the member email', async () => {
            const rawToken = 'b'.repeat(64)
            prismaMocks.userFindFirst.mockResolvedValue({
                id: 51,
                memberId: 6,
                passwordHash: 'old-hash',
                resetToken: hashResetToken(rawToken),
                resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
                isActive: true,
                member: {
                    isActive: true,
                    email: 'alice@med.asu.edu.eg',
                    email2: null,
                    email3: null,
                },
            })

            const response = await request(buildAuthApp())
                .post('/reset-password')
                .send({
                    token: rawToken,
                    password: 'Alice123!',
                    confirmPassword: 'Alice123!',
                })

            expect(response.status).toBe(400)
            expect(response.body.error).toMatch(/must not contain your email/i)
            expect(prismaMocks.userUpdate).not.toHaveBeenCalled()
        })
    })
})
