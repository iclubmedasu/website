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

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv
    })

    it('sets httpOnly strict token cookie on developer login and omits token body field', async () => {
        process.env.NODE_ENV = 'test'

        const response = await request(buildAuthApp())
            .post('/login')
            .send({ email: 'dev@iclub.com', password: 'dev123456' })

        expect(response.status).toBe(200)
        expect(response.body.user?.email).toBe('dev@iclub.com')
        expect(response.body.token).toBeUndefined()

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('HttpOnly')
        expect(tokenCookie).toContain('SameSite=Strict')
        expect(tokenCookie).toContain('Max-Age=604800')
        expect(tokenCookie).not.toContain('Secure')
    })

    it('sets secure token cookie in production mode', async () => {
        process.env.NODE_ENV = 'production'

        const response = await request(buildAuthApp())
            .post('/login')
            .send({ email: 'dev@iclub.com', password: 'dev123456' })

        expect(response.status).toBe(200)

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('HttpOnly')
        expect(tokenCookie).toContain('SameSite=Strict')
        expect(tokenCookie).toContain('Secure')
    })

    it('clears token cookie with strict/httpOnly attributes on logout', async () => {
        process.env.NODE_ENV = 'test'

        const response = await request(buildAuthApp())
            .post('/logout')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ success: true })

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('token=;')
        expect(tokenCookie).toContain('HttpOnly')
        expect(tokenCookie).toContain('SameSite=Strict')
        expect(tokenCookie).toContain('Expires=Thu, 01 Jan 1970')
    })
})
