import type { Id, ISODateTime } from "./member";

export type NotificationEventType =
    | "TASK_ASSIGNED"
    | "TASK_SELF_ASSIGNED"
    | "TASK_LEADER_ASSIGNED"
    | "TASK_STATUS_CHANGED"
    | "TASK_COMMENTED"
    | "EVENT_TASK_ASSIGNED"
    | "EVENT_TASK_LEADER_ASSIGNED"
    | "PROJECT_CREATED"
    | "PROJECT_STATUS_CHANGED"
    | "SCHEDULE_SLOT_ASSIGNED"
    | "TEAM_MEMBER_JOINED"
    | "ANNOUNCEMENT";

export type NotificationAudienceType =
    | "MEMBER"
    | "TEAM"
    | "PROJECT"
    | "TASK"
    | "EVENT"
    | "SYSTEM";

export interface NotificationEvent {
    id: Id;
    eventType: NotificationEventType;
    actorMemberId?: Id | null;
    audienceType: NotificationAudienceType;
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
    createdAt: ISODateTime;
}

export interface NotificationItem {
    id: Id;
    memberId: Id;
    eventId?: Id | null;
    eventType: NotificationEventType;
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
    isRead: boolean;
    readAt?: ISODateTime | null;
    createdAt: ISODateTime;
}

export interface NotificationsListResponse {
    notifications: NotificationItem[];
    nextCursor: Id | null;
}

export interface NotificationUnreadCountResponse {
    unreadCount: number;
}

export interface NotificationMarkReadResponse {
    notification: NotificationItem;
}

export interface NotificationMarkAllReadResponse {
    updatedCount: number;
}

export interface NotificationRealtimeMessage {
    type: "notification.created" | "notification.ping" | "resource.changed";
    notificationId?: Id;
    eventType?: NotificationEventType;
    createdAt?: ISODateTime;
    resource?: "event" | "project";
    id?: Id;
    version?: number;
    actorMemberId?: Id | null;
}
