import fs from 'fs';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';
import {
    PDFDocument,
    PDFName,
    PDFPage,
    PDFString,
    StandardFonts,
    rgb,
    type PDFFont,
    type RGB,
} from 'pdf-lib';
import sharp from 'sharp';
import { prisma } from '../db';
import { loadCertificateBackground } from '../lib/certificateBackgroundCache';
import { getPublicWebsiteUrl } from '../lib/publicWebsiteUrl';

const FONTS_DIR = (() => {
    const candidates = [
        path.join(__dirname, '../../assets/fonts'),
        path.join(__dirname, '../assets/fonts'),
    ];
    const existing = candidates.find((dir) => fs.existsSync(dir));
    return existing ?? candidates[0];
})();

/** JPEG quality for certificate page backgrounds (email/public PDF size). */
export const CERTIFICATE_BACKGROUND_JPEG_QUALITY = 80;
/** Cap longest side of the embedded background bitmap. */
export const CERTIFICATE_BACKGROUND_MAX_LONGEST_SIDE = 2000;

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

type UnicodeFontBytes = {
    latinRegular: Buffer;
    latinBold: Buffer;
    arabicRegular: Buffer;
    arabicBold: Buffer;
};

let cachedUnicodeFontBytes: UnicodeFontBytes | null | undefined;

function loadUnicodeFontBytes(): UnicodeFontBytes | null {
    if (cachedUnicodeFontBytes !== undefined) return cachedUnicodeFontBytes;
    try {
        const files = {
            latinRegular: path.join(FONTS_DIR, 'NotoSans-Regular.ttf'),
            latinBold: path.join(FONTS_DIR, 'NotoSans-Bold.ttf'),
            arabicRegular: path.join(FONTS_DIR, 'NotoSansArabic-Regular.ttf'),
            arabicBold: path.join(FONTS_DIR, 'NotoSansArabic-Bold.ttf'),
        };
        for (const file of Object.values(files)) {
            if (!fs.existsSync(file)) {
                console.warn(`certificatePdfService: missing font ${file}`);
                cachedUnicodeFontBytes = null;
                return null;
            }
        }
        cachedUnicodeFontBytes = {
            latinRegular: fs.readFileSync(files.latinRegular),
            latinBold: fs.readFileSync(files.latinBold),
            arabicRegular: fs.readFileSync(files.arabicRegular),
            arabicBold: fs.readFileSync(files.arabicBold),
        };
        return cachedUnicodeFontBytes;
    } catch (error) {
        console.error('certificatePdfService: failed to load Unicode fonts', error);
        cachedUnicodeFontBytes = null;
        return null;
    }
}

type CertificateFonts = {
    regular: PDFFont;
    bold: PDFFont;
    arabicRegular: PDFFont | null;
    arabicBold: PDFFont | null;
};

async function embedCertificateFonts(pdfDoc: PDFDocument): Promise<CertificateFonts> {
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bytes = loadUnicodeFontBytes();
    if (!bytes) {
        return {
            regular: helvetica,
            bold: helveticaBold,
            arabicRegular: null,
            arabicBold: null,
        };
    }

    pdfDoc.registerFontkit(fontkit);
    const [regular, bold, arabicRegular, arabicBold] = await Promise.all([
        pdfDoc.embedFont(bytes.latinRegular, { subset: true }),
        pdfDoc.embedFont(bytes.latinBold, { subset: true }),
        pdfDoc.embedFont(bytes.arabicRegular, { subset: true }),
        pdfDoc.embedFont(bytes.arabicBold, { subset: true }),
    ]);
    return { regular, bold, arabicRegular, arabicBold };
}

function pickFont(fonts: CertificateFonts, text: string, bold: boolean): PDFFont {
    if (ARABIC_SCRIPT_RE.test(text)) {
        const arabic = bold ? fonts.arabicBold : fonts.arabicRegular;
        if (arabic) return arabic;
    }
    return bold ? fonts.bold : fonts.regular;
}

/** Replace glyphs Helvetica/WinAnsi cannot encode so drawText never throws. */
export function sanitizePdfText(text: string): string {
    let out = '';
    for (const ch of text) {
        const code = ch.codePointAt(0)!;
        if (code === 0x09 || code === 0x0a || code === 0x0d) {
            out += ' ';
            continue;
        }
        if (code >= 32 && code <= 126) {
            out += ch;
            continue;
        }
        out += '?';
    }
    return out;
}

