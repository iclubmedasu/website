import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    eventSessionTokenFindFirst: vi.fn(),
    eventSessionAttendanceUpsert: vi.fn(),
    eventSessionFindMany: vi.fn(),
    eventFindUnique: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        eventSessionToken: {
            findFirst: prismaMocks.eventSessionTokenFindFirst,
        },
        eventSessionAttendance: {
            upsert: prismaMocks.eventSessionAttendanceUpsert,
        },
        eventSession: {
            findMany: prismaMocks.eventSessionFindMany,
        },
        event: {
            findMany: vi.fn(),
            findUnique: prismaMocks.eventFindUnique,
            update: vi.fn(),
            create: vi.fn(),
        },
        eventRegistration: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            count: vi.fn(),
        },
        eventRegistrationDay: { delete: vi.fn(), count: vi.fn() },
        $transaction: vi.fn(),
        eventActivityLog: { findMany: vi.fn() },
        eventTaskAssignment: { findFirst: vi.fn() },
        eventTask: { findFirst: vi.fn(), create: vi.fn() },
        eventTier: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
        eventTeam: { findFirst: vi.fn(), findMany: vi.fn() },
        teamMember: { findMany: vi.fn() },
        eventCustomField: { aggregate: vi.fn(), create: vi.fn() },
    },
}))

vi.mock('../../services/eventCode', () => ({
    generateUniqueConfirmationCode: vi.fn(),
    generateUniqueEventSlug: vi.fn().mockResolvedValue('abcdefghjkmn'),
}))
vi.mock('../../services/activityLogService', () => ({
    collectChangedFields: vi.fn(),
    changesToPayload: vi.fn(),
    summarizeChanges: vi.fn(),
    logEventActivity: vi.fn(),
}))
vi.mock('../../services/sessionTokenService', () => ({
    generateTokensForSession: vi.fn(),
    generateTokensForRegistration: vi.fn(),
}))
vi.mock('../../services/notificationService', () => ({
    emitNotificationEvent: vi.fn(),
}))
vi.mock('../../services/eventTicketEmailService', () => ({
    sendEventReminderEmail: vi.fn(),
    sendEventTicketEmail: vi.fn(),
}))

import { authenticateToken, optionalAuthenticateToken } from '../../middleware/auth'
import eventsRouter from '../../routes/events'

/** Mirrors public-event exemption wiring in routes/index.ts */
function isPublicEventRequest(req: Request): boolean {
    if (req.method === 'POST' && /^\/(?:\d+|[A-Za-z0-9]{12})\/registrations\/?$/.test(req.path)) {
        return true
    }
    if (req.method === 'GET' && /^\/(?:\d+|[A-Za-z0-9]{12})\/join\/?$/.test(req.path)) {
        return true
    }
    return false
}

function createProductionLikeApp() {
    const app = express()
    app.use(express.json())
    app.use(
        '/events',
        (req: Request, res: Response, next: NextFunction) => {
            if (isPublicEventRequest(req)) {
                return optionalAuthenticateToken(req, res, next)
            }
            return authenticateToken(req, res, next)
        },
        eventsRouter,
    )
    return app
}

function createStrictAuthApp() {
    const app = express()
    app.use(express.json())
    app.use('/events', authenticateToken, eventsRouter)
    return app
}

function onlineSessionToken(overrides?: {
    startDateTime?: Date | null
    endDateTime?: Date | null
    registrationStatus?: string
    mode?: string
    onlineUrl?: string | null
}) {
    const start = overrides?.startDateTime === undefined
        ? new Date(Date.now() - 30 * 60 * 1000)
        : overrides.startDateTime
    const end = overrides?.endDateTime === undefined
        ? new Date(Date.now() + 30 * 60 * 1000)
        : overrides.endDateTime

    return {
        registrationId: 7,
        session: {
            id: 3,
            label: 'Morning Workshop',
            onlineUrl: overrides?.onlineUrl === undefined ? 'https://meet.example/room' : overrides.onlineUrl,
            mode: overrides?.mode ?? 'ONLINE',
            sessionDate: '2026-07-12',
            startTime: '10:00',
            endTime: '11:00',
            startDateTime: start,
            endDateTime: end,
                        event: { id: 42, slug: 'abcdefghjkmn', title: 'Launch Night' },
        },
        registration: {
            id: 7,
            status: overrides?.registrationStatus ?? 'CONFIRMED',
        },
    }
}

