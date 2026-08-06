import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/publicWebsiteUrl', () => ({
    getPublicWebsiteUrl: () => 'https://public.example.com',
}));

import {
    buildCertificateVerificationUrl,
    computeBackgroundCropRect,
    fieldValueFor,
    formatIssuedDate,
    parseBackgroundFocus,
    parseHexColor,
    parseLayout,
    readIssuerName,
    readStaticTextOverrides,
    renderVerificationQrPng,
} from '../../services/certificatePdfService';

describe('certificatePdfService helpers', () => {
    it('parses layout elements and ignores invalid rows', () => {
        const layout = parseLayout([
            {
                id: 'a',
                type: 'field',
                field: 'recipientName',
                x: 10,
                y: 20,
                width: 100,
                height: 30,
                fontSize: 16,
                fontWeight: 'bold',
                align: 'center',
                color: '#111111',
            },
            {
                id: 'qr-1',
                type: 'qr',
                x: 50,
                y: 60,
                width: 160,
                height: 160,
            },
            { id: 'bad' },
            null,
        ]);
        expect(layout).toHaveLength(2);
        expect(layout[0].field).toBe('recipientName');
        expect(layout[1]).toMatchObject({ id: 'qr-1', type: 'qr', width: 160, height: 160 });
    });

    it('renders verification QR PNG with rounded-rect mask', async () => {
        const png = await renderVerificationQrPng(
            'https://public.example.com/verify/CODE1234',
            128,
        );
        expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(png.length).toBeGreaterThan(100);
    });

    it('parses background focus with clamps', () => {
        expect(parseBackgroundFocus({ scale: 0.5, offsetX: -1, offsetY: 2 })).toEqual({
            scale: 1,
            offsetX: 0,
            offsetY: 1,
        });
        expect(parseBackgroundFocus(null)).toEqual({
            scale: 1,
            offsetX: 0.5,
            offsetY: 0.5,
        });
    });

    it('formats issued dates and verification URLs', () => {
        expect(formatIssuedDate(new Date('2026-07-23T12:00:00.000Z'))).toContain('2026');
        expect(formatIssuedDate(null)).toBe('');
        expect(buildCertificateVerificationUrl('AB12CD34')).toBe(
            'https://public.example.com/verify/AB12CD34',
        );
    });

    it('resolves field values including verificationUrl and static overrides', () => {
        const certificate = {
            recipientName: 'Ada Lovelace',
            title: 'Hackathon',
            description: 'For outstanding work',
            verificationCode: 'CODE1234',
        };
        expect(fieldValueFor(
            {
                id: '1',
                type: 'field',
                field: 'verificationUrl',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                fontSize: 12,
                fontWeight: 'normal',
                align: 'left',
                color: '#000',
            },
            certificate,
            'July 23, 2026',
            'Issuer',
            'https://public.example.com/verify/CODE1234',
            {},
        )).toBe('https://public.example.com/verify/CODE1234');

        expect(fieldValueFor(
            {
                id: 'static-1',
                type: 'static',
                text: 'Default',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                fontSize: 12,
                fontWeight: 'normal',
                align: 'left',
                color: '#000',
            },
            certificate,
            '',
            '',
            '',
            { 'static-1': 'Override' },
        )).toBe('Override');

        expect(fieldValueFor(
            {
                id: 'qr-1',
                type: 'qr',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            },
            certificate,
            'July 23, 2026',
            'Issuer',
            'https://public.example.com/verify/CODE1234',
            {},
        )).toBe('');
    });

    it('reads issuer and static text overrides from fieldValues', () => {
        expect(readIssuerName({ issuerName: '  Faculty  ' })).toBe('Faculty');
        expect(readStaticTextOverrides({
            staticTexts: { a: 'One', b: 2 },
        })).toEqual({ a: 'One' });
    });

    it('parses hex colors', () => {
        expect(parseHexColor('#561789')).toEqual({
            type: 'RGB',
            red: 86 / 255,
            green: 23 / 255,
            blue: 137 / 255,
        });
        expect(parseHexColor('not-a-color')).toEqual({
            type: 'RGB',
            red: 0.1,
            green: 0.1,
            blue: 0.1,
        });
    });

    it('computes centered cover crop for default focus', () => {
        const crop = computeBackgroundCropRect(
            { scale: 1, offsetX: 0.5, offsetY: 0.5 },
            2000,
            1000,
            1000,
            800,
        );
        // cover scale = max(1000/2000, 800/1000) = 0.8 → visible source 1250x1000, centered horizontally
        expect(crop.width).toBeCloseTo(1250, 5);
        expect(crop.height).toBeCloseTo(1000, 5);
        expect(crop.left).toBeCloseTo(375, 5);
        expect(crop.top).toBeCloseTo(0, 5);
    });
});
