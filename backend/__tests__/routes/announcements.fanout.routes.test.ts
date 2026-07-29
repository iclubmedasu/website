import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    announcementCreate: vi.fn(),
    eventFindUnique: vi.fn(),
    projectFindUnique: vi.fn(),
}))

const notificationMocks = vi.hoisted(() => ({
    emitSystemAnnouncement: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        announcement: {
            create: prismaMocks.announcementCreate,
        },
        event: {
            findUnique: prismaMocks.eventFindUnique,
        },
        project: {
            findUnique: prismaMocks.projectFindUnique,
        },
    },
}))

vi.mock('../../lib/announcementPermissions', () => ({
    canManageAnnouncements: vi.fn(() => true),
}))

vi.mock('../../lib/eventPermissions', () => ({
    canUserManageEventTasks: vi.fn(() => true),
}))

vi.mock('../../lib/projectPermissions', () => ({
    canUserViewProject: vi.fn(async () => true),
}))

vi.mock('../../services/notificationService', () => notificationMocks)

import announcementsRouter from '../../routes/announcements'

describe('POST /announcements notification fan-out', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        notificationMocks.emitSystemAnnouncement.mockResolvedValue({ eventId: 1, notificationCount: 2 })
        prismaMocks.eventFindUnique.mockResolvedValue({ id: 10 })
        prismaMocks.projectFindUnique.mockResolvedValue({ id: 5 })
        prismaMocks.announcementCreate.mockResolvedValue({
            id: 42,
            title: 'Club update',
            body: 'Please read',
            targetType: 'NONE',
            eventId: null,
            projectId: null,
            isPinned: false,
            isActive: true,
            createdByMemberId: 1,
            createdBy: { id: 1, fullName: 'Admin', profilePhotoUrl: null },
            event: null,
            project: null,
        })
    })

    it('emits system announcement to all active members after create', async () => {
        const app = buildRouteApp(announcementsRouter, { memberId: 1, isOfficer: true })

        const res = await request(app)
            .post('/')
            .send({
                title: 'Club update',
                body: 'Please read',
                targetType: 'NONE',
            })

        expect(res.status).toBe(201)
        expect(notificationMocks.emitSystemAnnouncement).toHaveBeenCalledWith({
            title: 'Club update',
            body: 'Please read',
            metadata: { announcementId: 42 },
        })
    })

    it('still fans out for EVENT-targeted announcements', async () => {
        prismaMocks.announcementCreate.mockResolvedValue({
            id: 55,
            title: 'Event call',
            body: 'Who is free?',
            targetType: 'EVENT',
            eventId: 10,
            projectId: null,
            isPinned: false,
            isActive: true,
            createdByMemberId: 1,
            createdBy: { id: 1, fullName: 'Admin', profilePhotoUrl: null },
            event: { id: 10, title: 'Meetup', slug: 'meetup', eventDate: null, eventEndDate: null },
            project: null,
        })

        const app = buildRouteApp(announcementsRouter, { memberId: 1, isOfficer: true })

        const res = await request(app)
            .post('/')
            .send({
                title: 'Event call',
                body: 'Who is free?',
                targetType: 'EVENT',
                eventId: 10,
            })

        expect(res.status).toBe(201)
        expect(notificationMocks.emitSystemAnnouncement).toHaveBeenCalledWith({
            title: 'Event call',
            body: 'Who is free?',
            metadata: { announcementId: 55 },
        })
    })
})
