/**
 * Tier 1 embed style parameters parsed from the embed route query string.
 * Applied as CSS custom properties on the embed root element.
 */

export type EmbedLayoutPreset = "default" | "compact" | "spacious";

export interface EmbedStyleParams {
    primaryColor: string | null;
    accentColor: string | null;
    borderRadius: string | null;
    fontFamily: string | null;
    layout: EmbedLayoutPreset;
    customCssUrl: string | null;
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_RADIUS = /^(?:\d+(?:\.\d+)?(?:px|rem|em|%)|0)$/;
const SAFE_FONT_FAMILY = /^[a-zA-Z0-9\s,"'_\-]+$/;

function firstString(value: string | string[] | undefined): string | null {
    if (value == null) return null;
    const raw = Array.isArray(value) ? value[0] : value;
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
}

export function sanitizeHexColor(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!HEX_COLOR.test(trimmed)) return null;
    return trimmed;
}

export function sanitizeBorderRadius(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!SAFE_RADIUS.test(trimmed)) return null;
    return trimmed;
}

export function sanitizeFontFamily(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim().slice(0, 120);
    if (!SAFE_FONT_FAMILY.test(trimmed)) return null;
    return trimmed;
}

export function sanitizeLayoutPreset(value: string | null | undefined): EmbedLayoutPreset {
    if (value === "compact" || value === "spacious" || value === "default") {
        return value;
    }
    return "default";
}

/**
 * Validate an optional host-provided stylesheet URL.
 * Requires a well-formed https:// URL. Invalid values are ignored.
 */
export function sanitizeCustomCssUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    try {
        const url = new URL(trimmed);
        if (url.protocol !== "https:") return null;
        if (url.username || url.password) return null;
        return url.toString();
    } catch {
        return null;
    }
}

export function parseEmbedStyleSearchParams(
    searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): EmbedStyleParams {
    const get = (key: string): string | null => {
        if (searchParams instanceof URLSearchParams) {
            return firstString(searchParams.get(key) ?? undefined);
        }
        return firstString(searchParams[key]);
    };

    // Support both camelCase and kebab-case query keys used by the loader.
    return {
        primaryColor: sanitizeHexColor(get("primaryColor") ?? get("primary-color")),
        accentColor: sanitizeHexColor(get("accentColor") ?? get("accent-color")),
        borderRadius: sanitizeBorderRadius(get("borderRadius") ?? get("border-radius")),
        fontFamily: sanitizeFontFamily(get("fontFamily") ?? get("font-family")),
        layout: sanitizeLayoutPreset(get("layout")),
        customCssUrl: sanitizeCustomCssUrl(get("customCssUrl") ?? get("custom-css-url")),
    };
}

/**
 * Build inline CSS that maps Tier 1 tokens onto the site's design tokens.
 * Scoped to `.embed-root` so the normal public site is unaffected.
 */
export function buildEmbedThemeCss(params: EmbedStyleParams): string {
    const lines: string[] = [];

    if (params.primaryColor) {
        lines.push(`--purple-800: ${params.primaryColor};`);
        lines.push(`--purple-900: ${params.primaryColor};`);
        lines.push(`--purple-700: ${params.primaryColor};`);
        lines.push(`--color-purple-800: ${params.primaryColor};`);
        lines.push(`--color-purple-900: ${params.primaryColor};`);
        lines.push(`--color-purple-700: ${params.primaryColor};`);
        lines.push(`--registration-primary: ${params.primaryColor};`);
    }

    if (params.accentColor) {
        lines.push(`--purple-600: ${params.accentColor};`);
        lines.push(`--color-purple-600: ${params.accentColor};`);
        lines.push(`--registration-accent: ${params.accentColor};`);
    }

    if (params.borderRadius) {
        lines.push(`--radius-sm: ${params.borderRadius};`);
        lines.push(`--radius-md: ${params.borderRadius};`);
        lines.push(`--radius-lg: ${params.borderRadius};`);
        lines.push(`--radius-xl: ${params.borderRadius};`);
        lines.push(`--registration-radius: ${params.borderRadius};`);
    }

    if (params.fontFamily) {
        lines.push(`--font-body: ${params.fontFamily};`);
        lines.push(`--font-heading: ${params.fontFamily};`);
        lines.push(`font-family: ${params.fontFamily};`);
    }

    if (lines.length === 0) {
        return "";
    }

    return `.embed-root {\n  ${lines.join("\n  ")}\n}`;
}
