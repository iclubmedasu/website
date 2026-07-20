import type {
    EventCustomFieldRef,
    EventRegistrationRef,
    EventSessionRef,
    EventTierRef,
} from '@/types/backend-contracts';
import {
    dropdownOptions,
    formatReminderEmailStatus,
    formatTicketEmailStatus,
    getCustomFieldValue,
    isCustomFieldValueEmpty,
} from './customFieldUtils';

export type RegistrationTableKind = 'registrations' | 'tickets';

export type RegistrationColumnKind =
    | 'text'
    | 'number'
    | 'date'
    | 'dropdown'
    | 'checkbox'
    | 'tier'
    | 'sessions'
    | 'ticketStatus'
    | 'reminderStatus'
    | 'attendance';

export interface FilterableColumn {
    id: string;
    label: string;
    kind: RegistrationColumnKind;
    options?: string[];
}

export type TextFilterOperator = 'contains' | 'equals' | 'isEmpty';
export type NumberFilterOperator = 'equals' | 'greaterThan' | 'lessThan' | 'isEmpty';
export type SessionsFilterOperator = 'includes' | 'hasNone';
export type AttendanceFilterOperator = 'hasAny' | 'hasNone' | 'countEquals' | 'countGreaterThan' | 'countLessThan';
export type EmailStatusFilterValue = 'sent' | 'notSent';
export type CheckboxFilterValue = 'yes' | 'no' | 'any';

export type RegistrationColumnFilter =
    | { columnId: string; kind: 'text'; operator: TextFilterOperator; value?: string }
    | { columnId: string; kind: 'number'; operator: NumberFilterOperator; value?: number }
    | { columnId: string; kind: 'dropdown'; values: string[] }
    | { columnId: string; kind: 'checkbox'; value: CheckboxFilterValue }
    | { columnId: string; kind: 'tier'; tierId: string }
    | { columnId: string; kind: 'sessions'; operator: SessionsFilterOperator; sessionId?: string }
    | { columnId: string; kind: 'ticketStatus' | 'reminderStatus'; value: EmailStatusFilterValue }
    | { columnId: string; kind: 'attendance'; operator: AttendanceFilterOperator; value?: number };

export type SortDirection = 'asc' | 'desc';

export interface RegistrationSortSpec {
    columnId: string;
    direction: SortDirection;
}

export interface RegistrationTableContext {
    tableKind: RegistrationTableKind;
    fields: EventCustomFieldRef[];
    tiers: EventTierRef[];
    sessions: EventSessionRef[];
    multiDayEvent: boolean;
}

const CUSTOM_FIELD_PREFIX = 'custom:';

function activeCustomFields(fields: EventCustomFieldRef[]): EventCustomFieldRef[] {
    return fields.filter((field) => field.isActive !== false);
}

function customFieldColumnKind(field: EventCustomFieldRef): RegistrationColumnKind {
    if (field.type === 'number') return 'number';
    if (field.type === 'dropdown') return 'dropdown';
    if (field.type === 'checkbox') return 'checkbox';
    return 'text';
}

function customFieldColumnId(field: EventCustomFieldRef): string {
    return `${CUSTOM_FIELD_PREFIX}${field.id}`;
}

function findCustomFieldByColumnId(
    columnId: string,
    fields: EventCustomFieldRef[],
): EventCustomFieldRef | undefined {
    if (!columnId?.startsWith(CUSTOM_FIELD_PREFIX)) return undefined;
    const fieldId = columnId.slice(CUSTOM_FIELD_PREFIX.length);
    return fields.find((field) => String(field.id) === fieldId);
}

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

function getRegistrationSessionIds(registration: EventRegistrationRef): string[] {
    return (registration.sessionSelections ?? []).map((selection) => String(selection.sessionId));
}

