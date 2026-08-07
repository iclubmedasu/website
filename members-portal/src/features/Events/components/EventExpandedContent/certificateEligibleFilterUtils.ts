export type CertificateEligibleColumnKind = 'text' | 'number' | 'dropdown' | 'checkbox' | 'idSet';

export type TextFilterOperator = 'contains' | 'equals' | 'isEmpty';
export type NumberFilterOperator = 'equals' | 'greaterThan' | 'lessThan' | 'isEmpty';
export type IdSetFilterOperator = 'includesAll' | 'includesAny';
export type CheckboxFilterValue = 'yes' | 'no' | 'any';
export type SortDirection = 'asc' | 'desc';

export type CertificateRowStatus = 'NOT_ISSUED' | 'ISSUED' | 'REVOKED';

export interface CertificateEligibleColumn {
    id: string;
    label: string;
    kind: CertificateEligibleColumnKind;
    options?: string[];
    /** Display labels keyed by option value (ISO day or session id string). */
    optionLabels?: Record<string, string>;
}

export type CertificateEligibleFilter =
    | { columnId: string; kind: 'text'; operator: TextFilterOperator; value?: string }
    | { columnId: string; kind: 'number'; operator: NumberFilterOperator; value?: number }
    | { columnId: string; kind: 'dropdown'; values: string[] }
    | { columnId: string; kind: 'checkbox'; value: CheckboxFilterValue }
    | { columnId: string; kind: 'idSet'; operator: IdSetFilterOperator; values: string[] };

export interface CertificateEligibleSortSpec {
    columnId: string;
    direction: SortDirection;
}

export interface CertificateIssueDateRange {
    dateFrom: string;
    dateTo: string;
}

export const EMPTY_CERTIFICATE_ISSUE_DATE_RANGE: CertificateIssueDateRange = {
    dateFrom: '',
    dateTo: '',
};

/** Minimal row shape shared by event and project unified certificate tables. */
export interface CertificateEligibleRow {
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    type: string;
    category?: 'ATTENDEE' | 'STAFF' | string;
    status?: CertificateRowStatus | string;
    alreadyIssued: boolean;
    attendanceDaysCount?: number;
    sessionsAttendedCount?: number;
    attendedDays?: string[];
    attendedSessionIds?: number[];
    totalAttendanceMinutes?: number;
    wasVirtuallyCapped?: boolean;
    sessionDurationMinutes?: Record<string, number>;
    taskCount?: number;
    /** ISO date string used for issue-date range filtering */
    issueDate?: string | null;
}

export const EVENT_ELIGIBLE_COLUMNS: CertificateEligibleColumn[] = [
    { id: 'fullName', label: 'Name', kind: 'text' },
    { id: 'email', label: 'Email', kind: 'text' },
    { id: 'phoneNumber', label: 'Phone', kind: 'text' },
    {
        id: 'category',
        label: 'Category',
        kind: 'dropdown',
        options: ['ATTENDEE', 'STAFF'],
    },
    {
        id: 'type',
        label: 'Type',
        kind: 'dropdown',
        options: [
            'ATTENDANCE',
            'LEADERSHIP',
            'ORGANIZATION',
            'ADMINISTRATION',
            'SUPERVISION',
            'PARTICIPATION',
            'CUSTOM',
        ],
    },
    { id: 'attendanceDaysCount', label: 'Days attended', kind: 'number' },
    { id: 'sessionsAttendedCount', label: 'Sessions attended', kind: 'number' },
    { id: 'totalAttendanceMinutes', label: 'Minutes attended', kind: 'number' },
    {
        id: 'status',
        label: 'Status',
        kind: 'dropdown',
        options: ['NOT_ISSUED', 'ISSUED', 'REVOKED'],
    },
];

export const PROJECT_ELIGIBLE_COLUMNS: CertificateEligibleColumn[] = [
    { id: 'fullName', label: 'Name', kind: 'text' },
    { id: 'email', label: 'Email', kind: 'text' },
    { id: 'phoneNumber', label: 'Phone', kind: 'text' },
    {
        id: 'type',
        label: 'Type',
        kind: 'dropdown',
        options: [
            'LEADERSHIP',
            'CONTRIBUTION',
            'ADMINISTRATION',
            'SUPERVISION',
            'PARTICIPATION',
            'CUSTOM',
        ],
    },
    { id: 'taskCount', label: 'Tasks', kind: 'number' },
    {
        id: 'status',
        label: 'Status',
        kind: 'dropdown',
        options: ['NOT_ISSUED', 'ISSUED', 'REVOKED'],
    },
];

