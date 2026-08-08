import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
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
import { JWT_SECRET } from '../../middleware/auth'

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

function cookieAttributeFlags(setCookieHeader: string): string[] {
    // Drop name=value segment; remaining pieces are cookie attributes (HttpOnly, Secure, …).
    return setCookieHeader
        .split(';')
        .slice(1)
        .map((part) => part.trim().split('=')[0]!.toLowerCase())
}

function expectNonProdAuthCookieAttrs(tokenCookie: string) {
    const flags = cookieAttributeFlags(tokenCookie)
    expect(tokenCookie).toContain('HttpOnly')
    expect(tokenCookie).toContain('SameSite=Lax')
    expect(flags).not.toContain('secure')
}

function expectProdAuthCookieAttrs(tokenCookie: string) {
    const flags = cookieAttributeFlags(tokenCookie)
    expect(tokenCookie).toContain('HttpOnly')
    expect(tokenCookie).toContain('SameSite=None')
    expect(flags).toContain('secure')
}

/** 7 days in seconds (web Max-Age) */
const WEB_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
/** 30 days in seconds (PWA Max-Age) */
const PWA_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

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
        expectNonProdAuthCookieAttrs(tokenCookie)
        expect(tokenCookie).toContain(`Max-Age=${WEB_MAX_AGE_SECONDS}`)

        const decoded = jwt.decode(response.body.token) as { exp: number; iat: number }
        expect(decoded.exp - decoded.iat).toBe(WEB_MAX_AGE_SECONDS)
    })

    it('sets 30-day cookie and JWT when clientSurface is pwa', async () => {
        process.env.NODE_ENV = 'test'
        process.env.DEVELOPER_EMAIL = 'dev@iclub.com'
        process.env.DEVELOPER_PASSWORD = 'dev123456'

        const response = await request(buildAuthApp())
            .post('/login')
            .send({
                email: 'dev@iclub.com',
                password: 'dev123456',
                clientSurface: 'pwa',
            })

        expect(response.status).toBe(200)
        expect(typeof response.body.token).toBe('string')

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain(`Max-Age=${PWA_MAX_AGE_SECONDS}`)

        const decoded = jwt.decode(response.body.token) as { exp: number; iat: number }
        expect(decoded.exp - decoded.iat).toBe(PWA_MAX_AGE_SECONDS)
    })

    it('sets 30-day cookie when X-Client-Surface: pwa header is sent', async () => {
        process.env.NODE_ENV = 'test'
        process.env.DEVELOPER_EMAIL = 'dev@iclub.com'
        process.env.DEVELOPER_PASSWORD = 'dev123456'

        const response = await request(buildAuthApp())
            .post('/login')
            .set('X-Client-Surface', 'pwa')
            .send({ email: 'dev@iclub.com', password: 'dev123456' })

        expect(response.status).toBe(200)
        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain(`Max-Age=${PWA_MAX_AGE_SECONDS}`)
    })

    it('re-issues a 30d PWA token on /me when remaining life is under 7d', async () => {
        process.env.NODE_ENV = 'test'
        process.env.DEVELOPER_EMAIL = 'dev@iclub.com'
        process.env.DEVELOPER_PASSWORD = 'dev123456'

        // Issue a short-lived token that mimics a near-expiry web session used in the PWA
        const nearExpiryToken = jwt.sign(
            {
                userId: 0,
                memberId: 0,
                email: 'dev@iclub.com',
                isDeveloper: true,
                isSupportFormsEditor: true,
                isFinanceViewer: true,
            },
            JWT_SECRET,
            { expiresIn: '1d' },
        )

        const response = await request(buildAuthApp())
            .get('/me')
            .set('Authorization', `Bearer ${nearExpiryToken}`)
            .set('X-Client-Surface', 'pwa')

        expect(response.status).toBe(200)
        expect(typeof response.body.token).toBe('string')
        expect(response.body.token).not.toBe(nearExpiryToken)

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain(`Max-Age=${PWA_MAX_AGE_SECONDS}`)

        const decoded = jwt.decode(response.body.token) as { exp: number; iat: number }
        expect(decoded.exp - decoded.iat).toBe(PWA_MAX_AGE_SECONDS)
    })

    it('does not re-issue on /me for web clients near expiry', async () => {
        process.env.NODE_ENV = 'test'
        process.env.DEVELOPER_EMAIL = 'dev@iclub.com'
        process.env.DEVELOPER_PASSWORD = 'dev123456'

        const nearExpiryToken = jwt.sign(
            {
                userId: 0,
                memberId: 0,
                email: 'dev@iclub.com',
                isDeveloper: true,
                isSupportFormsEditor: true,
                isFinanceViewer: true,
            },
            JWT_SECRET,
            { expiresIn: '1d' },
        )

        const response = await request(buildAuthApp())
            .get('/me')
            .set('Authorization', `Bearer ${nearExpiryToken}`)

        expect(response.status).toBe(200)
        expect(response.body.token).toBeUndefined()
        expect(response.headers['set-cookie']).toBeUndefined()
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
        expectProdAuthCookieAttrs(tokenCookie)
    })

    it('clears token cookie with httpOnly attributes on logout', async () => {
        process.env.NODE_ENV = 'test'

        const response = await request(buildAuthApp())
            .post('/logout')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ success: true })

        const tokenCookie = getTokenCookie(response.headers['set-cookie'])
        expect(tokenCookie).toContain('token=;')
        expectNonProdAuthCookieAttrs(tokenCookie)
        expect(tokenCookie).toContain('Expires=Thu, 01 Jan 1970')
    })
})
