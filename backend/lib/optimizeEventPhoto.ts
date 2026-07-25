import sharp from "sharp";

/** WebP encode quality for public event photo previews. */
export const EVENT_PHOTO_PREVIEW_WEBP_QUALITY = 75;

/** Longest side after resize (pixels). */
export const EVENT_PHOTO_PREVIEW_MAX_SIDE = 1280;

export const EVENT_PHOTO_PREVIEW_CONTENT_TYPE = "image/webp" as const;

/**
 * Preview path next to the original: `…/photos/…/{uuid}-preview.webp`.
 * Original filenames are `{uuid}-{safeName}` where uuid is 36 chars.
 */
export function eventPhotoPreviewGithubPath(originalGithubPath: string): string {
    const lastSlash = originalGithubPath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? originalGithubPath.slice(0, lastSlash + 1) : "";
    const fileName = lastSlash >= 0 ? originalGithubPath.slice(lastSlash + 1) : originalGithubPath;
    const uuid = fileName.slice(0, 36);
    return `${dir}${uuid}-preview.webp`;
}

export type OptimizedEventPhotoPreview = {
    buffer: Buffer;
    contentType: typeof EVENT_PHOTO_PREVIEW_CONTENT_TYPE;
    extension: ".webp";
    maxSide: number;
};

/**
 * Resize (if needed) and encode an event photo as a display WebP.
 * Longest side ≤ 1280, without enlarging smaller images.
 */
export async function optimizeEventPhoto(input: Buffer): Promise<OptimizedEventPhotoPreview> {
    const buffer = await sharp(input, { failOn: "none" })
        .rotate()
        .resize({
            width: EVENT_PHOTO_PREVIEW_MAX_SIDE,
            height: EVENT_PHOTO_PREVIEW_MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: EVENT_PHOTO_PREVIEW_WEBP_QUALITY })
        .toBuffer();

    return {
        buffer,
        contentType: EVENT_PHOTO_PREVIEW_CONTENT_TYPE,
        extension: ".webp",
        maxSide: EVENT_PHOTO_PREVIEW_MAX_SIDE,
    };
}
