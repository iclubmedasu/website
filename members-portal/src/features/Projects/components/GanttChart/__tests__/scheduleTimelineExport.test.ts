import { describe, expect, it } from 'vitest';
import {
    collectScheduleTimelineSlots,
    getScheduleMemberLabel,
    groupScheduleSlotsByMember,
} from '../scheduleTimelineExport';

describe('schedule timeline export helpers', () => {
    it('prefers nested member full names', () => {
        expect(getScheduleMemberLabel({ member: { id: 7, fullName: 'Aya Hassan' } })).toBe('Aya Hassan');
    });

    it('falls back to Unknown member when the relation is missing', () => {
        expect(getScheduleMemberLabel({ memberId: 42 })).toBe('Unknown member');
    });

    it('groups slots by member and keeps Unknown member for missing relations', () => {
        const slots = collectScheduleTimelineSlots(
            {
                scheduleSlots: [
                    {
                        id: 1,
                        member: { id: 7, fullName: 'Mona Ali' },
                        startDateTime: '2026-05-17T09:00:00.000Z',
                        endDateTime: '2026-05-17T10:00:00.000Z',
                    },
                    {
                        id: 2,
                        member: { id: 8, fullName: 'Omar Samir' },
                        startDateTime: '2026-05-17T10:00:00.000Z',
                        endDateTime: '2026-05-17T11:00:00.000Z',
                    },
                    {
                        id: 3,
                        startDateTime: '2026-05-17T11:00:00.000Z',
                        endDateTime: '2026-05-17T12:00:00.000Z',
                    },
                ],
            },
        );

        const grouped = groupScheduleSlotsByMember(slots);

        expect(grouped.map((group) => group.label)).toEqual(['Mona Ali', 'Omar Samir', 'Unknown member']);
        expect(grouped[0].slots).toHaveLength(1);
        expect(grouped[1].slots).toHaveLength(1);
        expect(grouped[2].slots).toHaveLength(1);
    });
});