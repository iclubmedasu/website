import type { CardPriorityValue, CardStatusValue } from './types';

const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
    CRITICAL: 'Critical',
};

export function fmtDate(d: string | Date | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getCategoryClass(category: string | null | undefined): string {
    return 'badge-category-' + (category ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

interface StatusBadgeProps {
    status: CardStatusValue | null | undefined;
}

interface PriorityBadgeProps {
    priority: CardPriorityValue | null | undefined;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    const normalizedStatus = status ?? 'UNKNOWN';
    return (
        <span className={`badge badge-status-${normalizedStatus}`}>
            <span className={`status-dot status-dot-${normalizedStatus}`} />
            {STATUS_LABELS[String(normalizedStatus)] ?? String(normalizedStatus)}
        </span>
    );
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
    const normalizedPriority = priority ?? 'UNKNOWN';
    return (
        <span className={`badge badge-priority-${normalizedPriority}`}>
            {PRIORITY_LABELS[String(normalizedPriority)] ?? String(normalizedPriority)}
        </span>
    );
}
