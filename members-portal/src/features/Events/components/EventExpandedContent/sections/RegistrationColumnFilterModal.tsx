import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { EventRegistrationSourceGroup, EventSessionRef, EventTierRef } from '@/types/backend-contracts';
import { REGISTRATION_SOURCE_GROUP_OPTIONS } from '../customFieldUtils';
import {
    createDefaultFilterForColumn,
    describeRegistrationFilter,
    isRegistrationFilterComplete,
    type FilterableColumn,
    type RegistrationColumnFilter,
    type RegistrationSortSpec,
    type RegistrationTableContext,
} from '../registrationTableFilterUtils';
import RegistrationTableSortControl from './RegistrationTableSortControl';

export const DEFAULT_REGISTRATION_SORT: RegistrationSortSpec = {
    columnId: 'fullName',
    direction: 'asc',
};

export type RegistrationServerFilters = {
    tierId: string;
    sourceGroup: EventRegistrationSourceGroup | '';
    checkInStatus: string;
    ticketStatus: '' | 'SENT' | 'NOT_SENT';
    reminderStatus: '' | 'SENT' | 'NOT_SENT';
};

export const EMPTY_REGISTRATION_SERVER_FILTERS: RegistrationServerFilters = {
    tierId: '',
    sourceGroup: '',
    checkInStatus: '',
    ticketStatus: '',
    reminderStatus: '',
};

export type RegistrationServerFilterConfig = {
    showTier?: boolean;
    showSource?: boolean;
    showCheckIn?: boolean;
    showTicketStatus?: boolean;
    showReminderStatus?: boolean;
    showCheckedInToday?: boolean;
};

interface RegistrationColumnFilterModalProps {
    open: boolean;
    columns: FilterableColumn[];
    activeFilters: RegistrationColumnFilter[];
    sortSpec: RegistrationSortSpec;
    serverFilters: RegistrationServerFilters;
    serverFilterConfig: RegistrationServerFilterConfig;
    context: RegistrationTableContext;
    tiers: EventTierRef[];
    sessions: EventSessionRef[];
    onClose: () => void;
    onApply: (
        filters: RegistrationColumnFilter[],
        sortSpec: RegistrationSortSpec,
        serverFilters: RegistrationServerFilters,
    ) => void;
    onClear: () => void;
}

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

function describeServerFilterChip(
    key: keyof RegistrationServerFilters,
    value: string,
    tiers: EventTierRef[],
): string | null {
    if (!value) return null;
    switch (key) {
        case 'tierId': {
            const tier = tiers.find((entry) => String(entry.id) === value);
            return `Tier: ${tier?.name ?? value}`;
        }
        case 'sourceGroup': {
            const option = REGISTRATION_SOURCE_GROUP_OPTIONS.find((entry) => entry.value === value);
            return option ? `Source: ${option.label}` : `Source: ${value}`;
        }
        case 'checkInStatus': {
            if (value === 'CHECKED_IN') return 'Check-in: Checked in';
            if (value === 'NOT_CHECKED_IN') return 'Check-in: Not checked in';
            if (value === 'CHECKED_IN_TODAY') return 'Check-in: Checked in today';
            return `Check-in: ${value}`;
        }
        case 'ticketStatus':
            return value === 'SENT' ? 'Ticket: Sent' : 'Ticket: Not sent';
        case 'reminderStatus':
            return value === 'SENT' ? 'Reminder: Sent' : 'Reminder: Not sent';
        default:
            return null;
    }
}

function hasAnyServerFilters(filters: RegistrationServerFilters): boolean {
    return Boolean(
        filters.tierId
        || filters.sourceGroup
        || filters.checkInStatus
        || filters.ticketStatus
        || filters.reminderStatus,
    );
}

