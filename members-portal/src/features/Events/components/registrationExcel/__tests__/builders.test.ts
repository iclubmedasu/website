import { describe, expect, it } from 'vitest';
import type { EventRegistrationRef, EventSessionRef } from '@/types/backend-contracts';
import {
    buildMemberSummaryMatrix,
    computeMemberMetrics,
    computeOverviewKpis,
    computeSessionMetrics,
    computeTierMetrics,
    formatAttendancePercent,
} from '../builders';

function registration(overrides: Partial<EventRegistrationRef> = {}): EventRegistrationRef {
    return {
        id: 1,
        eventId: 1,
        fullName: 'Alice Alpha',
        email: 'alice@example.com',
        confirmationCode: 'ABC123',
        status: 'REGISTERED',
        tierId: 10,
        tier: { id: 10, eventId: 1, name: 'Gold', price: 0 },
        customFieldValues: {},
        ...overrides,
    };
}

function session(overrides: Partial<EventSessionRef> = {}): EventSessionRef {
    return {
        id: 100,
        eventId: 1,
        label: 'Morning',
        startDateTime: '2026-07-20T09:00:00.000Z',
        endDateTime: '2026-07-20T11:00:00.000Z',
        sessionDate: '2026-07-20',
        startTime: '09:00',
        endTime: '11:00',
        mode: 'ONSITE',
        onlineUrl: null,
        isActive: true,
        order: 0,
        ...overrides,
    };
}

describe('registrationExcel builders', () => {
    it('computeOverviewKpis aligns with event statistics semantics', () => {
        const registrations = [
            registration({ id: 1, status: 'REGISTERED' }),
            registration({ id: 2, status: 'CHECKED_IN' }),
            registration({ id: 3, status: 'REGISTERED', isWalkIn: true }),
            registration({ id: 4, status: 'CANCELLED' }),
            registration({ id: 5, status: 'REGISTERED', isWalkIn: false }),
        ];

        expect(computeOverviewKpis(registrations)).toEqual({
            registered: 3,
            checkedIn: 1,
            walkIns: 1,
            noShows: 2,
            totalAttended: 2,
        });
    });

    it('computeSessionMetrics counts registered, attended, and missed per session', () => {
        const sessions = [
            session({ id: 100, label: 'Morning' }),
            session({ id: 101, label: 'Afternoon', order: 1 }),
        ];
        const registrations = [
            registration({
                id: 1,
                sessionSelections: [{ sessionId: 100, sessionDate: '2026-07-20', label: 'Morning' }],
                sessionAttendances: [{
                    id: 1,
                    registrationId: 1,
                    sessionId: 100,
                    joinedAt: '2026-07-20T09:15:00.000Z',
                    mode: 'ONSITE',
                }],
            }),
            registration({
                id: 2,
                sessionSelections: [
                    { sessionId: 100, sessionDate: '2026-07-20', label: 'Morning' },
                    { sessionId: 101, sessionDate: '2026-07-20', label: 'Afternoon' },
                ],
            }),
            registration({
                id: 3,
                status: 'CANCELLED',
                sessionSelections: [{ sessionId: 100, sessionDate: '2026-07-20', label: 'Morning' }],
            }),
        ];

        expect(computeSessionMetrics(registrations, sessions)).toEqual([
            { sessionId: '100', label: expect.any(String), registered: 2, attended: 1, missed: 1 },
            { sessionId: '101', label: expect.any(String), registered: 1, attended: 0, missed: 1 },
        ]);
    });

    it('computeMemberMetrics derives total sessions, selected, attended, missed, and attendance %', () => {
        const sessions = [
            session({ id: 100, label: 'Morning' }),
            session({ id: 101, label: 'Afternoon', order: 1 }),
            session({ id: 102, label: 'Evening', order: 2 }),
            session({ id: 103, label: 'Inactive', order: 3, isActive: false }),
        ];
        const registrations = [
            registration({
                id: 1,
                fullName: 'Bob',
                sessionSelections: [
                    { sessionId: 100, sessionDate: '2026-07-20', label: 'Morning' },
                    { sessionId: 101, sessionDate: '2026-07-20', label: 'Afternoon' },
                ],
                sessionAttendances: [{
                    id: 1,
                    registrationId: 1,
                    sessionId: 100,
                    joinedAt: '2026-07-20T09:15:00.000Z',
                    mode: 'ONSITE',
                }],
            }),
        ];

        expect(computeMemberMetrics(registrations, sessions)).toEqual([
            {
                name: 'Bob',
                email: 'alice@example.com',
                tier: 'Gold',
                totalSessions: 3,
                sessionsSelected: 2,
                attended: 1,
                missed: 1,
                attendancePercent: 33,
                totalDurationMinutes: expect.any(Number),
            },
        ]);
    });

    it('formatAttendancePercent and buildMemberSummaryMatrix include total sessions and attendance %', () => {
        expect(formatAttendancePercent(3, 4)).toBe('75%');
        expect(formatAttendancePercent(1, 0)).toBe('0%');

        const matrix = buildMemberSummaryMatrix([
            {
                name: 'Bob',
                email: 'bob@example.com',
                tier: 'Gold',
                totalSessions: 4,
                sessionsSelected: 2,
                attended: 3,
                missed: 0,
                attendancePercent: 75,
            },
        ]);

        expect(matrix[0]).toEqual([
            'Name',
            'Email',
            'Tier',
            'Total sessions',
            'Sessions selected',
            'Attended',
            'Missed',
            'Attendance %',
        ]);
        expect(matrix[1]).toEqual(['Bob', 'bob@example.com', 'Gold', '4', '2', '3', '0', '75%']);
    });

    it('computeTierMetrics groups active registrations by tier', () => {
        const registrations = [
            registration({ id: 1, tierId: 10, tier: { id: 10, eventId: 1, name: 'Gold', price: 0 } }),
            registration({ id: 2, tierId: 20, tier: { id: 20, eventId: 1, name: 'Silver', price: 0 } }),
            registration({ id: 3, tierId: 10, tier: { id: 10, eventId: 1, name: 'Gold', price: 0 } }),
            registration({ id: 4, status: 'CANCELLED', tierId: 20 }),
        ];

        expect(computeTierMetrics(registrations)).toEqual([
            { tierId: '10', tierName: 'Gold', registrations: 2 },
            { tierId: '20', tierName: 'Silver', registrations: 1 },
        ]);
    });
});
