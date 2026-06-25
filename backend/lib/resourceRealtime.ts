import { publishToTopic } from '../services/notificationsRealtime';

export function publishEventChanged(params: {
    eventId: number;
    version: number;
    actorMemberId: number | null;
}): void {
    publishToTopic(`event:${params.eventId}`, {
        type: 'resource.changed',
        resource: 'event',
        id: params.eventId,
        version: params.version,
        actorMemberId: params.actorMemberId,
    });
}

export function publishProjectChanged(params: {
    projectId: number;
    version: number;
    actorMemberId: number | null;
}): void {
    publishToTopic(`project:${params.projectId}`, {
        type: 'resource.changed',
        resource: 'project',
        id: params.projectId,
        version: params.version,
        actorMemberId: params.actorMemberId,
    });
}
