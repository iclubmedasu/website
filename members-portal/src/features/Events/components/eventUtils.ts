import { formatSessionRange } from '@iclub/shared/utils';

export type EventTabKey = 'tiers' | 'registrations' | 'tickets' | 'statistics' | 'tasks';

export const EVENT_TABS = [
    { key: 'statistics' as const, label: 'Statistics' },
    { key: 'tiers' as const, label: 'Setup' },
    { key: 'registrations' as const, label: 'Registrations' },
    { key: 'tickets' as const, label: 'Tickets' },
    { key: 'tasks' as const, label: 'Tasks' },
];

export const EVENT_STATUS_CLASS: Record<string, string> = {
    DRAFT: 'badge badge-event-DRAFT',
    PUBLISHED: 'badge badge-event-PUBLISHED',
    COMPLETED: 'badge badge-event-COMPLETED',
    CANCELLED: 'badge badge-event-CANCELLED',
};

export function parseEventTab(value: string | null): EventTabKey | null {
    if (!value) return null;
    if (value === 'overview') return 'statistics';
    if (value === 'builder') return 'registrations';
    if (value === 'checkin') return 'registrations';
    const valid: EventTabKey[] = ['tiers', 'registrations', 'tickets', 'statistics', 'tasks'];
    return valid.includes(value as EventTabKey) ? (value as EventTabKey) : null;
}

export function formatSessionDisplayLabel(input: {
    label?: string | null;
    startDateTime?: string | null;
    endDateTime?: string | null;
    sessionDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    mode?: string | null;
}): string {
    const title = input.label?.trim();
    const scheduleLabel = input.startDateTime && input.endDateTime
        ? formatSessionRange(input.startDateTime, input.endDateTime)
        : null;
    const modeLabel = input.mode === 'ONSITE' ? 'Onsite' : input.mode === 'ONLINE' ? 'Online' : null;
    return [title, scheduleLabel, modeLabel].filter(Boolean).join(' · ');
}

export function compareSessionsBySchedule<T extends {
    startDateTime?: string | null;
    sessionDate?: string;
    order?: number | null;
}>(a: T, b: T): number {
    if (a.startDateTime && b.startDateTime) {
        const instantCompare = a.startDateTime.localeCompare(b.startDateTime);
        if (instantCompare !== 0) return instantCompare;
    } else if (a.sessionDate && b.sessionDate) {
        const dateCompare = a.sessionDate.localeCompare(b.sessionDate);
        if (dateCompare !== 0) return dateCompare;
    }
    return (a.order ?? 0) - (b.order ?? 0);
}