function getRegistrationSessionLabels(
    registration: EventRegistrationRef,
    sessions: EventSessionRef[],
): string[] {
    const sessionById = new Map(sessions.map((session) => [String(session.id), session]));
    return getRegistrationSessionIds(registration)
        .map((sessionId) => {
            const session = sessionById.get(sessionId);
            if (session) return getSessionTitle(session);
            const selection = registration.sessionSelections?.find(
                (entry) => String(entry.sessionId) === sessionId,
            );
            return selection?.label?.trim() || 'Untitled session';
        })
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
}

function getTierName(registration: EventRegistrationRef, tiers: EventTierRef[]): string {
    if (registration.tier?.name) return registration.tier.name;
    if (registration.tierId == null) return '';
    const tier = tiers.find((entry) => String(entry.id) === String(registration.tierId));
    return tier?.name ?? '';
}

function isCheckboxYes(field: EventCustomFieldRef, registration: EventRegistrationRef): boolean {
    const value = getCustomFieldValue(registration, field);
    return !isCustomFieldValueEmpty(field, value);
}

function getAttendanceCount(registration: EventRegistrationRef): number {
    const dayCount = registration.attendanceDays?.length ?? 0;
    const sessionCount = registration.sessionAttendances?.length ?? 0;
    return dayCount + sessionCount;
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
    const leftValue = left ? 1 : 0;
    const rightValue = right ? 1 : 0;
    return compareNumbers(leftValue, rightValue, direction);
}

export function buildFilterableColumns(
    tableKind: RegistrationTableKind,
    fields: EventCustomFieldRef[],
    tiers: EventTierRef[],
    sessions: EventSessionRef[],
    multiDayEvent: boolean,
): FilterableColumn[] {
    const columns: FilterableColumn[] = [
        { id: 'fullName', label: 'Name', kind: 'text' },
        { id: 'email', label: 'Email', kind: 'text' },
        { id: 'phoneNumber', label: 'Phone', kind: 'text' },
    ];

    if (tableKind === 'registrations') {
        columns.push(
            { id: 'confirmationCode', label: 'Code', kind: 'text' },
            { id: 'createdAt', label: 'Registered', kind: 'date' },
        );
    }

    if (tableKind === 'tickets') {
        columns.push(
            { id: 'ticketStatus', label: 'Ticket status', kind: 'ticketStatus' },
            { id: 'reminderStatus', label: 'Reminder status', kind: 'reminderStatus' },
        );
    }

    if (sessions.length > 0) {
        columns.push({ id: 'sessions', label: 'Sessions', kind: 'sessions' });
    }

    if (tiers.length > 0) {
        columns.push({ id: 'tier', label: 'Tier', kind: 'tier' });
    }

    for (const field of activeCustomFields(fields)) {
        columns.push({
            id: customFieldColumnId(field),
            label: field.label,
            kind: customFieldColumnKind(field),
            options: field.type === 'dropdown' ? dropdownOptions(field) : undefined,
        });
    }

    if (multiDayEvent) {
        columns.push({ id: 'attendance', label: 'Attendance', kind: 'attendance' });
    }

    return columns;
}

export function getDefaultSortSpec(columns: FilterableColumn[]): RegistrationSortSpec {
    const firstColumn = columns.find((column) => column.id === 'fullName') ?? columns[0];
    return {
        columnId: firstColumn?.id ?? 'fullName',
        direction: 'asc',
    };
}

export function normalizeSortSpec(
    sortSpec: RegistrationSortSpec,
    columns: FilterableColumn[],
): RegistrationSortSpec {
    const valid = columns.some((column) => column.id === sortSpec.columnId);
    if (valid) return sortSpec;
    return getDefaultSortSpec(columns);
}

export function applyRegistrationTextSearch(
    rows: EventRegistrationRef[],
    query: string,
): EventRegistrationRef[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;

    const normalizedQuery = trimmed.replace(/[\s\-()]/g, '');
    return rows.filter((registration) => [
        registration.fullName,
        registration.email,
        registration.confirmationCode,
        registration.phoneNumber,
    ].some((value) => {
        const text = String(value || '').toLowerCase();
        if (text.includes(trimmed)) return true;
        if (registration.phoneNumber) {
            return text.replace(/[\s\-()]/g, '').includes(normalizedQuery);
        }
        return false;
    }));
}

