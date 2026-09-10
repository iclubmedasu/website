import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    eventFindUnique: vi.fn(),
    eventCustomFieldFindMany: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
    eventRegistrationFindMany: vi.fn(),
    eventRegistrationCreate: vi.fn(),
    eventRegistrationCount: vi.fn(),
    eventRegistrationDayCreate: vi.fn(),
    memberFindFirst: vi.fn(),
    eventTierFindFirst: vi.fn(),
    eventTierFindMany: vi.fn(),
    eventSessionFindMany: vi.fn(),
    eventRegistrationSessionCreateMany: vi.fn(),
    transaction: vi.fn(),
}));

const eventCodeMocks = vi.hoisted(() => ({
    generateUniqueConfirmationCode: vi.fn(),
}));

const eventDatesMocks = vi.hoisted(() => ({
    isWithinEventDays: vi.fn(() => true),
    resolveCheckInEventDay: vi.fn(() => ({
        eventDay: '2026-06-22',
        eventDayDate: new Date('2026-06-22T00:00:00.000Z'),
    })),
    shouldSendWalkInTicket: vi.fn(() => true),
}));

const activityMocks = vi.hoisted(() => ({
    logEventActivity: vi.fn(),
}));

const ticketEmailMocks = vi.hoisted(() => ({
    sendEventTicketEmail: vi.fn(),
    sendEventReminderEmail: vi.fn(),
    queueTicketEmail: vi.fn(),
    queueReminderEmail: vi.fn(),
    enqueueTicketEmails: vi.fn(),
    enqueueReminderEmails: vi.fn(),
}));

const sessionTokenMocks = vi.hoisted(() => ({
    generateOnlineAccessToken: vi.fn(() => 'a'.repeat(48)),
    generateTokensForAllEventRegistrations: vi.fn(),
    generateTokensForSession: vi.fn().mockResolvedValue(0),
    generateTokensForRegistration: vi.fn().mockResolvedValue(0),
    ensureSessionToken: vi.fn(),
    getSessionTokensForRegistration: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../../db', () => ({
    prisma: {
        event: {
            findUnique: prismaMocks.eventFindUnique,
        },
        eventCustomField: {
            findMany: prismaMocks.eventCustomFieldFindMany,
        },
        eventRegistration: {
            findFirst: prismaMocks.eventRegistrationFindFirst,
            findMany: prismaMocks.eventRegistrationFindMany,
            create: prismaMocks.eventRegistrationCreate,
            count: prismaMocks.eventRegistrationCount,
        },
        eventRegistrationDay: {
            create: prismaMocks.eventRegistrationDayCreate,
        },
        member: {
            findFirst: prismaMocks.memberFindFirst,
        },
        eventTier: {
            findFirst: prismaMocks.eventTierFindFirst,
            findMany: prismaMocks.eventTierFindMany,
        },
        eventSession: {
            findMany: prismaMocks.eventSessionFindMany,
        },
        eventRegistrationSession: {
            createMany: prismaMocks.eventRegistrationSessionCreateMany,
        },
        $transaction: prismaMocks.transaction,
    },
}));

vi.mock('../../services/eventCode', () => eventCodeMocks);
vi.mock('../../services/activityLogService', () => activityMocks);
vi.mock('../../services/eventTicketEmailService', () => ticketEmailMocks);
vi.mock('../../services/sessionTokenService', () => sessionTokenMocks);
vi.mock('../../services/eventDates', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/eventDates')>();
    return {
        ...actual,
        isWithinEventDays: eventDatesMocks.isWithinEventDays,
        resolveCheckInEventDay: eventDatesMocks.resolveCheckInEventDay,
        shouldSendWalkInTicket: eventDatesMocks.shouldSendWalkInTicket,
    };
});

import { JWT_SECRET } from '../../middleware/auth';
import eventsRouter from '../../routes/events';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/events', eventsRouter);
    return app;
}

