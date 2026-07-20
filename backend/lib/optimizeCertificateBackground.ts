import sharp from "sharp";

/** WebP encode quality for certificate template backgrounds. */
export const BACKGROUND_WEBP_QUALITY = 80;

/** Hard cap on the longest side after resize (pixels). */
export const BACKGROUND_MAX_SIDE_CAP = 2400;

export const BACKGROUND_WEBP_CONTENT_TYPE = "image/webp" as const;

export function templateBackgroundWebpPath(templateId: number): string {
    return `certificates/templates/${templateId}/background.webp`;
}

/**
 * Longest side ≤ max(canvasW, canvasH) * 2, capped at 2400 (retina for that template).
 */
export function maxBackgroundSide(canvasWidth: number, canvasHeight: number): number {
    const w = Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 1122;
    const h = Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 794;
    return Math.min(BACKGROUND_MAX_SIDE_CAP, Math.max(w, h) * 2);
}

export type OptimizedCertificateBackground = {
    buffer: Buffer;
    contentType: typeof BACKGROUND_WEBP_CONTENT_TYPE;
    extension: ".webp";
    maxSide: number;
};

/**
 * Resize (if needed) and encode a certificate background as WebP.
 * Longest side is capped at max(canvas) * 2, hard-capped at 2400.
 */
export async function optimizeCertificateBackground(
    input: Buffer,
    opts: { canvasWidth: number; canvasHeight: number },
): Promise<OptimizedCertificateBackground> {
    const maxSide = maxBackgroundSide(opts.canvasWidth, opts.canvasHeight);

    const buffer = await sharp(input, { failOn: "none" })
        .rotate()
        .resize({
            width: maxSide,
            height: maxSide,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: BACKGROUND_WEBP_QUALITY })
        .toBuffer();

    return {
        buffer,
        contentType: BACKGROUND_WEBP_CONTENT_TYPE,
        extension: ".webp",
        maxSide,
    };
}