function matchesTextFilter(value: string, filter: Extract<RegistrationColumnFilter, { kind: 'text' }>): boolean {
    const normalized = value.trim();
    if (filter.operator === 'isEmpty') return normalized.length === 0;
    const needle = (filter.value ?? '').trim().toLowerCase();
    const haystack = normalized.toLowerCase();
    if (filter.operator === 'equals') return haystack === needle;
    return haystack.includes(needle);
}

function matchesNumberFilter(
    value: number | null,
    filter: Extract<RegistrationColumnFilter, { kind: 'number' }>,
): boolean {
    if (filter.operator === 'isEmpty') return value === null || Number.isNaN(value);
    if (value === null || Number.isNaN(value)) return false;
    if (filter.operator === 'equals') return value === filter.value;
    if (filter.operator === 'greaterThan') return value > (filter.value ?? 0);
    return value < (filter.value ?? 0);
}

function matchesCheckboxFilter(
    field: EventCustomFieldRef,
    registration: EventRegistrationRef,
    filter: Extract<RegistrationColumnFilter, { kind: 'checkbox' }>,
): boolean {
    const isYes = isCheckboxYes(field, registration);
    if (filter.value === 'any') return true;
    if (filter.value === 'yes') return isYes;
    return !isYes;
}

function matchesFilter(
    registration: EventRegistrationRef,
    filter: RegistrationColumnFilter,
    context: RegistrationTableContext,
): boolean {
    const column = buildFilterableColumns(
        context.tableKind,
        context.fields,
        context.tiers,
        context.sessions,
        context.multiDayEvent,
    ).find((entry) => entry.id === filter.columnId);

    if (!column) return true;

    switch (filter.kind) {
        case 'text': {
            let value = '';
            if (filter.columnId === 'fullName') value = registration.fullName || '';
            else if (filter.columnId === 'email') value = registration.email || '';
            else if (filter.columnId === 'phoneNumber') value = registration.phoneNumber || '';
            else if (filter.columnId === 'confirmationCode') value = registration.confirmationCode || '';
            else {
                const field = findCustomFieldByColumnId(filter.columnId, context.fields);
                if (!field) return true;
                const raw = getCustomFieldValue(registration, field);
                value = raw == null ? '' : String(raw);
            }
            return matchesTextFilter(value, filter);
        }
        case 'number': {
            const field = findCustomFieldByColumnId(filter.columnId, context.fields);
            if (!field) return true;
            const raw = getCustomFieldValue(registration, field);
            const numeric = raw === null || raw === undefined || raw === ''
                ? null
                : Number(raw);
            return matchesNumberFilter(numeric, filter);
        }
        case 'dropdown': {
            const field = findCustomFieldByColumnId(filter.columnId, context.fields);
            if (!field || filter.values.length === 0) return true;
            const raw = getCustomFieldValue(registration, field);
            const value = raw == null || raw === '' ? '' : String(raw);
            return filter.values.includes(value);
        }
        case 'checkbox': {
            const field = findCustomFieldByColumnId(filter.columnId, context.fields);
            if (!field) return true;
            return matchesCheckboxFilter(field, registration, filter);
        }
        case 'tier':
            return String(registration.tierId ?? '') === filter.tierId;
        case 'sessions': {
            const sessionIds = getRegistrationSessionIds(registration);
            if (filter.operator === 'hasNone') return sessionIds.length === 0;
            if (!filter.sessionId) return true;
            return sessionIds.includes(filter.sessionId);
        }
        case 'ticketStatus': {
            const sent = formatTicketEmailStatus(registration).sent;
            return filter.value === 'sent' ? sent : !sent;
        }
        case 'reminderStatus': {
            const sent = formatReminderEmailStatus(registration).sent;
            return filter.value === 'sent' ? sent : !sent;
        }
        case 'attendance': {
            const count = getAttendanceCount(registration);
            if (filter.operator === 'hasAny') return count > 0;
            if (filter.operator === 'hasNone') return count === 0;
            if (filter.operator === 'countEquals') return count === (filter.value ?? 0);
            if (filter.operator === 'countGreaterThan') return count > (filter.value ?? 0);
            return count < (filter.value ?? 0);
        }
        default:
            return true;
    }
}

