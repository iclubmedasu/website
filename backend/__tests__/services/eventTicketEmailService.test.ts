import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    eventRegistrationFindUnique: vi.fn(),
    eventRegistrationUpdate: vi.fn(),
}));

const emailMocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        eventRegistration: {
            findUnique: prismaMocks.eventRegistrationFindUnique,
            update: prismaMocks.eventRegistrationUpdate,
        },
    },
}));

vi.mock('../../services/emailService', () => emailMocks);

import {
    ICLUB_AVATAR_CID,
    ICLUB_LOGO_CID,
    IHUB_LOGO_CID,
    sendEventReminderEmail,
    sendEventTicketEmail,
    TICKET_QR_CONTENT_ID,
} from '../../services/eventTicketEmailService';

const registrationFixture = {
    id: 1,
    email: 'attendee@example.com',
    fullName: 'Jane Doe',
    confirmationCode: 'ABC123',
    status: 'REGISTERED',
    event: {
        title: 'Summit',
        venue: 'Hall A',
        eventDate: new Date('2026-06-20T10:00:00.000Z'),
        eventEndDate: new Date('2026-06-20T18:00:00.000Z'),
    },
    tier: { name: 'VIP' },
};

function expectBrandedAttachments(attachments: Array<{ contentId: string; contentType: string }>) {
    expect(attachments).toHaveLength(4);
    expect(attachments.map((attachment) => attachment.contentId)).toEqual([
        TICKET_QR_CONTENT_ID,
        ICLUB_AVATAR_CID,
        ICLUB_LOGO_CID,
        IHUB_LOGO_CID,
    ]);
    for (const attachment of attachments) {
        expect(attachment.contentType).toBe('image/png');
        expect((attachment as { content: string }).content.length).toBeGreaterThan(0);
    }
}

function expectBrandedHtml(html: string) {
    expect(html).toContain(`src="cid:${TICKET_QR_CONTENT_ID}"`);
    expect(html).toContain(`src="cid:${ICLUB_AVATAR_CID}"`);
    expect(html).toContain(`src="cid:${ICLUB_LOGO_CID}"`);
    expect(html).toContain(`src="cid:${IHUB_LOGO_CID}"`);
    expect(html).toContain('#561789');
    expect(html).toContain('color:#ffffff');
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('data:image');
}

describe('eventTicketEmailService', () => {
    beforeEach(() => {
        emailMocks.sendEmail.mockResolvedValue({ id: 'email-123' });
        prismaMocks.eventRegistrationUpdate.mockResolvedValue({});
        prismaMocks.eventRegistrationFindUnique.mockResolvedValue(registrationFixture);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('sends ticket email with branded HTML and four CID inline attachments', async () => {
        await sendEventTicketEmail(1);

        expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
        const payload = emailMocks.sendEmail.mock.calls[0][0];

        expect(payload.subject).toBe('Your ticket for Summit');
        expect(payload.html).toContain('iClub Med-asu · Event Ticket');
        expect(payload.html).toContain('Issued for personal use only');
        expect(payload.html).toContain('Present this code or QR code at the event entrance.');
        expect(payload.html).toContain('Jane Doe');
        expect(payload.html).toContain('ABC123');
        expectBrandedHtml(payload.html);
        expectBrandedAttachments(payload.attachments);
        expect(payload.attachments[0]).toEqual(expect.objectContaining({
            contentId: TICKET_QR_CONTENT_ID,
            filename: 'ticket-qr.png',
        }));
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { ticketEmailSentAt: expect.any(Date) },
        });
    });

    it('sends reminder email with reminder wording and updates reminderEmailSentAt', async () => {
        await sendEventReminderEmail(1);

        expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
        const payload = emailMocks.sendEmail.mock.calls[0][0];

        expect(payload.subject).toBe('Reminder: Summit');
        expect(payload.html).toContain('iClub Med-asu · Event Reminder');
        expect(payload.html).toContain('Reminder for your upcoming event');
        expect(payload.html).toContain('This is a reminder that you are registered for');
        expect(payload.html).toContain('We look forward to seeing you. Present this code or QR code at check-in.');
        expectBrandedHtml(payload.html);
        expectBrandedAttachments(payload.attachments);
        expect(prismaMocks.eventRegistrationUpdate).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { reminderEmailSentAt: expect.any(Date) },
        });
    });
});
