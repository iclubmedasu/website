import { describe, expect, it } from 'vitest';
import type { EventCustomFieldRef, EventRegistrationRef, EventTierRef } from '@/types/backend-contracts';
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

const context: RegistrationTableContext = {
    tableKind: 'registrations',
    fields: [dietField, ageField],
    tiers,
    sessions: [],
    multiDayEvent: false,
};

describe('registrationTableFilterUtils', () => {
    it('buildFilterableColumns includes checkbox custom fields', () => {
        const columns = buildFilterableColumns('registrations', [dietField], tiers, [], false);
        expect(columns.some((column) => column.id === 'custom:5' && column.kind === 'checkbox')).toBe(true);
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
