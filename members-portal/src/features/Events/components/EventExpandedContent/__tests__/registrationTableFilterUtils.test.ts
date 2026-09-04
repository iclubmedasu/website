import { describe, expect, it } from 'vitest';
import type {
    EventCustomFieldRef,
    EventRegistrationRef,
    EventSessionRef,
    EventTierRef,
} from '@/types/backend-contracts';
import {
    applyRegistrationColumnFilters,
    applyRegistrationTextSearch,
    buildFilterableColumns,
    sortRegistrations,
    type RegistrationColumnFilter,
    type RegistrationTableContext,
} from '../registrationTableFilterUtils';

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

const dietField: EventCustomFieldRef = {
    id: 5,
    eventId: 1,
    label: 'Diet',
    type: 'checkbox',
    order: 1,
};

const ageField: EventCustomFieldRef = {
    id: 6,
    eventId: 1,
    label: 'Age',
    type: 'number',
    order: 2,
};

const tiers: EventTierRef[] = [
    { id: 10, eventId: 1, name: 'Gold', price: 0 },
    { id: 20, eventId: 1, name: 'Silver', price: 0 },
];

const sessions: EventSessionRef[] = [
    {
        id: 100,
        eventId: 1,
        label: 'Opening',
        startDateTime: '2026-07-01T09:00:00.000Z',
        endDateTime: '2026-07-01T10:00:00.000Z',
        sessionDate: '2026-07-01',
        startTime: null,
        endTime: null,
        mode: 'ONSITE',
        onlineUrl: null,
        order: 1,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 200,
        eventId: 1,
        label: 'Workshop',
        startDateTime: '2026-07-02T09:00:00.000Z',
        endDateTime: '2026-07-02T10:00:00.000Z',
        sessionDate: '2026-07-02',
        startTime: null,
        endTime: null,
        mode: 'ONSITE',
        onlineUrl: null,
        order: 2,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
];

const eventDays = ['2026-07-01', '2026-07-02'];

const context: RegistrationTableContext = {
    tableKind: 'registrations',
    fields: [dietField, ageField],
    tiers,
    sessions: [],
    eventDays: [],
};

const attendanceContext: RegistrationTableContext = {
    tableKind: 'registrations',
    fields: [],
    tiers: [],
    sessions,
    eventDays,
};

describe('registrationTableFilterUtils', () => {
    it('buildFilterableColumns includes checkbox custom fields', () => {
        const columns = buildFilterableColumns('registrations', [dietField], tiers, [], []);
        expect(columns.some((column) => column.id === 'custom:5' && column.kind === 'checkbox')).toBe(true);
    });

    it('buildFilterableColumns always includes days attended and calendar-based specific days', () => {
        const columns = buildFilterableColumns('registrations', [], [], [], eventDays);
        expect(columns.some((column) => column.id === 'attendanceDaysCount' && column.kind === 'count')).toBe(true);
        expect(columns.some((column) => column.id === 'attendedDays' && column.kind === 'idSet')).toBe(true);
    });

    it('buildFilterableColumns adds session attendance and selected-session rules when sessions exist', () => {
        const columns = buildFilterableColumns('tickets', [], [], sessions, eventDays);
        expect(columns.some((column) => column.id === 'sessionsAttendedCount' && column.kind === 'count')).toBe(true);
        expect(columns.some((column) => column.id === 'attendedSessionIds' && column.kind === 'idSet')).toBe(true);
        expect(columns.some((column) => (
            column.id === 'selectedSessions'
            && column.kind === 'idSet'
            && column.idSetAllowHasNone
        ))).toBe(true);
        expect(columns.some((column) => column.id === 'sessions')).toBe(false);
        expect(columns.some((column) => column.id === 'attendance')).toBe(false);
    });

    it('applyRegistrationTextSearch matches phone numbers with formatting stripped', () => {
        const rows = [
            registration({ id: 1, phoneNumber: '+1 (555) 123-4567' }),
            registration({ id: 2, phoneNumber: '999' }),
        ];
        const filtered = applyRegistrationTextSearch(rows, '555123');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe(1);
    });

    it('filters checkbox custom field Yes/No with unset treated as No', () => {
        const rows = [
            registration({ id: 1, customFieldValues: { '5': true } }),
            registration({ id: 2, customFieldValues: { '5': false } }),
            registration({ id: 3, customFieldValues: {} }),
        ];

        const yesFilter: RegistrationColumnFilter = {
            columnId: 'custom:5',
            kind: 'checkbox',
            value: 'yes',
        };
        const noFilter: RegistrationColumnFilter = {
            columnId: 'custom:5',
            kind: 'checkbox',
            value: 'no',
        };

        expect(applyRegistrationColumnFilters(rows, [yesFilter], context).map((row) => row.id)).toEqual([1]);
        expect(applyRegistrationColumnFilters(rows, [noFilter], context).map((row) => row.id)).toEqual([2, 3]);
    });

    it('filters tier equals and combines AND filters', () => {
        const rows = [
            registration({ id: 1, tierId: 10, fullName: 'Alice Alpha' }),
            registration({ id: 2, tierId: 20, fullName: 'Bob Beta' }),
            registration({ id: 3, tierId: 10, fullName: 'Charlie Gamma' }),
        ];

        const filters: RegistrationColumnFilter[] = [
            { columnId: 'tier', kind: 'tier', tierId: '10' },
            {
                columnId: 'fullName',
                kind: 'text',
                operator: 'contains',
                value: 'a',
            },
        ];

        expect(applyRegistrationColumnFilters(rows, filters, context).map((row) => row.id)).toEqual([1, 3]);
    });

    it('filters days attended and specific days', () => {
        const rows = [
            registration({
                id: 1,
                attendanceDays: [
                    { eventDay: '2026-07-01', checkedInAt: '2026-07-01T10:00:00.000Z' },
                    { eventDay: '2026-07-02', checkedInAt: '2026-07-02T10:00:00.000Z' },
                ],
            }),
            registration({
                id: 2,
                attendanceDays: [
                    { eventDay: '2026-07-01', checkedInAt: '2026-07-01T10:00:00.000Z' },
                ],
            }),
            registration({ id: 3, attendanceDays: [] }),
        ];

        const hasAny: RegistrationColumnFilter = {
            columnId: 'attendanceDaysCount',
            kind: 'count',
            operator: 'hasAny',
        };
        expect(applyRegistrationColumnFilters(rows, [hasAny], attendanceContext).map((row) => row.id)).toEqual([1, 2]);

        const allDays: RegistrationColumnFilter = {
            columnId: 'attendedDays',
            kind: 'idSet',
            operator: 'includesAll',
            values: ['2026-07-01', '2026-07-02'],
        };
        expect(applyRegistrationColumnFilters(rows, [allDays], attendanceContext).map((row) => row.id)).toEqual([1]);
    });

    it('filters sessions attended, specific sessions, and selected sessions', () => {
        const rows = [
            registration({
                id: 1,
                sessionAttendances: [
                    {
                        id: 1,
                        sessionId: 100,
                        registrationId: 1,
                        mode: 'ONSITE',
                        joinedAt: '2026-07-01T09:00:00.000Z',
                    },
                    {
                        id: 2,
                        sessionId: 200,
                        registrationId: 1,
                        mode: 'ONSITE',
                        joinedAt: '2026-07-02T09:00:00.000Z',
                    },
                ],
                sessionSelections: [
                    { sessionId: 100, sessionDate: '2026-07-01' },
                    { sessionId: 200, sessionDate: '2026-07-02' },
                ],
            }),
            registration({
                id: 2,
                sessionAttendances: [
                    {
                        id: 3,
                        sessionId: 100,
                        registrationId: 2,
                        mode: 'ONSITE',
                        joinedAt: '2026-07-01T09:00:00.000Z',
                    },
                ],
                sessionSelections: [
                    { sessionId: 100, sessionDate: '2026-07-01' },
                ],
            }),
            registration({
                id: 3,
                sessionAttendances: [],
                sessionSelections: [],
            }),
        ];

        const sessionsAttended: RegistrationColumnFilter = {
            columnId: 'sessionsAttendedCount',
            kind: 'count',
            operator: 'equals',
            value: 2,
        };
        expect(applyRegistrationColumnFilters(rows, [sessionsAttended], attendanceContext).map((row) => row.id)).toEqual([1]);

        const anySession: RegistrationColumnFilter = {
            columnId: 'attendedSessionIds',
            kind: 'idSet',
            operator: 'includesAny',
            values: ['200'],
        };
        expect(applyRegistrationColumnFilters(rows, [anySession], attendanceContext).map((row) => row.id)).toEqual([1]);

        const selectedAll: RegistrationColumnFilter = {
            columnId: 'selectedSessions',
            kind: 'idSet',
            operator: 'includesAll',
            values: ['100', '200'],
        };
        expect(applyRegistrationColumnFilters(rows, [selectedAll], attendanceContext).map((row) => row.id)).toEqual([1]);

        const selectedNone: RegistrationColumnFilter = {
            columnId: 'selectedSessions',
            kind: 'idSet',
            operator: 'hasNone',
            values: [],
        };
        expect(applyRegistrationColumnFilters(rows, [selectedNone], attendanceContext).map((row) => row.id)).toEqual([3]);
    });

    it('sorts text columns alphabetically and numeric columns numerically', () => {
        const rows = [
            registration({ id: 1, fullName: 'Zoe', customFieldValues: { '6': 30 } }),
            registration({ id: 2, fullName: 'Anna', customFieldValues: { '6': 5 } }),
            registration({ id: 3, fullName: 'Mike', customFieldValues: { '6': 12 } }),
        ];

        const byName = sortRegistrations(rows, { columnId: 'fullName', direction: 'asc' }, context);
        expect(byName.map((row) => row.fullName)).toEqual(['Anna', 'Mike', 'Zoe']);

        const byAge = sortRegistrations(rows, { columnId: 'custom:6', direction: 'asc' }, context);
        expect(byAge.map((row) => row.id)).toEqual([2, 3, 1]);
    });

    it('does not throw when sort columnId is undefined', () => {
        const rows = [registration({ id: 1 }), registration({ id: 2, fullName: 'Bob' })];
        expect(() =>
            sortRegistrations(
                rows,
                { columnId: undefined as unknown as string, direction: 'asc' },
                context,
            ),
        ).not.toThrow();
    });
});
