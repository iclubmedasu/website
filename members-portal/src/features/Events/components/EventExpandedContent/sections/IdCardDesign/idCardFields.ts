import type {
    EventCustomFieldRef,
    EventRegistrationRef,
    EventTierRef,
    Id,
    IdCardBackgroundFocus,
    IdCardLayoutElement,
} from '@/types/backend-contracts';
import { getCustomFieldValue } from '../../customFieldUtils';

export const DEFAULT_ID_CARD_CANVAS_WIDTH = 384;
export const DEFAULT_ID_CARD_CANVAS_HEIGHT = 576;
export const ID_CARD_CANVAS_MIN = 150;
export const ID_CARD_CANVAS_MAX = 1500;
export const ID_CARD_FOCUS_SCALE_MAX = 3;

export const DEFAULT_ID_CARD_BACKGROUND_FOCUS: IdCardBackgroundFocus = {
    scale: 1,
    offsetX: 0.5,
    offsetY: 0.5,
};

function clampFocus(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

/** Normalize focus JSON: { scale 1..3, offsetX/Y in 0..1 }. */
export function parseIdCardBackgroundFocus(
    value: unknown,
): IdCardBackgroundFocus {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...DEFAULT_ID_CARD_BACKGROUND_FOCUS };
    }
    const raw = value as Record<string, unknown>;
    return {
        scale: clampFocus(Number(raw.scale) || 1, 1, ID_CARD_FOCUS_SCALE_MAX),
        offsetX: clampFocus(Number(raw.offsetX) || 0.5, 0, 1),
        offsetY: clampFocus(Number(raw.offsetY) || 0.5, 0, 1),
    };
}

export function focusFromDesign(
    design: { idCardBackgroundFocus?: unknown } | null | undefined,
): IdCardBackgroundFocus {
    return parseIdCardBackgroundFocus(design?.idCardBackgroundFocus);
}

export function getIdCardPanExtents(
    focus: IdCardBackgroundFocus,
    natural: { w: number; h: number } | null,
    cw: number,
    ch: number,
): { maxX: number; maxY: number; scaledW: number; scaledH: number; left: number; top: number } {
    if (!natural || natural.w <= 0 || natural.h <= 0) {
        return { maxX: 0, maxY: 0, scaledW: cw, scaledH: ch, left: 0, top: 0 };
    }
    const coverScale = Math.max(cw / natural.w, ch / natural.h);
    const totalScale = coverScale * focus.scale;
    const scaledW = natural.w * totalScale;
    const scaledH = natural.h * totalScale;
    const maxX = Math.max(0, scaledW - cw);
    const maxY = Math.max(0, scaledH - ch);
    return {
        maxX,
        maxY,
        scaledW,
        scaledH,
        left: -maxX * focus.offsetX,
        top: -maxY * focus.offsetY,
    };
}

export interface IdCardFieldOption {
    field: string;
    label: string;
    onceOnly?: boolean;
}

export const BASE_ID_CARD_FIELDS: IdCardFieldOption[] = [
    { field: 'fullName', label: 'Full name', onceOnly: true },
    { field: 'tierName', label: 'Tier', onceOnly: true },
    { field: 'email', label: 'Email', onceOnly: true },
    { field: 'phoneNumber', label: 'Phone', onceOnly: true },
    { field: 'confirmationCode', label: 'Confirmation code', onceOnly: true },
];

export function customFieldKey(fieldId: Id | string): string {
    return `customField:${fieldId}`;
}

export function parseCustomFieldId(fieldKey: string): string | null {
    if (!fieldKey.startsWith('customField:')) return null;
    const id = fieldKey.slice('customField:'.length);
    return id || null;
}

export function buildAvailableIdCardFields(
    customFields: EventCustomFieldRef[] = [],
): IdCardFieldOption[] {
    const custom = customFields
        .filter((field) => field.isActive !== false)
        .map((field) => ({
            field: customFieldKey(field.id),
            label: field.label,
            onceOnly: true,
        }));
    return [...BASE_ID_CARD_FIELDS, ...custom];
}

export function sampleIdCardFieldValue(fieldKey: string): string {
    switch (fieldKey) {
        case 'fullName':
            return 'Jane Doe';
        case 'tierName':
            return 'General';
        case 'email':
            return 'jane@example.com';
        case 'phoneNumber':
            return '+20 100 000 0000';
        case 'confirmationCode':
            return 'SAMPLE1234';
        default:
            if (parseCustomFieldId(fieldKey)) return 'Sample value';
            return fieldKey;
    }
}

function resolveTierName(
    registration: EventRegistrationRef,
    tiers: EventTierRef[] = [],
): string {
    if (registration.tier?.name) return registration.tier.name;
    const tierId = registration.tierId;
    if (tierId == null) return '';
    const match = tiers.find((tier) => String(tier.id) === String(tierId));
    return match?.name ?? '';
}