function drawTextSafe(
    page: PDFPage,
    text: string,
    options: {
        x: number;
        y: number;
        size: number;
        font: PDFFont;
        color: RGB;
        maxWidth?: number;
    },
): void {
    try {
        page.drawText(text, options);
    } catch {
        const sanitized = sanitizePdfText(text);
        if (!sanitized.trim()) return;
        try {
            page.drawText(sanitized, options);
        } catch (error) {
            console.error('certificatePdfService: drawText failed after sanitize', error);
        }
    }
}

export type CertificateLayoutElement = {
    id: string;
    type: 'field' | 'static';
    field?: string;
    text?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    align: 'left' | 'center' | 'right';
    color: string;
};

export type BackgroundFocus = {
    scale: number;
    offsetX: number;
    offsetY: number;
};

const DEFAULT_FOCUS: BackgroundFocus = {
    scale: 1,
    offsetX: 0.5,
    offsetY: 0.5,
};

const DEFAULT_CANVAS_WIDTH = 1122;
const DEFAULT_CANVAS_HEIGHT = 794;
const BRAND_PURPLE = rgb(86 / 255, 23 / 255, 137 / 255);

export function parseLayout(layout: unknown): CertificateLayoutElement[] {
    if (!Array.isArray(layout)) return [];
    return layout.filter((el): el is CertificateLayoutElement => {
        if (!el || typeof el !== 'object') return false;
        const row = el as Record<string, unknown>;
        return typeof row.id === 'string'
            && (row.type === 'field' || row.type === 'static')
            && typeof row.x === 'number'
            && typeof row.y === 'number'
            && typeof row.width === 'number'
            && typeof row.height === 'number';
    });
}

export function parseBackgroundFocus(value: unknown): BackgroundFocus {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...DEFAULT_FOCUS };
    }
    const raw = value as Record<string, unknown>;
    const scale = Number(raw.scale);
    const offsetX = Number(raw.offsetX);
    const offsetY = Number(raw.offsetY);
    if (![scale, offsetX, offsetY].every(Number.isFinite)) {
        return { ...DEFAULT_FOCUS };
    }
    return {
        scale: Math.max(1, scale),
        offsetX: Math.min(1, Math.max(0, offsetX)),
        offsetY: Math.min(1, Math.max(0, offsetY)),
    };
}

export function formatIssuedDate(issuedAt: Date | string | null | undefined): string {
    if (!issuedAt) return '';
    const date = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function buildCertificateVerificationUrl(code: string): string {
    const base = getPublicWebsiteUrl().replace(/\/$/, '');
    return `${base}/verify/${encodeURIComponent(code.trim())}`;
}

export function readStaticTextOverrides(fieldValues: unknown): Record<string, string> {
    if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
        return {};
    }
    const raw = (fieldValues as Record<string, unknown>).staticTexts;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === 'string') out[id] = value;
    }
    return out;
}

export function readIssuerName(fieldValues: unknown): string {
    if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
        return '';
    }
    const issuerName = (fieldValues as Record<string, unknown>).issuerName;
    return typeof issuerName === 'string' ? issuerName.trim() : '';
}

export function fieldValueFor(
    element: CertificateLayoutElement,
    certificate: {
        recipientName: string;
        title: string;
        description: string;
        verificationCode: string;
    },
    issuedDate: string,
    issuerName: string,
    verificationUrl: string,
    staticTextOverrides: Record<string, string>,
): string {
    if (element.type === 'static') {
        const override = staticTextOverrides[element.id];
        if (typeof override === 'string') return override;
        return element.text || '';
    }
    switch (element.field) {
        case 'recipientName':
            return certificate.recipientName || '';
        case 'title':
            return certificate.title || '';
        case 'description':
            return certificate.description || '';
        case 'issuedDate':
            return issuedDate;
        case 'verificationCode':
            return certificate.verificationCode || '';
        case 'verificationUrl':
            return verificationUrl;
        case 'issuerName':
            return issuerName;
        default:
            return element.field || '';
    }
}

