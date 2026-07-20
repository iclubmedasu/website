import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
    BACKGROUND_MAX_SIDE_CAP,
    BACKGROUND_WEBP_CONTENT_TYPE,
    maxBackgroundSide,
    optimizeCertificateBackground,
    templateBackgroundWebpPath,
} from "../../lib/optimizeCertificateBackground";

describe("maxBackgroundSide", () => {
    it("uses 2x the longer canvas side", () => {
        expect(maxBackgroundSide(1122, 794)).toBe(2244);
        expect(maxBackgroundSide(800, 1200)).toBe(2400);
    });

    it("caps at 2400", () => {
        expect(maxBackgroundSide(2000, 1500)).toBe(BACKGROUND_MAX_SIDE_CAP);
        expect(maxBackgroundSide(4000, 4000)).toBe(BACKGROUND_MAX_SIDE_CAP);
    });
});

describe("templateBackgroundWebpPath", () => {
    it("always stores as background.webp", () => {
        expect(templateBackgroundWebpPath(42)).toBe(
            "certificates/templates/42/background.webp",
        );
    });
});

describe("optimizeCertificateBackground", () => {
    it("encodes WebP and shrinks oversized images", async () => {
        const input = await sharp({
            create: {
                width: 3000,
                height: 2000,
                channels: 3,
                background: { r: 20, g: 40, b: 80 },
            },
        })
            .png()
            .toBuffer();

        const result = await optimizeCertificateBackground(input, {
            canvasWidth: 1122,
            canvasHeight: 794,
        });

        expect(result.contentType).toBe(BACKGROUND_WEBP_CONTENT_TYPE);
        expect(result.extension).toBe(".webp");
        expect(result.maxSide).toBe(2244);
        expect(result.buffer.length).toBeLessThan(input.length);

        const meta = await sharp(result.buffer).metadata();
        expect(meta.format).toBe("webp");
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2244);
    });
});