export const DEFAULT_CERTIFICATE_ELIGIBLE_SORT: CertificateEligibleSortSpec = {
    columnId: 'fullName',
    direction: 'asc',
};

export function getDefaultCertificateEligibleSort(
    columns: CertificateEligibleColumn[],
): CertificateEligibleSortSpec {
    const first = columns.find((column) => column.id === 'fullName') ?? columns[0];
    return {
        columnId: first?.id ?? 'fullName',
        direction: 'asc',
    };
}

export function normalizeCertificateEligibleSort(
    sortSpec: CertificateEligibleSortSpec,
    columns: CertificateEligibleColumn[],
): CertificateEligibleSortSpec {
    if (columns.some((column) => column.id === sortSpec.columnId)) return sortSpec;
    return getDefaultCertificateEligibleSort(columns);
}

export function createDefaultCertificateEligibleFilter(
    column: CertificateEligibleColumn,
): CertificateEligibleFilter {
    switch (column.kind) {
        case 'text':
            return { columnId: column.id, kind: 'text', operator: 'contains', value: '' };
        case 'number':
            return { columnId: column.id, kind: 'number', operator: 'equals', value: 0 };
        case 'dropdown':
            return { columnId: column.id, kind: 'dropdown', values: [] };
        case 'checkbox':
            return { columnId: column.id, kind: 'checkbox', value: 'any' };
        case 'idSet':
            return { columnId: column.id, kind: 'idSet', operator: 'includesAll', values: [] };
        default:
            return { columnId: column.id, kind: 'text', operator: 'contains', value: '' };
    }
}

function compareStrings(left: string, right: string, direction: SortDirection): number {
    const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? result : -result;
}

function compareNumbers(left: number, right: number, direction: SortDirection): number {
    const result = left - right;
    return direction === 'asc' ? result : -result;
}

function compareBooleans(left: boolean, right: boolean, direction: SortDirection): number {
    return compareNumbers(left ? 1 : 0, right ? 1 : 0, direction);
}

function matchesTextFilter(
    value: string,
    filter: Extract<CertificateEligibleFilter, { kind: 'text' }>,
): boolean {
    const normalized = value.trim();
    if (filter.operator === 'isEmpty') return normalized.length === 0;
    const needle = (filter.value ?? '').trim().toLowerCase();
    const haystack = normalized.toLowerCase();
    if (filter.operator === 'equals') return haystack === needle;
    return haystack.includes(needle);
}

function matchesNumberFilter(
    value: number | null,
    filter: Extract<CertificateEligibleFilter, { kind: 'number' }>,
): boolean {
    if (filter.operator === 'isEmpty') return value === null || Number.isNaN(value);
    if (value === null || Number.isNaN(value)) return false;
    if (filter.operator === 'equals') return value === filter.value;
    if (filter.operator === 'greaterThan') return value > (filter.value ?? 0);
    return value < (filter.value ?? 0);
}

function rowStatus(row: CertificateEligibleRow): string {
    if (row.status) return row.status;
    return row.alreadyIssued ? 'ISSUED' : 'NOT_ISSUED';
}

function getTextValue(row: CertificateEligibleRow, columnId: string): string {
    if (columnId === 'fullName') return row.fullName || '';
    if (columnId === 'email') return row.email || '';
    if (columnId === 'phoneNumber') return row.phoneNumber || '';
    if (columnId === 'type') return row.type || '';
    if (columnId === 'category') return row.category || '';
    if (columnId === 'status') return rowStatus(row);
    return '';
}

function getNumberValue(row: CertificateEligibleRow, columnId: string): number | null {
    if (columnId === 'attendanceDaysCount') {
        return row.attendanceDaysCount === undefined ? null : row.attendanceDaysCount;
    }
    if (columnId === 'sessionsAttendedCount') {
        return row.sessionsAttendedCount === undefined ? null : row.sessionsAttendedCount;
    }
    if (columnId === 'totalAttendanceMinutes') {
        return row.totalAttendanceMinutes === undefined ? null : row.totalAttendanceMinutes;
    }
    if (columnId === 'taskCount') {
        return row.taskCount === undefined ? null : row.taskCount;
    }
    return null;
}