export function parseHexColor(color: string | undefined): RGB {
    const fallback = rgb(0.1, 0.1, 0.1);
    if (!color || typeof color !== 'string') return fallback;
    const hex = color.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex) && !/^[0-9a-fA-F]{3}$/.test(hex)) {
        return fallback;
    }
    const full = hex.length === 3
        ? hex.split('').map((ch) => `${ch}${ch}`).join('')
        : hex;
    const r = Number.parseInt(full.slice(0, 2), 16) / 255;
    const g = Number.parseInt(full.slice(2, 4), 16) / 255;
    const b = Number.parseInt(full.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
}

/** Visible crop of a focused cover-fit background, in source-image pixels. */
export function computeBackgroundCropRect(
    focus: BackgroundFocus,
    naturalW: number,
    naturalH: number,
    canvasW: number,
    canvasH: number,
): { left: number; top: number; width: number; height: number } {
    if (naturalW <= 0 || naturalH <= 0 || canvasW <= 0 || canvasH <= 0) {
        return { left: 0, top: 0, width: Math.max(1, naturalW), height: Math.max(1, naturalH) };
    }
    const coverScale = Math.max(canvasW / naturalW, canvasH / naturalH);
    const totalScale = coverScale * focus.scale;
    const scaledW = naturalW * totalScale;
    const scaledH = naturalH * totalScale;
    const maxX = Math.max(0, scaledW - canvasW);
    const maxY = Math.max(0, scaledH - canvasH);
    const leftScaled = maxX * focus.offsetX;
    const topScaled = maxY * focus.offsetY;
    return {
        left: leftScaled / totalScale,
        top: topScaled / totalScale,
        width: canvasW / totalScale,
        height: canvasH / totalScale,
    };
}

function textXForAlign(
    align: CertificateLayoutElement['align'],
    boxX: number,
    boxWidth: number,
    textWidth: number,
): number {
    if (align === 'center') return boxX + (boxWidth - textWidth) / 2;
    if (align === 'right') return boxX + boxWidth - textWidth;
    return boxX;
}

function wrapTextToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (maxWidth <= 0) return [normalized];

    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
            current = word;
            continue;
        }
        // Hard-break oversized tokens.
        let remaining = word;
        while (remaining) {
            let fit = 1;
            while (
                fit < remaining.length
                && font.widthOfTextAtSize(remaining.slice(0, fit + 1), fontSize) <= maxWidth
            ) {
                fit += 1;
            }
            lines.push(remaining.slice(0, fit));
            remaining = remaining.slice(fit);
        }
        current = '';
    }
    if (current) lines.push(current);
    return lines;
}

function createLinkAnnotationRef(
    page: PDFPage,
    uri: string,
    rect: { x: number; y: number; width: number; height: number },
) {
    const pageHeight = page.getHeight();
    const llx = rect.x;
    const lly = pageHeight - rect.y - rect.height;
    const urx = rect.x + rect.width;
    const ury = pageHeight - rect.y;

    return page.doc.context.register(
        page.doc.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [llx, lly, urx, ury],
            Border: [0, 0, 0],
            A: {
                Type: 'Action',
                S: 'URI',
                URI: PDFString.of(uri),
            },
        }),
    );
}

function setPageLinkAnnotations(
    page: PDFPage,
    links: Array<{ uri: string; x: number; y: number; width: number; height: number }>,
): void {
    if (links.length === 0) return;
    const refs = links.map((link) => createLinkAnnotationRef(page, link.uri, link));
    page.node.set(PDFName.of('Annots'), page.doc.context.obj(refs));
}

/**
 * Crop/focus the template background and encode as JPEG for a much smaller PDF.
 * Longest side is capped so huge canvases stay email-friendly.
 */
