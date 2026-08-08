import type { NotificationEventType } from '@iclub/shared';

const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
    TASK_ASSIGNED: 'Task assigned',
    TASK_SELF_ASSIGNED: 'Self-assigned task',
    TASK_LEADER_ASSIGNED: 'Leader assigned',
    TASK_STATUS_CHANGED: 'Task status',
    TASK_COMMENTED: 'Task comment',
    EVENT_TASK_ASSIGNED: 'Event task assigned',
    EVENT_TASK_LEADER_ASSIGNED: 'Event leader assigned',
    PROJECT_CREATED: 'Project created',
    PROJECT_STATUS_CHANGED: 'Project status',
    SCHEDULE_SLOT_ASSIGNED: 'Schedule slot',
    TEAM_MEMBER_JOINED: 'Team member joined',
    ANNOUNCEMENT: 'Announcement',
    DOCUMENT_ACCESS_REQUESTED: 'Document access',
};

function titleCaseWords(value: string): string {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/** Short human label for notification type chips (not raw enum ALL CAPS). */
export function formatNotificationEventLabel(eventType: string): string {
    if (eventType in NOTIFICATION_EVENT_LABELS) {
        return NOTIFICATION_EVENT_LABELS[eventType as NotificationEventType];
    }
    return titleCaseWords(eventType.replaceAll('_', ' '));
}