export function applyRegistrationColumnFilters(
    rows: EventRegistrationRef[],
    filters: RegistrationColumnFilter[],
    context: RegistrationTableContext,
): EventRegistrationRef[] {
    if (filters.length === 0) return rows;
    return rows.filter((registration) => filters.every((filter) => matchesFilter(registration, filter, context)));
}

function getSortValue(
    registration: EventRegistrationRef,
    columnId: string,
    context: RegistrationTableContext,
): string | number | boolean | Date | null {
    if (columnId === 'fullName') return registration.fullName || '';
    if (columnId === 'email') return registration.email || '';
    if (columnId === 'phoneNumber') return registration.phoneNumber || '';
    if (columnId === 'confirmationCode') return registration.confirmationCode || '';
    if (columnId === 'createdAt') return registration.createdAt ? new Date(registration.createdAt) : null;
    if (columnId === 'tier') return getTierName(registration, context.tiers);
    if (columnId === 'sessions') {
        return getRegistrationSessionLabels(registration, context.sessions).join(', ');
    }
    if (columnId === 'ticketStatus') return formatTicketEmailStatus(registration).sent;
    if (columnId === 'reminderStatus') return formatReminderEmailStatus(registration).sent;
    if (columnId === 'attendance') return getAttendanceCount(registration);

    const field = findCustomFieldByColumnId(columnId, context.fields);
    if (!field) return '';

    if (field.type === 'number') {
        const raw = getCustomFieldValue(registration, field);
        if (raw === null || raw === undefined || raw === '') return null;
        return Number(raw);
    }
    if (field.type === 'checkbox') {
        return isCheckboxYes(field, registration);
    }
    if (field.type === 'dropdown') {
        const raw = getCustomFieldValue(registration, field);
        return raw == null || raw === '' ? '' : String(raw);
    }

    const raw = getCustomFieldValue(registration, field);
    return raw == null ? '' : String(raw);
}

