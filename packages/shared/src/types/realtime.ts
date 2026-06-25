import type { Id } from './member';

export type RealtimeResourceType = 'event' | 'project';

export interface RealtimeSubscribeMessage {
    action: 'subscribe' | 'unsubscribe';
    topic: string;
}

export interface ResourceChangedMessage {
    type: 'resource.changed';
    resource: RealtimeResourceType;
    id: Id;
    version: number;
    actorMemberId?: Id | null;
}

export type RealtimeMessage =
    | ResourceChangedMessage
    | import('./notification').NotificationRealtimeMessage;
