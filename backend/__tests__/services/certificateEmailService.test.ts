import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    certificateFindUnique: vi.fn(),
    certificateUpdate: vi.fn(),
}));

const emailMocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
}));

const pdfMocks = vi.hoisted(() => ({
    generateCertificatePdfBuffer: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        certificate: {
            findUnique: prismaMocks.certificateFindUnique,
            update: prismaMocks.certificateUpdate,
        },
    },
}));

vi.mock('../../services/emailService', () => emailMocks);
vi.mock('../../services/certificatePdfService', () => pdfMocks);
vi.mock('../../lib/publicWebsiteUrl', () => ({
    getPublicWebsiteUrl: () => 'https://public.example.com',
}));
vi.mock('../../lib/publicApiUrl', () => ({
    getPublicApiUrl: () => 'https://api.example.com/api',
}));

import {
    buildCertificateEmailHtml,
    buildCertificatePdfDownloadUrl,
    buildCertificateViewUrl,
    ICLUB_AVATAR_CID,
    ICLUB_LOGO_CID,
    IHUB_LOGO_CID,
    queueCertificateEmail,
    sendCertificateEmail,
} from '../../services/certificateEmailService';

const certificateFixture = {
    id: 11,
    status: 'ISSUED',
    recipientName: 'Ada Lovelace',
    recipientEmail: 'ada@example.com',
    title: 'Hackathon Winner',
    verificationCode: 'AB12CD34',
    issuedAt: new Date('2026-07-23T12:00:00.000Z'),
};

describe('certificateEmailService', () => {
    beforeEach(() => {
        emailMocks.sendEmail.mockResolvedValue({ id: 'email-123' });
        prismaMocks.certificateUpdate.mockResolvedValue({});
        prismaMocks.certificateFindUnique.mockResolvedValue(certificateFixture);
        pdfMocks.generateCertificatePdfBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('builds view and PDF download URLs', () => {
        expect(buildCertificateViewUrl('AB12CD34')).toBe(
            'https://public.example.com/verify/AB12CD34',
        );
        expect(buildCertificatePdfDownloadUrl('AB12CD34')).toBe(
            'https://api.example.com/api/certificates/verify/AB12CD34/pdf',
        );
    });

    it('builds branded HTML with View and Download CTAs', () => {
        const html = buildCertificateEmailHtml({
            recipientName: 'Ada Lovelace',
            title: 'Hackathon Winner',
            issuedDateLabel: 'July 23, 2026',
            verificationCode: 'AB12CD34',
            viewUrl: 'https://public.example.com/verify/AB12CD34',
            downloadUrl: 'https://api.example.com/api/certificates/verify/AB12CD34/pdf',
        });

        expect(html).toContain('iClub Med-asu · Certificate');
        expect(html).toContain('Ada Lovelace');
        expect(html).toContain('AB12CD34');
        expect(html).toContain('View certificate');
        expect(html).toContain('Download PDF');
        expect(html).toContain('https://public.example.com/verify/AB12CD34');
        expect(html).toContain('https://api.example.com/api/certificates/verify/AB12CD34/pdf');
        expect(html).toContain(`src="cid:${ICLUB_AVATAR_CID}"`);
        expect(html).toContain(`src="cid:${ICLUB_LOGO_CID}"`);
        expect(html).toContain(`src="cid:${IHUB_LOGO_CID}"`);
    });

    it('sends email with PDF attachment and updates certificateEmailSentAt', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await sendCertificateEmail(11);

        expect(pdfMocks.generateCertificatePdfBuffer).toHaveBeenCalledWith(11);
        expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
        const payload = emailMocks.sendEmail.mock.calls[0][0];

        expect(payload.to).toBe('ada@example.com');
        expect(payload.subject).toBe('Your certificate: Hackathon Winner');
        expect(payload.html).toContain('View certificate');
        expect(payload.html).toContain('Download PDF');

        const pdfAttachment = payload.attachments.find(
            (attachment: { filename: string }) => attachment.filename === 'certificate-AB12CD34.pdf',
        );
        expect(pdfAttachment).toEqual(expect.objectContaining({
            filename: 'certificate-AB12CD34.pdf',
            contentType: 'application/pdf',
        }));
        expect(pdfAttachment.contentId).toBeUndefined();
        expect(pdfAttachment.content.length).toBeGreaterThan(0);

        expect(prismaMocks.certificateUpdate).toHaveBeenCalledWith({
            where: { id: 11 },
            data: { certificateEmailSentAt: expect.any(Date) },
        });

        logSpy.mockRestore();
    });

    it('rejects non-issued certificates', async () => {
        prismaMocks.certificateFindUnique.mockResolvedValue({
            ...certificateFixture,
            status: 'DRAFT',
        });
        await expect(sendCertificateEmail(11)).rejects.toThrow('Certificate is not issued');
        expect(emailMocks.sendEmail).not.toHaveBeenCalled();
    });

    it('queues multiple certificate emails through the shared pool', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        prismaMocks.certificateFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
            ...certificateFixture,
            id: where.id,
            verificationCode: `CODE${where.id}`,
        }));

        queueCertificateEmail(11, 'test');
        queueCertificateEmail(12, 'test');
        queueCertificateEmail(13, 'test');

        await vi.waitFor(() => {
            expect(emailMocks.sendEmail).toHaveBeenCalledTimes(3);
        });

        const recipientIds = emailMocks.sendEmail.mock.calls.map(
            (call: [{ subject: string }]) => call[0].subject,
        );
        expect(recipientIds).toEqual(expect.arrayContaining([
            'Your certificate: Hackathon Winner',
            'Your certificate: Hackathon Winner',
            'Your certificate: Hackathon Winner',
        ]));
        expect(pdfMocks.generateCertificatePdfBuffer).toHaveBeenCalledWith(11);
        expect(pdfMocks.generateCertificatePdfBuffer).toHaveBeenCalledWith(12);
        expect(pdfMocks.generateCertificatePdfBuffer).toHaveBeenCalledWith(13);

        logSpy.mockRestore();
    });
});