function getIdSetValues(row: CertificateEligibleRow, columnId: string): string[] {
    if (columnId === 'attendedDays') {
        return row.attendedDays ?? [];
    }
    if (columnId === 'attendedSessionIds') {
        return (row.attendedSessionIds ?? []).map((id) => String(id));
    }
    return [];
}

function isAttendanceIdentityColumn(columnId: string): boolean {
    return columnId === 'attendanceDaysCount'
        || columnId === 'sessionsAttendedCount'
        || columnId === 'totalAttendanceMinutes'
        || columnId === 'attendedDays'
        || columnId === 'attendedSessionIds';
}

function matchesIdSetFilter(
    values: string[],
    filter: Extract<CertificateEligibleFilter, { kind: 'idSet' }>,
): boolean {
    if (filter.values.length === 0) return true;
    if (filter.operator === 'includesAny') {
        return filter.values.some((value) => values.includes(value));
    }
    return filter.values.every((value) => values.includes(value));
}

function getDropdownValue(row: CertificateEligibleRow, columnId: string): string {
    if (columnId === 'category') return row.category || '';
    if (columnId === 'status') return rowStatus(row);
    return row.type || '';
}

function matchesFilter(row: CertificateEligibleRow, filter: CertificateEligibleFilter): boolean {
    switch (filter.kind) {
        case 'text':
            return matchesTextFilter(getTextValue(row, filter.columnId), filter);
        case 'number': {
            // Staff are not measured by day/session attendance — skip those rules.
            if (isAttendanceIdentityColumn(filter.columnId) && row.category === 'STAFF') {
                return true;
            }
            return matchesNumberFilter(getNumberValue(row, filter.columnId), filter);
        }
        case 'dropdown': {
            if (filter.values.length === 0) return true;
            return filter.values.includes(getDropdownValue(row, filter.columnId));
        }
        case 'checkbox': {
            if (filter.value === 'any') return true;
            if (filter.value === 'yes') return row.alreadyIssued;
            return !row.alreadyIssued;
        }
        case 'idSet': {
            // Staff are not measured by day/session attendance — skip those rules.
            if (isAttendanceIdentityColumn(filter.columnId) && row.category === 'STAFF') {
                return true;
            }
            return matchesIdSetFilter(getIdSetValues(row, filter.columnId), filter);
        }
        default:
            return true;
    }
}

export function applyCertificateEligibleTextSearch<T extends CertificateEligibleRow>(
    rows: T[],
    query: string,
): T[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) => (
        row.fullName.toLowerCase().includes(trimmed)
        || row.email.toLowerCase().includes(trimmed)
        || (row.phoneNumber || '').toLowerCase().includes(trimmed)
        || row.type.toLowerCase().includes(trimmed)
        || rowStatus(row).toLowerCase().includes(trimmed)
    ));
}

export function applyCertificateEligibleFilters<T extends CertificateEligibleRow>(
    rows: T[],
    filters: CertificateEligibleFilter[],
): T[] {
    if (filters.length === 0) return rows;
    return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

function getSortValue(
    row: CertificateEligibleRow,
    columnId: string,
): string | number | boolean | null {
    if (columnId === 'fullName') return row.fullName || '';
    if (columnId === 'email') return row.email || '';
    if (columnId === 'phoneNumber') return row.phoneNumber || '';
    if (columnId === 'type') return row.type || '';
    if (columnId === 'category') return row.category || '';
    if (columnId === 'status') return rowStatus(row);
    if (columnId === 'alreadyIssued') return row.alreadyIssued;
    if (columnId === 'issueDate') return row.issueDate || '';
    if (columnId === 'attendanceDaysCount') {
        return row.attendanceDaysCount === undefined ? null : row.attendanceDaysCount;
    }
    if (columnId === 'sessionsAttendedCount') {
        return row.sessionsAttendedCount === undefined ? null : row.sessionsAttendedCount;
    }
    if (columnId === 'totalAttendanceMinutes') {
        return row.totalAttendanceMinutes === undefined ? null : row.totalAttendanceMinutes;
    }
    if (columnId === 'taskCount') {
        return row.taskCount === undefined ? null : row.taskCount;
    }
    return '';
}

export function sortCertificateEligibleRows<T extends CertificateEligibleRow>(
    rows: T[],
    sortSpec: CertificateEligibleSortSpec,
): T[] {
    const direction = sortSpec.direction;
    const sorted = [...rows];

    sorted.sort((left, right) => {
        const leftValue = getSortValue(left, sortSpec.columnId);
        const rightValue = getSortValue(right, sortSpec.columnId);

        if (leftValue === null && rightValue === null) return 0;
        if (leftValue === null) return direction === 'asc' ? 1 : -1;
        if (rightValue === null) return direction === 'asc' ? -1 : 1;

        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            return compareNumbers(leftValue, rightValue, direction);
        }
        if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
            return compareBooleans(leftValue, rightValue, direction);
        }

        return compareStrings(String(leftValue), String(rightValue), direction);
    });

    return sorted;
}