export async function renderBackgroundJpeg(
    imageBuffer: Buffer,
    focus: BackgroundFocus,
    canvasW: number,
    canvasH: number,
    options?: { quality?: number; maxLongestSide?: number },
): Promise<{ bytes: Buffer; width: number; height: number }> {
    const quality = options?.quality ?? CERTIFICATE_BACKGROUND_JPEG_QUALITY;
    const maxLongestSide = options?.maxLongestSide ?? CERTIFICATE_BACKGROUND_MAX_LONGEST_SIDE;

    const meta = await sharp(imageBuffer).metadata();
    const naturalW = meta.width ?? canvasW;
    const naturalH = meta.height ?? canvasH;
    const crop = computeBackgroundCropRect(focus, naturalW, naturalH, canvasW, canvasH);

    const left = Math.max(0, Math.min(naturalW - 1, Math.floor(crop.left)));
    const top = Math.max(0, Math.min(naturalH - 1, Math.floor(crop.top)));
    const width = Math.max(1, Math.min(naturalW - left, Math.ceil(crop.width)));
    const height = Math.max(1, Math.min(naturalH - top, Math.ceil(crop.height)));

    let outW = canvasW;
    let outH = canvasH;
    const longest = Math.max(outW, outH);
    if (longest > maxLongestSide) {
        const scale = maxLongestSide / longest;
        outW = Math.max(1, Math.round(canvasW * scale));
        outH = Math.max(1, Math.round(canvasH * scale));
    }

    const bytes = await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .resize(outW, outH, { fit: 'fill' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

    return { bytes, width: outW, height: outH };
}


async function drawTemplateCertificatePdf(input: {
    recipientName: string;
    title: string;
    description: string;
    verificationCode: string;
    issuedAt: Date | null;
    fieldValues: unknown;
    template: {
        canvasWidth: number;
        canvasHeight: number;
        layout: unknown;
        backgroundFocus: unknown;
        backgroundImagePath: string | null;
        backgroundImageSha: string | null;
    };
}): Promise<Buffer> {
    const canvasW = input.template.canvasWidth || DEFAULT_CANVAS_WIDTH;
    const canvasH = input.template.canvasHeight || DEFAULT_CANVAS_HEIGHT;
    const elements = parseLayout(input.template.layout);
    const focus = parseBackgroundFocus(input.template.backgroundFocus);
    const issuedDate = formatIssuedDate(input.issuedAt);
    const issuerName = readIssuerName(input.fieldValues);
    const staticTextOverrides = readStaticTextOverrides(input.fieldValues);
    const verificationUrl = buildCertificateVerificationUrl(input.verificationCode);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([canvasW, canvasH]);
    const fonts = await embedCertificateFonts(pdfDoc);

    page.drawRectangle({
        x: 0,
        y: 0,
        width: canvasW,
        height: canvasH,
        color: rgb(1, 1, 1),
    });

    if (input.template.backgroundImagePath) {
        try {
            const { buffer } = await loadCertificateBackground(
                input.template.backgroundImagePath,
                input.template.backgroundImageSha,
            );
            const { bytes: jpegBytes } = await renderBackgroundJpeg(buffer, focus, canvasW, canvasH);
            const image = await pdfDoc.embedJpg(jpegBytes);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: canvasW,
                height: canvasH,
            });
        } catch (error) {
            console.error('certificatePdfService: failed to embed background', error);
        }
    }

    const linkRects: Array<{ uri: string; x: number; y: number; width: number; height: number }> = [];

    for (const element of elements) {
        const text = fieldValueFor(
            element,
            input,
            issuedDate,
            issuerName,
            verificationUrl,
            staticTextOverrides,
        );
        if (!text) continue;

        const fontSize = Number.isFinite(element.fontSize) && element.fontSize > 0
            ? element.fontSize
            : 14;
        const font = pickFont(fonts, text, element.fontWeight === 'bold');
        const color = parseHexColor(element.color);
        const lines = wrapTextToWidth(text, font, fontSize, element.width);
        const lineHeight = fontSize * 1.25;
        let lineYTop = element.y;

        for (const line of lines) {
            const lineFont = pickFont(fonts, line, element.fontWeight === 'bold');
            const textWidth = lineFont.widthOfTextAtSize(line, fontSize);
            const x = textXForAlign(element.align || 'left', element.x, element.width, textWidth);
            const pdfY = canvasH - lineYTop - fontSize;
            if (pdfY < -fontSize || pdfY > canvasH) {
                lineYTop += lineHeight;
                continue;
            }
            drawTextSafe(page, line, {
                x: Math.max(0, x),
                y: pdfY,
                size: fontSize,
                font: lineFont,
                color,
                maxWidth: element.width > 0 ? element.width : undefined,
            });
            lineYTop += lineHeight;
            if (lineYTop > element.y + element.height) break;
        }

        if (element.type === 'field' && element.field === 'verificationUrl' && verificationUrl) {
            linkRects.push({
                uri: verificationUrl,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
            });
        }
    }

    setPageLinkAnnotations(page, linkRects);

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
}