function renderValueEditor(
    filter: RegistrationColumnFilter,
    column: FilterableColumn,
    tiers: EventTierRef[],
    sessions: EventSessionRef[],
    onChange: (next: RegistrationColumnFilter) => void,
) {
    switch (filter.kind) {
        case 'text':
            return (
                <>
                    <select
                        aria-label="Text filter operator"
                        className="form-input"
                        value={filter.operator}
                        onChange={(event) => onChange({
                            ...filter,
                            operator: event.target.value as typeof filter.operator,
                        })}
                    >
                        <option value="contains">Contains</option>
                        <option value="equals">Equals</option>
                        <option value="isEmpty">Is empty</option>
                    </select>
                    {filter.operator !== 'isEmpty' ? (
                        <input
                            aria-label="Text filter value"
                            className="form-input"
                            value={filter.value ?? ''}
                            onChange={(event) => onChange({ ...filter, value: event.target.value })}
                        />
                    ) : null}
                </>
            );
        case 'number':
            return (
                <>
                    <select
                        aria-label="Number filter operator"
                        className="form-input"
                        value={filter.operator}
                        onChange={(event) => onChange({
                            ...filter,
                            operator: event.target.value as typeof filter.operator,
                        })}
                    >
                        <option value="equals">Equals</option>
                        <option value="greaterThan">Greater than</option>
                        <option value="lessThan">Less than</option>
                        <option value="isEmpty">Is empty</option>
                    </select>
                    {filter.operator !== 'isEmpty' ? (
                        <input
                            aria-label="Number filter value"
                            type="number"
                            className="form-input"
                            value={filter.value ?? 0}
                            onChange={(event) => onChange({
                                ...filter,
                                value: Number(event.target.value),
                            })}
                        />
                    ) : null}
                </>
            );
        case 'dropdown':
            return (
                <div className="event-registration-filter-options">
                    {(column.options ?? []).map((option) => {
                        const checked = filter.values.includes(option);
                        return (
                            <label key={option} className="event-registration-filter-option">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                        const nextValues = checked
                                            ? filter.values.filter((value) => value !== option)
                                            : [...filter.values, option];
                                        onChange({ ...filter, values: nextValues });
                                    }}
                                />
                                <span>{option}</span>
                            </label>
                        );
                    })}
                </div>
            );
        case 'checkbox':
            return (
                <div className="event-registration-filter-radio-group" role="radiogroup" aria-label={`${column.label} filter`}>
                    {(['any', 'yes', 'no'] as const).map((value) => (
                        <label key={value} className="event-registration-filter-radio">
                            <input
                                type="radio"
                                name={`checkbox-filter-${filter.columnId}`}
                                checked={filter.value === value}
                                onChange={() => onChange({ ...filter, value })}
                            />
                            <span>{value === 'any' ? 'Any' : value === 'yes' ? 'Yes' : 'No'}</span>
                        </label>
                    ))}
                </div>
            );
        case 'tier':
            return (
                <select
                    aria-label="Tier filter"
                    className="form-input"
                    value={filter.tierId}
                    onChange={(event) => onChange({ ...filter, tierId: event.target.value })}
                >
                    <option value="">Select tier…</option>
                    {tiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>{tier.name}</option>
                    ))}
                </select>
            );
        case 'sessions':
            return (
                <>
                    <select
                        aria-label="Sessions filter operator"
                        className="form-input"
                        value={filter.operator}
                        onChange={(event) => onChange({
                            ...filter,
                            operator: event.target.value as typeof filter.operator,
                        })}
                    >
                        <option value="includes">Includes session</option>
                        <option value="hasNone">Has none</option>
                    </select>
                    {filter.operator === 'includes' ? (
                        <select
                            aria-label="Session"
                            className="form-input"
                            value={filter.sessionId ?? ''}
                            onChange={(event) => onChange({ ...filter, sessionId: event.target.value })}
                        >
                            <option value="">Select session…</option>
                            {sessions.map((session) => (
                                <option key={session.id} value={session.id}>{getSessionTitle(session)}</option>
                            ))}
                        </select>
                    ) : null}
                </>
            );
        case 'ticketStatus':
        case 'reminderStatus':
            return (
                <select
                    aria-label={`${column.label} filter`}
                    className="form-input"
                    value={filter.value}
                    onChange={(event) => onChange({
                        ...filter,
                        value: event.target.value as typeof filter.value,
                    })}
                >
                    <option value="sent">Sent</option>
                    <option value="notSent">Not sent</option>
                </select>
            );
        case 'attendance':
            return (
                <>
                    <select
                        aria-label="Attendance filter operator"
                        className="form-input"
                        value={filter.operator}
                        onChange={(event) => onChange({
                            ...filter,
                            operator: event.target.value as typeof filter.operator,
                        })}
                    >
                        <option value="hasAny">Has attendance</option>
                        <option value="hasNone">Has none</option>
                        <option value="countEquals">Count equals</option>
                        <option value="countGreaterThan">Count greater than</option>
                        <option value="countLessThan">Count less than</option>
                    </select>
                    {filter.operator !== 'hasAny' && filter.operator !== 'hasNone' ? (
                        <input
                            aria-label="Attendance count"
                            type="number"
                            min={0}
                            className="form-input"
                            value={filter.value ?? 0}
                            onChange={(event) => onChange({
                                ...filter,
                                value: Number(event.target.value),
                            })}
                        />
                    ) : null}
                </>
            );
        default:
            return null;
    }
}