function createManagerToken(memberId = 12) {
    return jwt.sign({
        memberId,
        isDeveloper: true,
        isOfficer: false,
        isAdmin: false,
        isLeadership: false,
    }, JWT_SECRET);
}

const publishedEvent = {
    id: 10,
    title: 'Summit',
    status: 'PUBLISHED',
    isActive: true,
    isPublished: true,
    isArchived: false,
    allowWalkIns: true,
    eventDate: new Date('2026-06-20T10:00:00.000Z'),
    eventEndDate: new Date('2026-06-24T18:00:00.000Z'),
    registrationDeadline: null,
    capacity: null,
    tierFieldShowOnPublic: true,
    tierFieldRequired: false,
    sessionFieldShowOnPublic: false,
    sessionFieldRequired: false,
};

describe('event ticket email routes', () => {
    beforeEach(() => {
        prismaMocks.eventCustomFieldFindMany.mockResolvedValue([]);
        prismaMocks.memberFindFirst.mockResolvedValue(null);
        prismaMocks.eventRegistrationCount.mockResolvedValue(0);
        prismaMocks.eventTierFindFirst.mockResolvedValue(null);
        prismaMocks.eventTierFindMany.mockResolvedValue([]);
        prismaMocks.eventSessionFindMany.mockResolvedValue([]);
        prismaMocks.eventRegistrationSessionCreateMany.mockResolvedValue({ count: 0 });
        eventCodeMocks.generateUniqueConfirmationCode.mockResolvedValue('ABC123');
        activityMocks.logEventActivity.mockResolvedValue(undefined);
        ticketEmailMocks.sendEventTicketEmail.mockResolvedValue(undefined);
        ticketEmailMocks.enqueueTicketEmails.mockImplementation(async (ids: number[]) => ({
            batchId: 'ticket-batch-1',
            queued: ids.length,
        }));
        ticketEmailMocks.enqueueReminderEmails.mockImplementation(async (ids: number[]) => ({
            batchId: 'reminder-batch-1',
            queued: ids.length,
        }));
        eventDatesMocks.shouldSendWalkInTicket.mockReturnValue(true);
        prismaMocks.transaction.mockImplementation(async (fn: (tx: {
            eventRegistration: {
                create: typeof prismaMocks.eventRegistrationCreate
                count: typeof prismaMocks.eventRegistrationCount
            }
        }) => Promise<unknown>) => fn({
            eventRegistration: {
                create: prismaMocks.eventRegistrationCreate,
                count: prismaMocks.eventRegistrationCount,
            },
        }));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('sends ticket email after public registration', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent);
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null);
        prismaMocks.eventRegistrationCreate.mockResolvedValue({
            id: 91,
            eventId: 10,
            email: 'public@example.com',
            fullName: 'Public User',
            confirmationCode: 'PUB001',
            status: 'REGISTERED',
            source: 'PUBLIC',
            isWalkIn: false,
            tier: null,
            member: null,
        });

        const response = await request(createApp())
            .post('/events/10/registrations')
            .send({
                fullName: 'Public User',
                email: 'public@example.com',
            });

        expect(response.status).toBe(201);
        expect(ticketEmailMocks.queueTicketEmail).toHaveBeenCalledWith(91, 'public-registration');
    });

    it('does not send ticket email for manager-created registration', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent);
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null);
        prismaMocks.eventRegistrationCreate.mockResolvedValue({
            id: 92,
            eventId: 10,
            email: 'portal@example.com',
            fullName: 'Portal User',
            confirmationCode: 'POR001',
            status: 'REGISTERED',
            source: 'PORTAL',
            isWalkIn: false,
            tier: null,
            member: null,
        });

        const response = await request(createApp())
            .post('/events/10/registrations')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                fullName: 'Portal User',
                email: 'portal@example.com',
            });

        expect(response.status).toBe(201);
        expect(ticketEmailMocks.queueTicketEmail).not.toHaveBeenCalled();
    });

    it('sends ticket email for new walk-in when remaining event days exist', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent);
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null);
        prismaMocks.eventRegistrationCreate.mockResolvedValue({
            id: 93,
            eventId: 10,
            email: 'walkin@example.com',
            fullName: 'Walk In',
            confirmationCode: 'WLK001',
            status: 'CHECKED_IN',
            source: 'WALK_IN',
            isWalkIn: true,
            customFieldValues: null,
            attendanceDays: [],
            tier: null,
            member: null,
        });
        eventDatesMocks.shouldSendWalkInTicket.mockReturnValue(true);

        const response = await request(createApp())
            .post('/events/10/registrations/walk-in')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                fullName: 'Walk In',
                email: 'walkin@example.com',
            });

        expect(response.status).toBe(201);
        expect(ticketEmailMocks.queueTicketEmail).toHaveBeenCalledWith(93, 'walk-in');
    });

    it('skips ticket email for new walk-in on last event day', async () => {
        prismaMocks.eventFindUnique.mockResolvedValue(publishedEvent);
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue(null);
        prismaMocks.eventRegistrationCreate.mockResolvedValue({
            id: 94,
            eventId: 10,
            email: 'lastday@example.com',
            fullName: 'Last Day',
            confirmationCode: 'LST001',
            status: 'CHECKED_IN',
            source: 'WALK_IN',
            isWalkIn: true,
            customFieldValues: null,
            attendanceDays: [],
            tier: null,
            member: null,
        });
        eventDatesMocks.shouldSendWalkInTicket.mockReturnValue(false);

        const response = await request(createApp())
            .post('/events/10/registrations/walk-in')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({
                fullName: 'Last Day',
                email: 'lastday@example.com',
            });

        expect(response.status).toBe(201);
        expect(ticketEmailMocks.queueTicketEmail).not.toHaveBeenCalled();
    });

    it('resends ticket email for an active registration', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 95,
            email: 'resend@example.com',
            status: 'REGISTERED',
        });

        const response = await request(createApp())
            .post('/events/10/registrations/95/resend-ticket')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send();

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ok: true, message: 'Ticket email sent' });
        expect(ticketEmailMocks.sendEventTicketEmail).toHaveBeenCalledWith(95);
    });

    it('rejects resend for cancelled registration', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 96,
            email: 'cancelled@example.com',
            status: 'CANCELLED',
        });

        const response = await request(createApp())
            .post('/events/10/registrations/96/resend-ticket')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send();

        expect(response.status).toBe(409);
        expect(ticketEmailMocks.sendEventTicketEmail).not.toHaveBeenCalled();
    });

    it('requires manager access to resend ticket', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/95/resend-ticket')
            .send();

        expect(response.status).toBe(401);
        expect(ticketEmailMocks.sendEventTicketEmail).not.toHaveBeenCalled();
    });

    it('queues tickets for newly imported registration IDs', async () => {
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([
            { id: 101, email: 'alice@example.com' },
            { id: 102, email: 'import.10.guest@event-import.local' },
        ]);

        const response = await request(createApp())
            .post('/events/10/registrations/send-tickets')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({ registrationIds: [101, 102] });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            queued: 1,
            skipped: 1,
            batchId: 'ticket-batch-1',
        });
        expect(ticketEmailMocks.enqueueTicketEmails).toHaveBeenCalledTimes(1);
        expect(ticketEmailMocks.enqueueTicketEmails).toHaveBeenCalledWith([101], 'bulk-send-tickets');
        expect(ticketEmailMocks.queueTicketEmail).not.toHaveBeenCalled();
        expect(ticketEmailMocks.sendEventTicketEmail).not.toHaveBeenCalled();
    });

    it('queues tickets for all eligible registration IDs', async () => {
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([
            { id: 101, email: 'alice@example.com' },
            { id: 102, email: 'bob@example.com' },
            { id: 103, email: 'carol@example.com' },
        ]);

        const response = await request(createApp())
            .post('/events/10/registrations/send-tickets')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({ registrationIds: [101, 102, 103] });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            queued: 3,
            skipped: 0,
            batchId: 'ticket-batch-1',
        });
        expect(ticketEmailMocks.enqueueTicketEmails).toHaveBeenCalledTimes(1);
        expect(ticketEmailMocks.enqueueTicketEmails).toHaveBeenCalledWith(
            [101, 102, 103],
            'bulk-send-tickets',
        );
        expect(ticketEmailMocks.sendEventTicketEmail).not.toHaveBeenCalled();
    });

    it('requires manager access to send tickets', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/send-tickets')
            .send({ registrationIds: [101] });

        expect(response.status).toBe(401);
        expect(ticketEmailMocks.enqueueTicketEmails).not.toHaveBeenCalled();
    });

    it('requires at least one registration ID to send tickets', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/send-tickets')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({ registrationIds: [] });

        expect(response.status).toBe(400);
        expect(ticketEmailMocks.enqueueTicketEmails).not.toHaveBeenCalled();
    });

    it('filters registrations by source group and ticket status', async () => {
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([
            {
                id: 301,
                source: 'IMPORT',
                ticketEmailSentAt: null,
                attendanceDays: [],
            },
        ]);

        const response = await request(createApp())
            .get('/events/10/registrations?sourceGroup=IMPORT&ticketStatus=NOT_SENT')
            .set('Authorization', `Bearer ${createManagerToken()}`);

        expect(response.status).toBe(200);
        expect(prismaMocks.eventRegistrationFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                eventId: 10,
                source: 'IMPORT',
                ticketEmailSentAt: null,
            }),
        }));
        expect(response.body).toEqual([
            expect.objectContaining({
                id: 301,
                source: 'IMPORT',
                ticketEmailSentAt: null,
            }),
        ]);
    });

    it('filters registrations by reminder status', async () => {
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([
            {
                id: 401,
                reminderEmailSentAt: null,
                attendanceDays: [],
            },
        ]);

        const response = await request(createApp())
            .get('/events/10/registrations?reminderStatus=NOT_SENT')
            .set('Authorization', `Bearer ${createManagerToken()}`);

        expect(response.status).toBe(200);
        expect(prismaMocks.eventRegistrationFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                eventId: 10,
                reminderEmailSentAt: null,
            }),
        }));
    });

    it('resends reminder email for a registration', async () => {
        prismaMocks.eventRegistrationFindFirst.mockResolvedValue({
            id: 95,
            email: 'attendee@example.com',
            status: 'REGISTERED',
        });
        ticketEmailMocks.sendEventReminderEmail.mockResolvedValue(undefined);

        const response = await request(createApp())
            .post('/events/10/registrations/95/resend-reminder')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send();

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ok: true, message: 'Reminder email sent' });
        expect(ticketEmailMocks.sendEventReminderEmail).toHaveBeenCalledWith(95);
    });

    it('queues reminders for registration IDs', async () => {
        prismaMocks.eventRegistrationFindMany.mockResolvedValue([
            { id: 501, email: 'alice@example.com' },
            { id: 502, email: 'import.10.guest@event-import.local' },
        ]);

        const response = await request(createApp())
            .post('/events/10/registrations/send-reminders')
            .set('Authorization', `Bearer ${createManagerToken()}`)
            .send({ registrationIds: [501, 502] });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            queued: 1,
            skipped: 1,
            batchId: 'reminder-batch-1',
        });
        expect(ticketEmailMocks.enqueueReminderEmails).toHaveBeenCalledTimes(1);
        expect(ticketEmailMocks.enqueueReminderEmails).toHaveBeenCalledWith([501], 'bulk-send-reminders');
        expect(ticketEmailMocks.sendEventReminderEmail).not.toHaveBeenCalled();
    });

    it('requires manager access to send reminders', async () => {
        const response = await request(createApp())
            .post('/events/10/registrations/send-reminders')
            .send({ registrationIds: [501] });

        expect(response.status).toBe(401);
        expect(ticketEmailMocks.enqueueReminderEmails).not.toHaveBeenCalled();
    });
});