async function drawSimpleCertificatePdf(input: {
    recipientName: string;
    title: string;
    verificationCode: string;
    issuedAt: Date | null;
}): Promise<Buffer> {
    const width = DEFAULT_CANVAS_WIDTH;
    const height = DEFAULT_CANVAS_HEIGHT;
    const verificationUrl = buildCertificateVerificationUrl(input.verificationCode);
    const issuedDate = formatIssuedDate(input.issuedAt) || '—';

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);
    const fonts = await embedCertificateFonts(pdfDoc);

    page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(0.96, 0.94, 0.98),
    });
    page.drawRectangle({
        x: 48,
        y: 48,
        width: width - 96,
        height: height - 96,
        color: rgb(1, 1, 1),
        borderColor: BRAND_PURPLE,
        borderWidth: 2,
    });

    const centerX = width / 2;
    const drawCentered = (text: string, yFromTop: number, size: number, bold = false) => {
        const font = pickFont(fonts, text, bold);
        const textWidth = font.widthOfTextAtSize(text, size);
        drawTextSafe(page, text, {
            x: centerX - textWidth / 2,
            y: height - yFromTop - size,
            size,
            font,
            color: bold ? BRAND_PURPLE : rgb(0.1, 0.12, 0.18),
        });
    };

    drawCentered('iClub Med-asu', 120, 18, true);
    drawCentered('Certificate of Recognition', 160, 28, true);
    drawCentered(input.recipientName || 'Recipient', 240, 32, true);
    drawCentered(input.title || 'Certificate', 300, 18, false);
    drawCentered(`Issued ${issuedDate}`, 360, 14, false);
    drawCentered(`Code: ${input.verificationCode}`, 400, 14, true);
    drawCentered(verificationUrl, 450, 12, false);

    setPageLinkAnnotations(page, [{
        uri: verificationUrl,
        x: 80,
        y: 440,
        width: width - 160,
        height: 28,
    }]);

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
}

type CertificatePdfLookup = {
    id: number;
    recipientName: string;
    title: string;
    description: string;
    verificationCode: string;
    issuedAt: Date | null;
    fieldValues: unknown;
    template: {
        canvasWidth: number;
        canvasHeight: number;
        layout: unknown;
        backgroundFocus: unknown;
        backgroundImagePath: string | null;
        backgroundImageSha: string | null;
    } | null;
};

async function loadCertificateForPdf(
    certificateIdOrCode: number | string,
): Promise<CertificatePdfLookup> {
    const include = {
        template: {
            select: {
                canvasWidth: true,
                canvasHeight: true,
                layout: true,
                backgroundFocus: true,
                backgroundImagePath: true,
                backgroundImageSha: true,
            },
        },
    } as const;

    if (typeof certificateIdOrCode === 'number') {
        const certificate = await prisma.certificate.findUnique({
            where: { id: certificateIdOrCode },
            include,
        });
        if (!certificate) {
            throw new Error('Certificate not found');
        }
        return certificate;
    }

    const code = String(certificateIdOrCode).trim();
    if (!code) {
        throw new Error('Invalid verification code');
    }

    const certificate = await prisma.certificate.findFirst({
        where: { verificationCode: code },
        include,
    });
    if (!certificate) {
        throw new Error('Certificate not found');
    }
    return certificate;
}

/**
 * Build a PDF buffer for a certificate by numeric id or verification code.
 */
export async function generateCertificatePdfBuffer(
    certificateIdOrCode: number | string,
): Promise<Buffer> {
    const certificate = await loadCertificateForPdf(certificateIdOrCode);

    if (certificate.template) {
        return drawTemplateCertificatePdf({
            recipientName: certificate.recipientName,
            title: certificate.title,
            description: certificate.description,
            verificationCode: certificate.verificationCode,
            issuedAt: certificate.issuedAt,
            fieldValues: certificate.fieldValues,
            template: certificate.template,
        });
    }

    return drawSimpleCertificatePdf({
        recipientName: certificate.recipientName,
        title: certificate.title,
        verificationCode: certificate.verificationCode,
        issuedAt: certificate.issuedAt,
    });
}