export default function RegistrationColumnFilterModal({
    open,
    columns,
    activeFilters,
    sortSpec,
    serverFilters,
    serverFilterConfig,
    context,
    tiers,
    sessions,
    onClose,
    onApply,
    onClear,
}: RegistrationColumnFilterModalProps) {
    const [draftFilters, setDraftFilters] = useState<RegistrationColumnFilter[]>(activeFilters);
    const [draftSortSpec, setDraftSortSpec] = useState<RegistrationSortSpec>(sortSpec);
    const [draftServerFilters, setDraftServerFilters] = useState<RegistrationServerFilters>(serverFilters);

    useEffect(() => {
        if (open) {
            setDraftFilters(activeFilters);
            setDraftSortSpec(sortSpec);
            setDraftServerFilters(serverFilters);
        }
    }, [activeFilters, open, serverFilters, sortSpec]);

    if (!open) return null;

    const showQuickFilters = Boolean(
        serverFilterConfig.showTier
        || serverFilterConfig.showSource
        || serverFilterConfig.showCheckIn
        || serverFilterConfig.showTicketStatus
        || serverFilterConfig.showReminderStatus,
    );

    const addRule = () => {
        const firstColumn = columns[0];
        if (!firstColumn) return;
        setDraftFilters((current) => [...current, createDefaultFilterForColumn(firstColumn)]);
    };

    const updateRule = (index: number, next: RegistrationColumnFilter) => {
        setDraftFilters((current) => current.map((filter, filterIndex) => (
            filterIndex === index ? next : filter
        )));
    };

    const removeRule = (index: number) => {
        setDraftFilters((current) => current.filter((_, filterIndex) => filterIndex !== index));
    };

    const updateServerFilter = <K extends keyof RegistrationServerFilters>(
        key: K,
        value: RegistrationServerFilters[K],
    ) => {
        setDraftServerFilters((current) => ({ ...current, [key]: value }));
    };

    const handleApply = () => {
        const completeFilters = draftFilters.filter((filter) => isRegistrationFilterComplete(filter, columns));
        onApply(completeFilters, draftSortSpec, draftServerFilters);
        onClose();
    };

    const handleClear = () => {
        setDraftFilters([]);
        setDraftSortSpec(DEFAULT_REGISTRATION_SORT);
        setDraftServerFilters(EMPTY_REGISTRATION_SERVER_FILTERS);
        onClear();
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="registration-filter-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="registration-filter-title">Sort & filters</h2>
                        <p className="modal-subtitle">Sort the table and narrow results with quick filters or column rules.</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>
                <div className="modal-body event-registration-filter-modal-body">
                    <div className="event-registration-filter-sort">
                        <h3 className="form-section-title">Sort by</h3>
                        <div className="event-registration-filter-sort__controls">
                            <RegistrationTableSortControl
                                columns={columns}
                                sortSpec={draftSortSpec}
                                onSortSpecChange={setDraftSortSpec}
                            />
                        </div>
                    </div>

                    {showQuickFilters ? (
                        <div className="event-registration-filter-quick-section">
                            <h3 className="form-section-title">Quick filters</h3>
                            <div className="event-registration-filter-quick-grid">
                                {serverFilterConfig.showTier ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="registration-quick-tier">Tier</label>
                                        <select
                                            id="registration-quick-tier"
                                            aria-label="Filter by tier"
                                            className="form-input"
                                            value={draftServerFilters.tierId}
                                            onChange={(event) => updateServerFilter('tierId', event.target.value)}
                                        >
                                            <option value="">All tiers</option>
                                            {tiers.map((tier) => (
                                                <option key={tier.id} value={tier.id}>{tier.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : null}
                                {serverFilterConfig.showSource ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="registration-quick-source">Source</label>
                                        <select
                                            id="registration-quick-source"
                                            aria-label="Filter by source"
                                            className="form-input"
                                            value={draftServerFilters.sourceGroup}
                                            onChange={(event) => updateServerFilter(
                                                'sourceGroup',
                                                event.target.value as EventRegistrationSourceGroup | '',
                                            )}
                                        >
                                            {REGISTRATION_SOURCE_GROUP_OPTIONS.map((option) => (
                                                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : null}
                                {serverFilterConfig.showCheckIn ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="registration-quick-checkin">Check-in status</label>
                                        <select
                                            id="registration-quick-checkin"
                                            aria-label="Filter by check-in status"
                                            className="form-input"
                                            value={draftServerFilters.checkInStatus}
                                            onChange={(event) => updateServerFilter('checkInStatus', event.target.value)}
                                        >
                                            <option value="">Any check-in status</option>
                                            <option value="CHECKED_IN">Checked in</option>
                                            <option value="NOT_CHECKED_IN">Not checked in</option>
                                            {serverFilterConfig.showCheckedInToday ? (
                                                <option value="CHECKED_IN_TODAY">Checked in today</option>
                                            ) : null}
                                        </select>
                                    </div>
                                ) : null}
                                {serverFilterConfig.showTicketStatus ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="registration-quick-ticket">Ticket status</label>
                                        <select
                                            id="registration-quick-ticket"
                                            aria-label="Filter by ticket status"
                                            className="form-input"
                                            value={draftServerFilters.ticketStatus}
                                            onChange={(event) => updateServerFilter(
                                                'ticketStatus',
                                                event.target.value as '' | 'SENT' | 'NOT_SENT',
                                            )}
                                        >
                                            <option value="">Any ticket status</option>
                                            <option value="SENT">Sent</option>
                                            <option value="NOT_SENT">Not sent</option>
                                        </select>
                                    </div>
                                ) : null}
                                {serverFilterConfig.showReminderStatus ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="registration-quick-reminder">Reminder status</label>
                                        <select
                                            id="registration-quick-reminder"
                                            aria-label="Filter by reminder status"
                                            className="form-input"
                                            value={draftServerFilters.reminderStatus}
                                            onChange={(event) => updateServerFilter(
                                                'reminderStatus',
                                                event.target.value as '' | 'SENT' | 'NOT_SENT',
                                            )}
                                        >
                                            <option value="">Any reminder status</option>
                                            <option value="SENT">Sent</option>
                                            <option value="NOT_SENT">Not sent</option>
                                        </select>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="event-registration-filter-rules-section">
                        <h3 className="form-section-title">Column filters</h3>
                        {draftFilters.length === 0 ? (
                            <p className="event-registration-filter-empty">No filter rules yet. Add a rule to narrow the table.</p>
                        ) : (
                            <div className="event-registration-filter-rules">
                                {draftFilters.map((filter, index) => {
                                    const column = columns.find((entry) => entry.id === filter.columnId) ?? columns[0];
                                    const selectedColumn = column ?? columns[0];
                                    if (!selectedColumn) return null;

                                    return (
                                        <div key={`${filter.columnId}-${index}`} className="event-registration-filter-rule">
                                            <div className="event-registration-filter-rule__header">
                                                <select
                                                    aria-label="Filter column"
                                                    className="form-input"
                                                    value={filter.columnId}
                                                    onChange={(event) => {
                                                        const nextColumn = columns.find((entry) => entry.id === event.target.value);
                                                        if (!nextColumn) return;
                                                        updateRule(index, createDefaultFilterForColumn(nextColumn));
                                                    }}
                                                >
                                                    {columns.map((entry) => (
                                                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="table-action-btn event-registration-filter-rule__remove"
                                                    onClick={() => removeRule(index)}
                                                    aria-label="Remove filter rule"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="event-registration-filter-rule__values">
                                                {renderValueEditor(
                                                    filter,
                                                    selectedColumn,
                                                    tiers,
                                                    sessions,
                                                    (next) => updateRule(index, next),
                                                )}
                                            </div>
                                            {isRegistrationFilterComplete(filter, columns) ? (
                                                <p className="event-registration-filter-rule__preview">
                                                    {describeRegistrationFilter(filter, columns, context)}
                                                </p>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <button type="button" className="btn btn-secondary event-registration-filter-add-btn" onClick={addRule}>
                            <Plus size={14} />
                            Add rule
                        </button>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClear}>Clear</button>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleApply}>Apply</button>
                </div>
            </div>
        </>
    );
}

interface RegistrationFilterChipsProps {
    filters: RegistrationColumnFilter[];
    serverFilters?: RegistrationServerFilters;
    columns: FilterableColumn[];
    context: RegistrationTableContext;
    tiers?: EventTierRef[];
    onRemove: (index: number) => void;
    onRemoveServerFilter?: (key: keyof RegistrationServerFilters) => void;
    onClearAll: () => void;
}

export function RegistrationFilterChips({
    filters,
    serverFilters = EMPTY_REGISTRATION_SERVER_FILTERS,
    columns,
    context,
    tiers = [],
    onRemove,
    onRemoveServerFilter,
    onClearAll,
}: RegistrationFilterChipsProps) {
    const serverChips = (Object.keys(serverFilters) as Array<keyof RegistrationServerFilters>)
        .map((key) => {
            const label = describeServerFilterChip(key, serverFilters[key], tiers);
            return label ? { key, label } : null;
        })
        .filter((entry): entry is { key: keyof RegistrationServerFilters; label: string } => entry != null);

    if (filters.length === 0 && serverChips.length === 0) return null;

    return (
        <div className="event-registration-filter-chips">
            {serverChips.map((chip) => (
                <button
                    key={chip.key}
                    type="button"
                    className="event-registration-filter-chip"
                    onClick={() => onRemoveServerFilter?.(chip.key)}
                    aria-label={`Remove filter: ${chip.label}`}
                >
                    <span>{chip.label}</span>
                    <X size={12} />
                </button>
            ))}
            {filters.map((filter, index) => (
                <button
                    key={`${filter.columnId}-${index}`}
                    type="button"
                    className="event-registration-filter-chip"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove filter: ${describeRegistrationFilter(filter, columns, context)}`}
                >
                    <span>{describeRegistrationFilter(filter, columns, context)}</span>
                    <X size={12} />
                </button>
            ))}
            <button type="button" className="event-registration-filter-clear" onClick={onClearAll}>
                Clear all
            </button>
        </div>
    );
}

export function isRegistrationFunnelActive(
    columnFilters: RegistrationColumnFilter[],
    sortSpec: RegistrationSortSpec,
    serverFilters: RegistrationServerFilters,
): boolean {
    return columnFilters.length > 0
        || sortSpec.columnId !== DEFAULT_REGISTRATION_SORT.columnId
        || sortSpec.direction !== DEFAULT_REGISTRATION_SORT.direction
        || hasAnyServerFilters(serverFilters);
}
