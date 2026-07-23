import { describe, expect, it } from 'vitest';
import {
    applyCertificateEligibleFilters,
    processCertificateEligibleRows,
    type CertificateEligibleFilter,
    type CertificateEligibleRow,
} from '../certificateEligibleFilterUtils';

const rows: CertificateEligibleRow[] = [
    {
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        type: 'ATTENDANCE',
        attendanceDaysCount: 2,
        alreadyIssued: false,
    },
    {
        fullName: 'Grace Hopper',
        email: 'grace@example.com',
        type: 'LEADERSHIP',
        attendanceDaysCount: 1,
        alreadyIssued: true,
    },
    {
        fullName: 'Alan Turing',
        email: 'alan@example.com',
        type: 'ORGANIZATION',
        attendanceDaysCount: 3,
        alreadyIssued: false,
    },
];

describe('certificateEligibleFilterUtils', () => {
    it('filters by attendance days and excludes empty results', () => {
        const filters: CertificateEligibleFilter[] = [
            { columnId: 'attendanceDaysCount', kind: 'number', operator: 'greaterThan', value: 1 },
        ];
        const result = applyCertificateEligibleFilters(rows, filters);
        expect(result.map((r) => r.fullName)).toEqual(['Ada Lovelace', 'Alan Turing']);
    });

    it('filters alreadyIssued checkbox and supports search + sort pipeline', () => {
        const filters: CertificateEligibleFilter[] = [
            { columnId: 'alreadyIssued', kind: 'checkbox', value: 'no' },
        ];
        const result = processCertificateEligibleRows(rows, 'a', filters, {
            columnId: 'fullName',
            direction: 'asc',
        });
        expect(result.map((r) => r.fullName)).toEqual(['Ada Lovelace', 'Alan Turing']);
    });

    it('filters by category and status dropdowns', () => {
        const withMeta: CertificateEligibleRow[] = [
            {
                fullName: 'Ada Lovelace',
                email: 'ada@example.com',
                type: 'ATTENDANCE',
                category: 'ATTENDEE',
                status: 'NOT_ISSUED',
                attendanceDaysCount: 2,
                alreadyIssued: false,
            },
            {
                fullName: 'Grace Hopper',
                email: 'grace@example.com',
                type: 'LEADERSHIP',
                category: 'STAFF',
                status: 'ISSUED',
                attendanceDaysCount: 1,
                alreadyIssued: true,
            },
        ];
        const categoryOnly = applyCertificateEligibleFilters(withMeta, [
            { columnId: 'category', kind: 'dropdown', values: ['STAFF'] },
        ]);
        expect(categoryOnly.map((r) => r.fullName)).toEqual(['Grace Hopper']);

        const statusOnly = applyCertificateEligibleFilters(withMeta, [
            { columnId: 'status', kind: 'dropdown', values: ['NOT_ISSUED'] },
        ]);
        expect(statusOnly.map((r) => r.fullName)).toEqual(['Ada Lovelace']);
    });

    it('skips days/sessions attendance filters for STAFF but still filters ATTENDEE', () => {
        const mixed: CertificateEligibleRow[] = [
            {
                fullName: 'Attendee Zero',
                email: 'zero@example.com',
                type: 'ATTENDANCE',
                category: 'ATTENDEE',
                attendanceDaysCount: 0,
                sessionsAttendedCount: 0,
                alreadyIssued: false,
            },
            {
                fullName: 'Staff Lead',
                email: 'lead@example.com',
                type: 'LEADERSHIP',
                category: 'STAFF',
                alreadyIssued: false,
            },
            {
                fullName: 'Attendee Two',
                email: 'two@example.com',
                type: 'ATTENDANCE',
                category: 'ATTENDEE',
                attendanceDaysCount: 2,
                sessionsAttendedCount: 1,
                alreadyIssued: false,
            },
        ];

        const daysFilter: CertificateEligibleFilter[] = [
            { columnId: 'attendanceDaysCount', kind: 'number', operator: 'greaterThan', value: 0 },
        ];
        expect(applyCertificateEligibleFilters(mixed, daysFilter).map((r) => r.fullName)).toEqual([
            'Staff Lead',
            'Attendee Two',
        ]);

        const sessionsFilter: CertificateEligibleFilter[] = [
            { columnId: 'sessionsAttendedCount', kind: 'number', operator: 'greaterThan', value: 0 },
        ];
        expect(applyCertificateEligibleFilters(mixed, sessionsFilter).map((r) => r.fullName)).toEqual([
            'Staff Lead',
            'Attendee Two',
        ]);
    });

    it('filters idSet includesAll / includesAny for specific days and sessions', () => {
        const mixed: CertificateEligibleRow[] = [
            {
                fullName: 'Day Both',
                email: 'both@example.com',
                type: 'ATTENDANCE',
                category: 'ATTENDEE',
                attendedDays: ['2026-07-01', '2026-07-02'],
                attendedSessionIds: [10, 20],
                alreadyIssued: false,
            },
            {
                fullName: 'Day One',
                email: 'one@example.com',
                type: 'ATTENDANCE',
                category: 'ATTENDEE',
                attendedDays: ['2026-07-01'],
                attendedSessionIds: [10],
                alreadyIssued: false,
            },
            {
                fullName: 'Staff Lead',
                email: 'lead@example.com',
                type: 'LEADERSHIP',
                category: 'STAFF',
                alreadyIssued: false,
            },
        ];

        const allDays: CertificateEligibleFilter[] = [
            {
                columnId: 'attendedDays',
                kind: 'idSet',
                operator: 'includesAll',
                values: ['2026-07-01', '2026-07-02'],
            },
        ];
        expect(applyCertificateEligibleFilters(mixed, allDays).map((r) => r.fullName)).toEqual([
            'Day Both',
            'Staff Lead',
        ]);

        const anySession: CertificateEligibleFilter[] = [
            {
                columnId: 'attendedSessionIds',
                kind: 'idSet',
                operator: 'includesAny',
                values: ['20', '99'],
            },
        ];
        expect(applyCertificateEligibleFilters(mixed, anySession).map((r) => r.fullName)).toEqual([
            'Day Both',
            'Staff Lead',
        ]);

        const allSessions: CertificateEligibleFilter[] = [
            {
                columnId: 'attendedSessionIds',
                kind: 'idSet',
                operator: 'includesAll',
                values: ['10', '20'],
            },
        ];
        expect(applyCertificateEligibleFilters(mixed, allSessions).map((r) => r.fullName)).toEqual([
            'Day Both',
            'Staff Lead',
        ]);
    });
});