export function sortRegistrations(
    rows: EventRegistrationRef[],
    sortSpec: RegistrationSortSpec,
    context: RegistrationTableContext,
): EventRegistrationRef[] {
    const direction = sortSpec.direction;
    const sorted = [...rows];

    sorted.sort((left, right) => {
        const leftValue = getSortValue(left, sortSpec.columnId, context);
        const rightValue = getSortValue(right, sortSpec.columnId, context);

        if (leftValue === null && rightValue === null) return 0;
        if (leftValue === null) return direction === 'asc' ? 1 : -1;
        if (rightValue === null) return direction === 'asc' ? -1 : 1;

        if (leftValue instanceof Date && rightValue instanceof Date) {
            return compareNumbers(leftValue.getTime(), rightValue.getTime(), direction);
        }
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

export function createDefaultFilterForColumn(
    column: FilterableColumn,
): RegistrationColumnFilter {
    switch (column.kind) {
        case 'text':
            return { columnId: column.id, kind: 'text', operator: 'contains', value: '' };
        case 'number':
            return { columnId: column.id, kind: 'number', operator: 'equals', value: 0 };
        case 'dropdown':
            return { columnId: column.id, kind: 'dropdown', values: [] };
        case 'checkbox':
            return { columnId: column.id, kind: 'checkbox', value: 'any' };
        case 'tier':
            return { columnId: column.id, kind: 'tier', tierId: '' };
        case 'sessions':
            return { columnId: column.id, kind: 'sessions', operator: 'includes', sessionId: '' };
        case 'ticketStatus':
            return { columnId: column.id, kind: 'ticketStatus', value: 'sent' };
        case 'reminderStatus':
            return { columnId: column.id, kind: 'reminderStatus', value: 'sent' };
        case 'attendance':
            return { columnId: column.id, kind: 'attendance', operator: 'hasAny' };
        case 'date':
            return { columnId: column.id, kind: 'text', operator: 'contains', value: '' };
        default:
            return { columnId: column.id, kind: 'text', operator: 'contains', value: '' };
    }
}

function describeTextFilter(filter: Extract<RegistrationColumnFilter, { kind: 'text' }>, label: string): string {
    if (filter.operator === 'isEmpty') return `${label} is empty`;
    if (filter.operator === 'equals') return `${label} = ${filter.value || '""'}`;
    return `${label} contains "${filter.value ?? ''}"`;
}

function describeNumberFilter(
    filter: Extract<RegistrationColumnFilter, { kind: 'number' }>,
    label: string,
): string {
    if (filter.operator === 'isEmpty') return `${label} is empty`;
    if (filter.operator === 'equals') return `${label} = ${filter.value ?? 0}`;
    if (filter.operator === 'greaterThan') return `${label} > ${filter.value ?? 0}`;
    return `${label} < ${filter.value ?? 0}`;
}

export function describeRegistrationFilter(
    filter: RegistrationColumnFilter,
    columns: FilterableColumn[],
    context: RegistrationTableContext,
): string {
    const column = columns.find((entry) => entry.id === filter.columnId);
    const label = column?.label ?? filter.columnId;

    switch (filter.kind) {
        case 'text':
            return describeTextFilter(filter, label);
        case 'number':
            return describeNumberFilter(filter, label);
        case 'dropdown':
            return `${label} = ${filter.values.length > 0 ? filter.values.join(', ') : 'any'}`;
        case 'checkbox':
            return `${label} = ${filter.value === 'any' ? 'Any' : filter.value === 'yes' ? 'Yes' : 'No'}`;
        case 'tier': {
            const tier = context.tiers.find((entry) => String(entry.id) === filter.tierId);
            return `${label} = ${tier?.name ?? 'Unknown tier'}`;
        }
        case 'sessions': {
            if (filter.operator === 'hasNone') return `${label} has none`;
            const session = context.sessions.find((entry) => String(entry.id) === filter.sessionId);
            return `${label} includes ${session ? getSessionTitle(session) : 'session'}`;
        }
        case 'ticketStatus':
            return `${label} = ${filter.value === 'sent' ? 'Sent' : 'Not sent'}`;
        case 'reminderStatus':
            return `${label} = ${filter.value === 'sent' ? 'Sent' : 'Not sent'}`;
        case 'attendance': {
            if (filter.operator === 'hasAny') return `${label} has attendance`;
            if (filter.operator === 'hasNone') return `${label} has none`;
            if (filter.operator === 'countEquals') return `${label} count = ${filter.value ?? 0}`;
            if (filter.operator === 'countGreaterThan') return `${label} count > ${filter.value ?? 0}`;
            return `${label} count < ${filter.value ?? 0}`;
        }
        default:
            return label;
    }
}

export function isRegistrationFilterComplete(
    filter: RegistrationColumnFilter,
    columns: FilterableColumn[],
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
        case 'tier':
            return Boolean(filter.tierId);
        case 'sessions':
            if (filter.operator === 'hasNone') return true;
            return Boolean(filter.sessionId);
        case 'ticketStatus':
        case 'reminderStatus':
            return true;
        case 'attendance':
            if (filter.operator === 'hasAny' || filter.operator === 'hasNone') return true;
            return filter.value !== undefined && !Number.isNaN(filter.value);
        default:
            return false;
    }
}
