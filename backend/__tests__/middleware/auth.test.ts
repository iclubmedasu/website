import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    findFirst: vi.fn()
}))

vi.mock('../../db', () => ({
    prisma: {
        teamMember: {
            findFirst: prismaMocks.findFirst
        }
    }
}))

import { authenticateToken, requireAdmin, JWT_SECRET } from '../../middleware/auth'

function createMockResponse(): Response {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    }

    return res as unknown as Response
}

describe('auth middleware', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('authenticateToken', () => {
        it('returns 401 when no token is provided', () => {
            const req = {
                headers: {},
                query: {}
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            authenticateToken(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
            expect(next).not.toHaveBeenCalled()
        })

        it('accepts valid bearer token and attaches user payload', () => {
            const token = jwt.sign({ memberId: 11, email: 'member@iclub.com' }, JWT_SECRET)
            const req = {
                headers: {
                    authorization: `Bearer ${token}`
                },
                query: {}
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            authenticateToken(req, res, next)

            expect(next).toHaveBeenCalledTimes(1)
            expect(req.user?.memberId).toBe(11)
            expect(req.user?.email).toBe('member@iclub.com')
        })

        it('does not accept token from query string fallback', () => {
            const token = jwt.sign({ memberId: 22 }, JWT_SECRET)
            const req = {
                headers: {},
                query: {
                    token
                }
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            authenticateToken(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
            expect(next).not.toHaveBeenCalled()
        })

        it('accepts token from cookie fallback', () => {
            const token = jwt.sign({ memberId: 33 }, JWT_SECRET)
            const req = {
                headers: {},
                cookies: {
                    token
                },
                query: {}
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            authenticateToken(req, res, next)

            expect(next).toHaveBeenCalledTimes(1)
            expect(req.user?.memberId).toBe(33)
        })

        it('returns 403 for invalid or expired token', () => {
            const req = {
                headers: {
                    authorization: 'Bearer not-a-valid-token'
                },
                query: {}
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            authenticateToken(req, res, next)

            expect(res.status).toHaveBeenCalledWith(403)
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' })
            expect(next).not.toHaveBeenCalled()
        })
    })

    describe('requireAdmin', () => {
        it('allows developer users without DB lookup', async () => {
            const req = {
                user: {
                    isDeveloper: true
                }
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            await requireAdmin(req, res, next)

            expect(next).toHaveBeenCalledTimes(1)
            expect(prismaMocks.findFirst).not.toHaveBeenCalled()
        })

        it('returns 403 when member id is missing', async () => {
            const req = {
                user: {}
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            await requireAdmin(req, res, next)

            expect(res.status).toHaveBeenCalledWith(403)
            expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' })
            expect(next).not.toHaveBeenCalled()
        })

        it('returns 403 when user is not an administration member', async () => {
            prismaMocks.findFirst.mockResolvedValueOnce(null)

            const req = {
                user: {
                    memberId: 7
                }
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            await requireAdmin(req, res, next)

            expect(prismaMocks.findFirst).toHaveBeenCalledWith({
                where: {
                    memberId: 7,
                    isActive: true,
                    team: {
                        name: 'Administration'
                    }
                }
            })
            expect(res.status).toHaveBeenCalledWith(403)
            expect(next).not.toHaveBeenCalled()
        })

        it('allows users with active administration membership', async () => {
            prismaMocks.findFirst.mockResolvedValueOnce({ id: 1001 })

            const req = {
                user: {
                    memberId: 8
                }
            } as unknown as Request
            const res = createMockResponse()
            const next = vi.fn() as unknown as NextFunction

            await requireAdmin(req, res, next)

            expect(next).toHaveBeenCalledTimes(1)
        })
    })
})
