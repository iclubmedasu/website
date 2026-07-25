import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
    EVENT_PHOTO_PREVIEW_CONTENT_TYPE,
    EVENT_PHOTO_PREVIEW_MAX_SIDE,
    eventPhotoPreviewGithubPath,
    optimizeEventPhoto,
} from "../../lib/optimizeEventPhoto";

describe("eventPhotoPreviewGithubPath", () => {
    it("places {uuid}-preview.webp next to the original", () => {
        const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        expect(
            eventPhotoPreviewGithubPath(
                `events/12/photos/2026-07-25/${uuid}-IMG_0001.jpg`,
            ),
        ).toBe(`events/12/photos/2026-07-25/${uuid}-preview.webp`);
    });
});

describe("optimizeEventPhoto", () => {
    it("encodes WebP and shrinks oversized images", async () => {
        const input = await sharp({
            create: {
                width: 2400,
                height: 1600,
                channels: 3,
                background: { r: 40, g: 80, b: 120 },
            },
        })
            .jpeg({ quality: 95 })
            .toBuffer();

        const result = await optimizeEventPhoto(input);

        expect(result.contentType).toBe(EVENT_PHOTO_PREVIEW_CONTENT_TYPE);
        expect(result.extension).toBe(".webp");
        expect(result.maxSide).toBe(EVENT_PHOTO_PREVIEW_MAX_SIDE);
        expect(result.buffer.length).toBeLessThan(input.length);

        const meta = await sharp(result.buffer).metadata();
        expect(meta.format).toBe("webp");
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
            EVENT_PHOTO_PREVIEW_MAX_SIDE,
        );
    });

    it("does not enlarge small images", async () => {
        const input = await sharp({
            create: {
                width: 400,
                height: 300,
                channels: 3,
                background: { r: 10, g: 20, b: 30 },
            },
        })
            .png()
            .toBuffer();

        const result = await optimizeEventPhoto(input);
        const meta = await sharp(result.buffer).metadata();
        expect(meta.width).toBe(400);
        expect(meta.height).toBe(300);
    });
});
