export type EventTabKey = 'tiers' | 'builder' | 'registrations' | 'checkin' | 'statistics';

export const EVENT_TABS = [
    { key: 'statistics' as const, label: 'Statistics' },
    { key: 'tiers' as const, label: 'Tiers' },
    { key: 'builder' as const, label: 'Form Builder' },
    { key: 'registrations' as const, label: 'Registrations' },
    { key: 'checkin' as const, label: 'Check-in' },
];

export const EVENT_STATUS_CLASS: Record<string, string> = {
    DRAFT: 'event-status-badge event-status-badge--draft',
    PUBLISHED: 'event-status-badge event-status-badge--published',
    COMPLETED: 'event-status-badge event-status-badge--completed',
    CANCELLED: 'event-status-badge event-status-badge--cancelled',
};

export function parseEventTab(value: string | null): EventTabKey | null {
    if (!value) return null;
    if (value === 'overview') return 'statistics';
    const valid: EventTabKey[] = ['tiers', 'builder', 'registrations', 'checkin', 'statistics'];
    return valid.includes(value as EventTabKey) ? (value as EventTabKey) : null;
}
