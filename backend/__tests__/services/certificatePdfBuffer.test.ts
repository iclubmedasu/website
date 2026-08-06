import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

const prismaMocks = vi.hoisted(() => ({
    certificateFindUnique: vi.fn(),
    certificateFindFirst: vi.fn(),
}));

const backgroundMocks = vi.hoisted(() => ({
    loadCertificateBackground: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        certificate: {
            findUnique: prismaMocks.certificateFindUnique,
            findFirst: prismaMocks.certificateFindFirst,
        },
    },
}));

vi.mock('../../lib/certificateBackgroundCache', () => backgroundMocks);

vi.mock('../../lib/publicWebsiteUrl', () => ({
    getPublicWebsiteUrl: () => 'https://public.example.com',
}));

import { PDFDocument } from 'pdf-lib';
import {
    generateCertificatePdfBuffer,
    renderBackgroundJpeg,
} from '../../services/certificatePdfService';

const PDF_SIZE_BUDGET_BYTES = 2.5 * 1024 * 1024;

const layoutWithRecipient = [
    {
        id: 'name',
        type: 'field',
        field: 'recipientName',
        x: 100,
        y: 200,
        width: 800,
        height: 60,
        fontSize: 28,
        fontWeight: 'bold',
        align: 'center',
        color: '#111111',
    },
    {
        id: 'title',
        type: 'field',
        field: 'title',
        x: 100,
        y: 280,
        width: 800,
        height: 40,
        fontSize: 18,
        fontWeight: 'normal',
        align: 'center',
        color: '#333333',
    },
    {
        id: 'verify-qr',
        type: 'qr',
        x: 900,
        y: 560,
        width: 160,
        height: 160,
    },
];

describe('generateCertificatePdfBuffer', () => {
    beforeEach(() => {
        prismaMocks.certificateFindUnique.mockResolvedValue({
            id: 5,
            recipientName: 'Ada Lovelace',
            title: 'Hackathon',
            description: 'For excellence',
            verificationCode: 'CODE9999',
            issuedAt: new Date('2026-07-23T12:00:00.000Z'),
            fieldValues: {},
            template: null,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('generates a simple branded PDF when no template is set', async () => {
        const buffer = await generateCertificatePdfBuffer(5);
        expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');

        const pdf = await PDFDocument.load(buffer);
        expect(pdf.getPageCount()).toBe(1);
        const page = pdf.getPage(0);
        expect(page.getWidth()).toBe(1122);
        expect(page.getHeight()).toBe(794);
    });

    it('does not throw for Arabic recipient names', async () => {
        prismaMocks.certificateFindUnique.mockResolvedValue({
            id: 6,
            recipientName: 'محمد أحمد',
            title: 'شهادة تقدير',
            description: 'لمساهمته المتميزة في الفعالية',
            verificationCode: 'ARABIC01',
            issuedAt: new Date('2026-07-23T12:00:00.000Z'),
            fieldValues: {},
            template: {
                canvasWidth: 1122,
                canvasHeight: 794,
                layout: layoutWithRecipient,
                backgroundFocus: { scale: 1, offsetX: 0.5, offsetY: 0.5 },
                backgroundImagePath: null,
                backgroundImageSha: null,
            },
        });

        const buffer = await generateCertificatePdfBuffer(6);
        expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
        expect(buffer.length).toBeGreaterThan(500);
    });

    it('keeps template-with-background PDF under the email size budget', async () => {
        const canvasW = 1122;
        const canvasH = 794;
        // Large source similar to uploaded certificate art (PNG would be multi-MB).
        const backgroundPng = await sharp({
            create: {
                width: 3000,
                height: 2120,
                channels: 3,
                background: { r: 86, g: 23, b: 137 },
            },
        })
            .png()
            .toBuffer();

        backgroundMocks.loadCertificateBackground.mockResolvedValue({
            buffer: backgroundPng,
            sha: 'test-sha',
        });

        prismaMocks.certificateFindUnique.mockResolvedValue({
            id: 7,
            recipientName: 'Ada Lovelace',
            title: 'Hackathon Winner',
            description: 'For outstanding contribution',
            verificationCode: 'SIZEBUDGET',
            issuedAt: new Date('2026-07-23T12:00:00.000Z'),
            fieldValues: {},
            template: {
                canvasWidth: canvasW,
                canvasHeight: canvasH,
                layout: layoutWithRecipient,
                backgroundFocus: { scale: 1, offsetX: 0.5, offsetY: 0.5 },
                backgroundImagePath: 'certificates/bg-large.png',
                backgroundImageSha: 'test-sha',
            },
        });

        const legacyPngBackground = await sharp(backgroundPng)
            .resize(canvasW, canvasH, { fit: 'fill' })
            .png()
            .toBuffer();
        const jpegBackground = await renderBackgroundJpeg(
            backgroundPng,
            { scale: 1, offsetX: 0.5, offsetY: 0.5 },
            canvasW,
            canvasH,
        );

        const pdfBuffer = await generateCertificatePdfBuffer(7);
        expect(pdfBuffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
        expect(pdfBuffer.length).toBeLessThan(PDF_SIZE_BUDGET_BYTES);

        // Sanity: JPEG background should be dramatically smaller than legacy PNG.
        expect(jpegBackground.bytes.length).toBeLessThan(legacyPngBackground.length / 4);
        expect(jpegBackground.bytes.length).toBeLessThan(500_000);
    });
});
