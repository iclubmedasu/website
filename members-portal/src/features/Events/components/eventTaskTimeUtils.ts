export const QUARTER_MINUTES = [0, 15, 30, 45] as const;

export function snapTimeToQuarter(value: string): string {
    if (!value) return '';
    const [hoursPart, minutesPart] = value.split(':');
    const hours = Number.parseInt(hoursPart, 10);
    const minutes = Number.parseInt(minutesPart, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';

    const snapped = Math.round(minutes / 15) * 15;
    const normalizedMinutes = snapped === 60 ? 0 : snapped;
    const normalizedHours = snapped === 60 ? (hours + 1) % 24 : hours;

    return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`;
}

export function isQuarterHourTime(value: string): boolean {
    if (!value) return true;
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return false;
    const minutes = Number.parseInt(match[2], 10);
    return (QUARTER_MINUTES as readonly number[]).includes(minutes);
}

export function formatTimeFromDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const raw = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return snapTimeToQuarter(raw);
}

export function parseQuarterHourTime(value: string): { hour: string; minute: string } | null {
    if (!value) return null;
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hour = match[1];
    const minute = match[2];
    if (!isQuarterHourTime(value)) return null;
    return { hour, minute };
}

export function formatQuarterHourTime(hour: string, minute: string): string {
    if (!hour || !minute) return '';
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

const PREVIEW_PADDING = 12;
const PREVIEW_MAX_WIDTH = 440;
const PREVIEW_ESTIMATED_HEIGHT = 320;

export interface PreviewPosition {
    left: number;
    top: number;
    width: number;
    placement: 'above' | 'below';
}

export function getBarPreviewPosition(rect: DOMRect | { left: number; top: number; width: number; bottom: number }): PreviewPosition {
    const popupWidth = Math.min(PREVIEW_MAX_WIDTH, window.innerWidth - PREVIEW_PADDING * 2);
    const popupHeight = PREVIEW_ESTIMATED_HEIGHT;
    const centeredLeft = rect.left + (rect.width / 2) - (popupWidth / 2);
    const left = Math.max(PREVIEW_PADDING, Math.min(centeredLeft, window.innerWidth - popupWidth - PREVIEW_PADDING));
    const spaceBelow = window.innerHeight - rect.bottom - PREVIEW_PADDING;
    const spaceAbove = rect.top - PREVIEW_PADDING;
    const placeAbove = spaceBelow < popupHeight && spaceAbove > spaceBelow;
    let top = placeAbove
        ? rect.top - popupHeight - PREVIEW_PADDING
        : rect.bottom + PREVIEW_PADDING;
    top = Math.max(PREVIEW_PADDING, Math.min(top, window.innerHeight - popupHeight - PREVIEW_PADDING));

    return {
        left,
        top,
        width: popupWidth,
        placement: placeAbove ? 'above' : 'below',
    };
}
