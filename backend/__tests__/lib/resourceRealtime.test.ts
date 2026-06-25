import { describe, expect, it, vi } from 'vitest';

const publishToTopic = vi.hoisted(() => vi.fn());

vi.mock('../../services/notificationsRealtime', () => ({
    publishToTopic,
}));

import { publishEventChanged, publishProjectChanged } from '../../lib/resourceRealtime';

describe('resourceRealtime', () => {
    it('publishes event changes to the event topic', () => {
        publishEventChanged({ eventId: 9, version: 2, actorMemberId: 4 });

        expect(publishToTopic).toHaveBeenCalledWith('event:9', {
            type: 'resource.changed',
            resource: 'event',
            id: 9,
            version: 2,
            actorMemberId: 4,
        });
    });

    it('publishes project changes to the project topic', () => {
        publishProjectChanged({ projectId: 3, version: 5, actorMemberId: null });

        expect(publishToTopic).toHaveBeenCalledWith('project:3', {
            type: 'resource.changed',
            resource: 'project',
            id: 3,
            version: 5,
            actorMemberId: null,
        });
    });
});