describe('GET /events/:id/join', () => {
    beforeEach(() => {
        prismaMocks.eventSessionTokenFindFirst.mockReset()
        prismaMocks.eventSessionAttendanceUpsert.mockReset()
        prismaMocks.eventSessionFindMany.mockReset()
        prismaMocks.eventFindUnique.mockReset()
        prismaMocks.eventSessionAttendanceUpsert.mockResolvedValue({})
        prismaMocks.eventSessionFindMany.mockResolvedValue([])
        prismaMocks.eventFindUnique.mockResolvedValue({ id: 42, slug: 'abcdefghjkmn' })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('allows join without a JWT when the session token is valid and the session is active', async () => {
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(onlineSessionToken())

        const response = await request(createProductionLikeApp())
            .get('/events/42/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            status: 'ready',
            redirectUrl: 'https://meet.example/room',
            eventId: 42,
            eventTitle: 'Launch Night',
            sessionLabel: 'Morning Workshop',
        })
        expect(prismaMocks.eventSessionAttendanceUpsert).toHaveBeenCalledOnce()
    })

    it('returns 401 when join is behind strict JWT auth (pre-fix behaviour)', async () => {
        const response = await request(createStrictAuthApp())
            .get('/events/42/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(401)
        expect(response.body).toEqual({ error: 'Authentication required' })
        expect(prismaMocks.eventSessionTokenFindFirst).not.toHaveBeenCalled()
    })

    it('returns not_started with startsAt when the session has not begun', async () => {
        const startsAt = new Date(Date.now() + 15 * 60 * 1000)
        const endsAt = new Date(Date.now() + 75 * 60 * 1000)
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(
            onlineSessionToken({ startDateTime: startsAt, endDateTime: endsAt }),
        )

        const response = await request(createProductionLikeApp())
            .get('/events/42/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(409)
        expect(response.body.status).toBe('not_started')
        expect(response.body.startsAt).toBe(startsAt.toISOString())
        expect(response.body.endsAt).toBe(endsAt.toISOString())
        expect(prismaMocks.eventSessionAttendanceUpsert).not.toHaveBeenCalled()
    })

    it('returns ended when the session window is over', async () => {
        const startsAt = new Date(Date.now() - 90 * 60 * 1000)
        const endsAt = new Date(Date.now() - 30 * 60 * 1000)
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(
            onlineSessionToken({ startDateTime: startsAt, endDateTime: endsAt }),
        )

        const response = await request(createProductionLikeApp())
            .get('/events/42/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(409)
        expect(response.body.status).toBe('ended')
        expect(prismaMocks.eventSessionAttendanceUpsert).not.toHaveBeenCalled()
    })

    it('returns invalid_link when the token is unknown', async () => {
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(null)

        const response = await request(createProductionLikeApp())
            .get('/events/42/join')
            .query({ token: 'missing' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(404)
        expect(response.body.status).toBe('invalid_link')
    })

    it('returns cancelled when the registration was cancelled', async () => {
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(
            onlineSessionToken({ registrationStatus: 'CANCELLED' }),
        )

        const response = await request(createProductionLikeApp())
            .get('/events/42/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(409)
        expect(response.body.status).toBe('cancelled')
    })

    it('redirects to the online URL for browser navigations when ready', async () => {
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(onlineSessionToken())

        const response = await request(createProductionLikeApp())
            .get('/events/42/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'text/html')

        expect(response.status).toBe(302)
        expect(response.headers.location).toBe('https://meet.example/room')
    })

    it('allows join by public slug without a JWT', async () => {
        prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 42, slug: 'abcdefghjkmn' })
        prismaMocks.eventSessionTokenFindFirst.mockResolvedValueOnce(onlineSessionToken())

        const response = await request(createProductionLikeApp())
            .get('/events/abcdefghjkmn/join')
            .query({ token: 'session-token-abc' })
            .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('ready')
        expect(prismaMocks.eventSessionAttendanceUpsert).toHaveBeenCalledOnce()
    })
})
