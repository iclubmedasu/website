import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    updateMany: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    executeRaw: vi.fn(),
}));

vi.mock('../../db', () => ({
    prisma: {
        eventRegistration: {
            updateMany: prismaMocks.updateMany,
            update: prismaMocks.update,
            findFirst: prismaMocks.findFirst,
        },
        $executeRaw: prismaMocks.executeRaw,
    },
}));

import { mergeRegistrationCustomFieldValues } from '../../lib/atomicJsonMerge';
import { parseExpectedVersion } from '../../lib/optimisticLock';

describe('optimisticLock helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('treats missing version as force update', () => {
        expect(parseExpectedVersion({})).toBeNull();
        expect(parseExpectedVersion({ fullName: 'Ada' })).toBeNull();
    });

    it('parses numeric version values', () => {
        expect(parseExpectedVersion({ version: 3 })).toBe(3);
    });
});

describe('atomicJsonMerge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('merges custom field patches with a version bump by default', async () => {
        await mergeRegistrationCustomFieldValues(12, { '4': 'VIP' });

        expect(prismaMocks.executeRaw).toHaveBeenCalledTimes(1);
    });
});
