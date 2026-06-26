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
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode?: string | null;
}): string {
    const title = input.label?.trim();
    const parsed = new Date(`${input.sessionDate.slice(0, 10)}T12:00:00`);
    const dateLabel = Number.isNaN(parsed.getTime())
        ? input.sessionDate
        : parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeRange = input.startTime && input.endTime ? `${input.startTime}–${input.endTime}` : null;
    const modeLabel = input.mode === 'ONSITE' ? 'Onsite' : input.mode === 'ONLINE' ? 'Online' : null;
    return [title, dateLabel, timeRange, modeLabel].filter(Boolean).join(' · ');
}
