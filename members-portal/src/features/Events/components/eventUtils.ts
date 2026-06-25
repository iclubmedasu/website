export type EventTabKey = 'tiers' | 'registrations' | 'tickets' | 'statistics' | 'tasks';

export const EVENT_TABS = [
    { key: 'statistics' as const, label: 'Statistics' },
    { key: 'tiers' as const, label: 'Tiers' },
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
