import { publishToTopic } from '../services/notificationsRealtime';

export function publishEventChanged(params: {
    eventId: number;
    version: number;
    actorMemberId: number | null;
    clientInstanceId?: string | null;
}): void {
    publishToTopic(`event:${params.eventId}`, {
        type: 'resource.changed',
        resource: 'event',
        id: params.eventId,
        version: params.version,
        actorMemberId: params.actorMemberId,
        ...(params.clientInstanceId ? { clientInstanceId: params.clientInstanceId } : {}),
    });
}

export function publishProjectChanged(params: {
    projectId: number;
    version: number;
    actorMemberId: number | null;
    clientInstanceId?: string | null;
}): void {
    publishToTopic(`project:${params.projectId}`, {
        type: 'resource.changed',
        resource: 'project',
        id: params.projectId,
        version: params.version,
        actorMemberId: params.actorMemberId,
        ...(params.clientInstanceId ? { clientInstanceId: params.clientInstanceId } : {}),
    });
}
