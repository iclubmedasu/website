/** Brand purple used by the default ticket / email template. */
export const DEFAULT_TICKET_ACCENT = "#561789";

export type TicketPaletteShade = 900 | 800 | 700 | 600 | 400;

export type TicketPalette = Record<TicketPaletteShade, string>;

/** Exact shade scale from the existing ticket email template. */
export const DEFAULT_TICKET_PALETTE: TicketPalette = {
    900: "#561789",
    800: "#662f91",
    700: "#7a47a3",
    600: "#9063b3",
    400: "#af8fc8",
};

/** Lightness offsets (percentage points) from the accent (900) shade. */
const SHADE_LIGHTNESS_DELTAS: Record<TicketPaletteShade, number> = {
    900: 0,
    800: 7,
    700: 15,
    600: 24,
    400: 36,
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Normalize a hex color string to lowercase `#rrggbb`.
 * Accepts `#rgb`, `#rrggbb`, or the same without `#`. Returns null if invalid.
 */
export function normalizeHex(value: string | null | undefined): string | null {
    if (value == null) return null;
    const raw = value.trim();
    if (!raw) return null;

    const withHash = raw.startsWith("#") ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{3}$/.test(withHash)) {
        const [r, g, b] = withHash;
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(withHash)) {
        return `#${withHash.toLowerCase()}`;
    }
    return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = normalizeHex(hex);
    if (!normalized) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    const n = parseInt(normalized.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) {
        return { h: 0, s: 0, l };
    }
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch (max) {
        case rn:
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
            break;
        case gn:
            h = ((bn - rn) / d + 2) / 6;
            break;
        default:
            h = ((rn - gn) / d + 4) / 6;
            break;
    }
    return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
}

function hslToHex(h: number, s: number, l: number): string {
    const sat = clamp(s, 0, 1);
    const light = clamp(l, 0, 1);
    let r: number;
    let g: number;
    let b: number;
    if (sat === 0) {
        r = g = b = light;
    } else {
        const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
        const p = 2 * light - q;
        r = hueToRgb(p, q, h + 1 / 3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1 / 3);
    }
    const toHex = (channel: number) =>
        Math.round(clamp(channel, 0, 1) * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert an accent hex into the ticket shade scale (900/800/700/600/400).
 * Falls back to the brand purple scale when accent is missing or invalid.
 * When accent matches the default brand purple, returns the exact hardcoded palette
 * so email/CSS stay pixel-identical to today's template.
 */
export function deriveTicketPalette(baseHex: string | null | undefined): TicketPalette {
    const normalized = normalizeHex(baseHex);
    if (!normalized || normalized === DEFAULT_TICKET_ACCENT) {
        return { ...DEFAULT_TICKET_PALETTE };
    }

    const { r, g, b } = hexToRgb(normalized);
    const { h, s, l } = rgbToHsl(r, g, b);
    const baseLightnessPercent = l * 100;

    const palette = { 900: normalized } as TicketPalette;
    for (const shade of [800, 700, 600, 400] as TicketPaletteShade[]) {
        const targetL = clamp(baseLightnessPercent + SHADE_LIGHTNESS_DELTAS[shade], 0, 95) / 100;
        palette[shade] = hslToHex(h, s, targetL);
    }
    return palette;
}
