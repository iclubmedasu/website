import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    memberFindFirst: vi.fn(),
    memberFindUnique: vi.fn(),
    memberUpdate: vi.fn(),
    teamMemberFindMany: vi.fn(),
    userFindFirst: vi.fn(),
    userUpdate: vi.fn(),
    userCreate: vi.fn(),
    transaction: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        member: {
            findFirst: prismaMocks.memberFindFirst,
            findUnique: prismaMocks.memberFindUnique,
            update: prismaMocks.memberUpdate
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany
        },
        user: {
            findFirst: prismaMocks.userFindFirst,
            update: prismaMocks.userUpdate,
            create: prismaMocks.userCreate
        },
        $transaction: prismaMocks.transaction
    }
}))

import authRouter from '../../routes/auth'

function buildAuthApp(): express.Express {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/', authRouter)
    return app
}

function getTokenCookie(setCookieHeader: string | string[] | undefined): string {
    const normalized =
        typeof setCookieHeader === 'string'
            ? [setCookieHeader]
            : (setCookieHeader ?? [])

    const header = normalized.find((entry) => entry.startsWith('token='))
    if (!header) {
        throw new Error('Expected token cookie header to be present')
    }
    return header
}

describe('auth routes cookie security headers', () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalDevEmail = process.env.DEVELOPER_EMAIL
    const originalDevPassword = process.env.DEVELOPER_PASSWORD
    const originalAllowDev = process.env.ALLOW_DEVELOPER_BACKDOOR

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv
        if (originalDevEmail === undefined) delete process.env.DEVELOPER_EMAIL
        else process.env.DEVELOPER_EMAIL = originalDevEmail
        if (originalDevPassword === undefined) delete process.env.DEVELOPER_PASSWORD
        else process.env.DEVELOPER_PASSWORD = originalDevPassword
        if (originalAllowDev === undefined) delete process.env.ALLOW_DEVELOPER_BACKDOOR
        else process.env.ALLOW_DEVELOPER_BACKDOOR = originalAllowDev
    })

    it('sets httpOnly token cookie on developer login and returns token in body', async () => {
        process.env.NODE_ENV = 'test'
        process.env.DEVELOPER_EMAIL = 'dev@iclub.com'
        process.env.DEVELOPER_PASSWORD = 'dev123456'

        const response = await request(buildAuthApp())
            .post('/login')
            .send({ email: 'dev@iclub.com', password: 'dev123456' })

        expect(response.status).toBe(200)
        expect(response.body.user?.email).toBe('dev@iclub.com')
        expect(typeof response.body.token).toBe('string')
        expect(response.body.token.length).toBeGreaterThan(0)

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('HttpOnly')
        expect(tokenCookie).toContain('SameSite=None')
        expect(tokenCookie).toContain('Max-Age=604800')
        expect(tokenCookie).toContain('Secure')
    })

    it('sets secure token cookie in production mode when backdoor is explicitly allowed', async () => {
        process.env.NODE_ENV = 'production'
        process.env.ALLOW_DEVELOPER_BACKDOOR = 'true'
        process.env.DEVELOPER_EMAIL = 'dev@iclub.com'
        process.env.DEVELOPER_PASSWORD = 'dev123456'

        const response = await request(buildAuthApp())
            .post('/login')
            .send({ email: 'dev@iclub.com', password: 'dev123456' })

        expect(response.status).toBe(200)
        expect(typeof response.body.token).toBe('string')

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('HttpOnly')
        expect(tokenCookie).toContain('SameSite=None')
        expect(tokenCookie).toContain('Secure')
    })

    it('clears token cookie with httpOnly attributes on logout', async () => {
        process.env.NODE_ENV = 'test'

        const response = await request(buildAuthApp())
            .post('/logout')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ success: true })

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('token=;')
        expect(tokenCookie).toContain('HttpOnly')
        expect(tokenCookie).toContain('SameSite=None')
        expect(tokenCookie).toContain('Expires=Thu, 01 Jan 1970')
    })
})
