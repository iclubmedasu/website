/**
 * Parse template-owned wording from a certificate template layout JSON array.
 * Layout elements: { id, type: "field"|"static"|"qr", field?, text?, ... }
 * type "qr" is geometry-only (verification URL payload at render) and has no wording.
 */

export type TemplateLayoutStaticText = {
    id: string;
    text: string;
    /** 1-based index among static elements in layout order. */
    ordinal: number;
};

export type TemplateLayoutWording = {
    /** Description field element `text`, or "" if absent. */
    description: string;
    /** Issuer field element `text`, or "" if absent. */
    issuerName: string;
    /** Title field element `text` (editor sample / custom default), or "" if absent. */
    titleText: string;
    /** Whether a Description field element exists on the layout. */
    hasDescription: boolean;
    /** Whether an Issuer field element exists on the layout. */
    hasIssuer: boolean;
    /** Whether a Title/Occasion field element exists on the layout. */
    hasTitle: boolean;
    staticTexts: TemplateLayoutStaticText[];
};

type RawLayoutElement = {
    id?: unknown;
    type?: unknown;
    field?: unknown;
    text?: unknown;
};

function elementText(el: RawLayoutElement): string {
    return typeof el.text === "string" ? el.text : "";
}

function elementId(el: RawLayoutElement): string {
    if (typeof el.id === "string" && el.id) return el.id;
    if (typeof el.id === "number" && Number.isFinite(el.id)) return String(el.id);
    return "";
}

/**
 * Normalize Prisma/API layout payloads to an element array.
 * Accepts a JSON array or a stringified JSON array.
 */
export function normalizeTemplateLayout(layout: unknown): unknown[] | null {
    if (Array.isArray(layout)) return layout;
    if (typeof layout === "string") {
        const trimmed = layout.trim();
        if (!trimmed) return null;
        try {
            const parsed: unknown = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
}

/** True if layout field key is the title/occasion element (including legacy aliases). */
export function isTitleLayoutField(field: string): boolean {
    return field === "title" || field === "occasion";
}

/**
 * Extract Description / Issuer / Title / Static Text wording from a template layout.
 * Runtime-bound fields (recipientName, issuedDate, verificationCode, verificationUrl)
 * are not wording overrides and are intentionally ignored.
 */
export function parseTemplateLayoutWording(layout: unknown): TemplateLayoutWording {
    const result: TemplateLayoutWording = {
        description: "",
        issuerName: "",
        titleText: "",
        hasDescription: false,
        hasIssuer: false,
        hasTitle: false,
        staticTexts: [],
    };

    const elements = normalizeTemplateLayout(layout);
    if (!elements) return result;

    let staticOrdinal = 0;
    for (const raw of elements) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const el = raw as RawLayoutElement;
        const id = elementId(el);
        const type = typeof el.type === "string" ? el.type : "";
        const field = typeof el.field === "string" ? el.field : "";

        if (type === "static") {
            if (!id) continue;
            staticOrdinal += 1;
            result.staticTexts.push({
                id,
                text: elementText(el),
                ordinal: staticOrdinal,
            });
            continue;
        }

        if (type !== "field") continue;

        if (field === "description") {
            result.hasDescription = true;
            result.description = elementText(el);
        } else if (field === "issuerName") {
            result.hasIssuer = true;
            result.issuerName = elementText(el);
        } else if (isTitleLayoutField(field)) {
            result.hasTitle = true;
            result.titleText = elementText(el);
        }
    }

    return result;
}
