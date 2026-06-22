import { describe, expect, it } from 'vitest';
import {
    collectReadableChanges,
    getBadgeLabel,
    getEntityDetails,
} from '../../../members-portal/src/components/ActivityTimeline/activityTimelineFormatters';

describe('activityTimelineFormatters', () => {
    it('formats numeric assignment logs with member name from description', () => {
        const rows = collectReadableChanges(null, 7, {
            actionType: 'ASSIGNED',
            description: 'Assigned Jane Doe to "Wireframes"',
        });

        expect(rows).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: 'Member', after: 'Jane Doe', afterOnly: true }),
            expect.objectContaining({ label: 'Task', after: 'Wireframes', afterOnly: true }),
        ]));
    });

    it('formats object assignment logs with member and slot times', () => {
        const rows = collectReadableChanges(null, {
            memberId: 7,
            memberName: 'Jane Doe',
            taskTitle: 'Registration desk',
            startDateTime: '2026-06-30T10:00:00.000Z',
            endDateTime: '2026-06-30T12:00:00.000Z',
        }, {
            actionType: 'ASSIGNED',
        });

        expect(rows.some((row) => row.label === 'Member' && row.after === 'Jane Doe')).toBe(true);
        expect(rows.some((row) => row.label === 'Start time')).toBe(true);
        expect(rows.some((row) => row.label === 'End time')).toBe(true);
    });

    it('shows comment text for COMMENTED actions', () => {
        const rows = collectReadableChanges(null, 'Looks good to me.', {
            actionType: 'COMMENTED',
        });

        expect(rows).toEqual([
            { label: 'Comment', before: '—', after: 'Looks good to me.', afterOnly: true },
        ]);
    });

    it('uses afterOnly rows for CREATED entities', () => {
        const rows = collectReadableChanges(null, { title: 'New phase', status: 'ACTIVE' }, {
            actionType: 'CREATED',
            entityType: 'PHASE',
        });

        expect(rows.every((row) => row.afterOnly)).toBe(true);
        expect(rows.some((row) => row.label === 'Title' && row.after === 'New phase')).toBe(true);
    });

    it('formats schedule slot logs with member and times', () => {
        const rows = collectReadableChanges(null, {
            memberName: 'Jane Doe',
            title: 'Sprint planning',
            startDateTime: '2026-06-30T09:00:00.000Z',
            endDateTime: '2026-06-30T11:00:00.000Z',
        }, {
            actionType: 'CREATED',
            entityType: 'SCHEDULE_SLOT',
        });

        expect(rows.some((row) => row.label === 'Member' && row.after === 'Jane Doe')).toBe(true);
        expect(rows.some((row) => row.label === 'Title' && row.after === 'Sprint planning')).toBe(true);
    });

    it('maps lifecycle badge labels to plain English', () => {
        expect(getBadgeLabel({ actionType: 'FINALIZED' })).toBe('Finalized');
        expect(getBadgeLabel({ actionType: 'DEPENDENCY_ADDED' })).toBe('Dependency Added');
        expect(getBadgeLabel({ actionType: 'ASSIGNMENT_STATUS_CHANGED' })).toBe('Assignment Status');
    });

    it('resolves event task entity names from payload', () => {
        const details = getEntityDetails({
            actionType: 'ASSIGNED',
            entityType: 'ASSIGNMENT',
            eventTask: { title: 'Registration desk' },
        }, null);

        expect(details).toEqual({
            label: 'Task',
            name: 'Registration desk',
        });
    });
});