function formatFieldDisplay(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.map(String).join(', ');
    return String(value);
}

export function resolveIdCardFieldValue(
    fieldKey: string,
    registration: EventRegistrationRef,
    tiers: EventTierRef[] = [],
    customFields: EventCustomFieldRef[] = [],
): string {
    switch (fieldKey) {
        case 'fullName':
            return registration.fullName ?? '';
        case 'tierName':
            return resolveTierName(registration, tiers);
        case 'email':
            return registration.email ?? '';
        case 'phoneNumber':
            return registration.phoneNumber ?? '';
        case 'confirmationCode':
            return registration.confirmationCode ?? '';
        default: {
            const customId = parseCustomFieldId(fieldKey);
            if (!customId) return '';
            const field = customFields.find((item) => String(item.id) === customId);
            if (!field) {
                const values = registration.customFieldValues;
                if (!values || typeof values !== 'object') return '';
                return formatFieldDisplay(
                    (values as Record<string, unknown>)[customId]
                        ?? (values as Record<string, unknown>)[fieldKey],
                );
            }
            return formatFieldDisplay(getCustomFieldValue(registration, field));
        }
    }
}

export function createStarterIdCardLayout(): IdCardLayoutElement[] {
    const qrSize = 160;
    const canvasWidth = DEFAULT_ID_CARD_CANVAS_WIDTH;
    const qrX = Math.round((canvasWidth - qrSize) / 2);
    return [
        {
            id: crypto.randomUUID(),
            type: 'qr',
            x: qrX,
            y: 48,
            width: qrSize,
            height: qrSize,
        },
        {
            id: crypto.randomUUID(),
            type: 'field',
            field: 'fullName',
            x: 24,
            y: 240,
            width: canvasWidth - 48,
            height: 36,
            fontSize: 22,
            fontWeight: 'bold',
            align: 'center',
            color: '#111827',
        },
        {
            id: crypto.randomUUID(),
            type: 'field',
            field: 'tierName',
            x: 24,
            y: 286,
            width: canvasWidth - 48,
            height: 28,
            fontSize: 16,
            fontWeight: 'normal',
            align: 'center',
            color: '#374151',
        },
    ];
}

export function normalizeIdCardLayout(layout: unknown): IdCardLayoutElement[] | null {
    if (layout == null) return null;
    if (!Array.isArray(layout)) return null;

    const elements: IdCardLayoutElement[] = [];
    for (const raw of layout) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const item = raw as Record<string, unknown>;
        const type = item.type;
        if (type !== 'qr' && type !== 'field' && type !== 'static') continue;
        const x = Number(item.x);
        const y = Number(item.y);
        const width = Number(item.width);
        const height = Number(item.height);
        if (![x, y, width, height].every(Number.isFinite)) continue;

        const element: IdCardLayoutElement = {
            id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
            type,
            x,
            y,
            width: Math.max(1, width),
            height: Math.max(1, type === 'qr' ? width : height),
        };

        if (typeof item.field === 'string') element.field = item.field;
        if (typeof item.text === 'string') element.text = item.text;
        if (typeof item.fontSize === 'number' && Number.isFinite(item.fontSize)) {
            element.fontSize = item.fontSize;
        }
        if (item.fontWeight === 'normal' || item.fontWeight === 'bold') {
            element.fontWeight = item.fontWeight;
        }
        if (item.align === 'left' || item.align === 'center' || item.align === 'right') {
            element.align = item.align;
        }
        if (typeof item.color === 'string') element.color = item.color;

        if (type === 'qr') {
            element.height = element.width;
        }

        elements.push(element);
    }

    return elements;
}

export function layoutFromDesign(
    design: { idCardLayout?: unknown } | null | undefined,
): IdCardLayoutElement[] {
    const normalized = normalizeIdCardLayout(design?.idCardLayout);
    if (normalized && normalized.length > 0) return normalized;
    return createStarterIdCardLayout();
}

export function canvasSizeFromDesign(
    design: {
        idCardCanvasWidth?: number | null;
        idCardCanvasHeight?: number | null;
    } | null | undefined,
): { width: number; height: number } {
    const width = Number(design?.idCardCanvasWidth);
    const height = Number(design?.idCardCanvasHeight);
    return {
        width: Number.isFinite(width) && width > 0
            ? Math.min(ID_CARD_CANVAS_MAX, Math.max(ID_CARD_CANVAS_MIN, Math.round(width)))
            : DEFAULT_ID_CARD_CANVAS_WIDTH,
        height: Number.isFinite(height) && height > 0
            ? Math.min(ID_CARD_CANVAS_MAX, Math.max(ID_CARD_CANVAS_MIN, Math.round(height)))
            : DEFAULT_ID_CARD_CANVAS_HEIGHT,
    };
}