export function applyCertificateIssueDateRange<T extends CertificateEligibleRow>(
    rows: T[],
    range: CertificateIssueDateRange,
    isDateWithinRange: (value: string | null | undefined, from: string, to: string) => boolean,
): T[] {
    if (!range.dateFrom && !range.dateTo) return rows;
    return rows.filter((row) => isDateWithinRange(row.issueDate, range.dateFrom, range.dateTo));
}

/** Pipeline: search → filters → issue-date range → sort. */
export function processCertificateEligibleRows<T extends CertificateEligibleRow>(
    rows: T[],
    search: string,
    filters: CertificateEligibleFilter[],
    sortSpec: CertificateEligibleSortSpec,
    issueDateRange: CertificateIssueDateRange = EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    isDateWithinRange?: (value: string | null | undefined, from: string, to: string) => boolean,
): T[] {
    const searched = applyCertificateEligibleTextSearch(rows, search);
    const filtered = applyCertificateEligibleFilters(searched, filters);
    const dated = isDateWithinRange
        ? applyCertificateIssueDateRange(filtered, issueDateRange, isDateWithinRange)
        : filtered;
    return sortCertificateEligibleRows(dated, sortSpec);
}

export function describeCertificateEligibleFilter(
    filter: CertificateEligibleFilter,
    columns: CertificateEligibleColumn[],
): string {
    const column = columns.find((entry) => entry.id === filter.columnId);
    const label = column?.label ?? filter.columnId;

    switch (filter.kind) {
        case 'text': {
            if (filter.operator === 'isEmpty') return `${label} is empty`;
            if (filter.operator === 'equals') return `${label} = ${filter.value || '""'}`;
            return `${label} contains "${filter.value ?? ''}"`;
        }
        case 'number': {
            if (filter.operator === 'isEmpty') return `${label} is empty`;
            if (filter.operator === 'equals') return `${label} = ${filter.value ?? 0}`;
            if (filter.operator === 'greaterThan') return `${label} > ${filter.value ?? 0}`;
            return `${label} < ${filter.value ?? 0}`;
        }
        case 'dropdown':
            return `${label} = ${filter.values.length > 0 ? filter.values.join(', ') : 'any'}`;
        case 'checkbox':
            return `${label} = ${filter.value === 'any' ? 'Any' : filter.value === 'yes' ? 'Yes' : 'No'}`;
        case 'idSet': {
            const displayValues = filter.values.map((value) => (
                column?.optionLabels?.[value] ?? value
            ));
            const joined = displayValues.length > 0 ? displayValues.join(', ') : 'none';
            if (filter.operator === 'includesAny') {
                return `${label} includes any of ${joined}`;
            }
            return `${label} includes all of ${joined}`;
        }
        default:
            return label;
    }
}

export function isCertificateEligibleFilterComplete(
    filter: CertificateEligibleFilter,
    columns: CertificateEligibleColumn[],
): boolean {
    const column = columns.find((entry) => entry.id === filter.columnId);
    if (!column) return false;

    switch (filter.kind) {
        case 'text':
            if (filter.operator === 'isEmpty') return true;
            return Boolean(filter.value?.trim());
        case 'number':
            if (filter.operator === 'isEmpty') return true;
            return filter.value !== undefined && !Number.isNaN(filter.value);
        case 'dropdown':
            return filter.values.length > 0;
        case 'checkbox':
            return filter.value !== 'any';
        case 'idSet':
            return filter.values.length > 0;
        default:
            return false;
    }
}

export function isCertificateEligibleFunnelActive(
    filters: CertificateEligibleFilter[],
    sortSpec: CertificateEligibleSortSpec,
    defaultSort: CertificateEligibleSortSpec = DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
    issueDateRange: CertificateIssueDateRange = EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
): boolean {
    return filters.length > 0
        || Boolean(issueDateRange.dateFrom || issueDateRange.dateTo)
        || sortSpec.columnId !== defaultSort.columnId
        || sortSpec.direction !== defaultSort.direction;
}
