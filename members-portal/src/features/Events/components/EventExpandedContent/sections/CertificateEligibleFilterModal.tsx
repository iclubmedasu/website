'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
    createDefaultCertificateEligibleFilter,
    DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
    describeCertificateEligibleFilter,
    EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    isCertificateEligibleFilterComplete,
    type CertificateEligibleColumn,
    type CertificateEligibleFilter,
    type CertificateEligibleSortSpec,
    type CertificateIssueDateRange,
    type SortDirection,
} from '../certificateEligibleFilterUtils';

interface CertificateEligibleFilterModalProps {
    open: boolean;
    columns: CertificateEligibleColumn[];
    activeFilters: CertificateEligibleFilter[];
    sortSpec: CertificateEligibleSortSpec;
    issueDateRange?: CertificateIssueDateRange;
    onClose: () => void;
    onApply: (
        filters: CertificateEligibleFilter[],
        sortSpec: CertificateEligibleSortSpec,
        issueDateRange: CertificateIssueDateRange,
    ) => void;
    onClear: () => void;
}

function renderValueEditor(
    filter: CertificateEligibleFilter,
    column: CertificateEligibleColumn,
    onChange: (next: CertificateEligibleFilter) => void,
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
                                <span>{option.charAt(0) + option.slice(1).toLowerCase()}</span>
                            </label>
                        );
                    })}
                </div>
            );
        case 'checkbox':
            return (
                <div
                    className="event-registration-filter-radio-group"
                    role="radiogroup"
                    aria-label={`${column.label} filter`}
                >
                    {(['any', 'yes', 'no'] as const).map((value) => (
                        <label key={value} className="event-registration-filter-radio">
                            <input
                                type="radio"
                                name={`cert-checkbox-filter-${filter.columnId}`}
                                checked={filter.value === value}
                                onChange={() => onChange({ ...filter, value })}
                            />
                            <span>{value === 'any' ? 'Any' : value === 'yes' ? 'Yes' : 'No'}</span>
                        </label>
                    ))}
                </div>
            );
        case 'idSet':
            return (
                <>
                    <select
                        aria-label="Id set filter operator"
                        className="form-input"
                        value={filter.operator}
                        onChange={(event) => onChange({
                            ...filter,
                            operator: event.target.value as typeof filter.operator,
                        })}
                    >
                        <option value="includesAll">All selected</option>
                        <option value="includesAny">Any selected</option>
                    </select>
                    <div className="event-registration-filter-options">
                        {(column.options ?? []).map((option) => {
                            const checked = filter.values.includes(option);
                            const optionLabel = column.optionLabels?.[option] ?? option;
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
                                    <span>{optionLabel}</span>
                                </label>
                            );
                        })}
                    </div>
                </>
            );
        default:
            return null;
    }
}

export default function CertificateEligibleFilterModal({
    open,
    columns,
    activeFilters,
    sortSpec,
    issueDateRange = EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    onClose,
    onApply,
    onClear,
}: CertificateEligibleFilterModalProps) {
    const [draftFilters, setDraftFilters] = useState<CertificateEligibleFilter[]>(activeFilters);
    const [draftSortSpec, setDraftSortSpec] = useState<CertificateEligibleSortSpec>(sortSpec);
    const [draftDateFrom, setDraftDateFrom] = useState(issueDateRange.dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(issueDateRange.dateTo);

    useEffect(() => {
        if (open) {
            setDraftFilters(activeFilters);
            setDraftSortSpec(sortSpec);
            setDraftDateFrom(issueDateRange.dateFrom);
            setDraftDateTo(issueDateRange.dateTo);
        }
    }, [activeFilters, issueDateRange.dateFrom, issueDateRange.dateTo, open, sortSpec]);

    if (!open) return null;

    const addRule = () => {
        const firstColumn = columns[0];
        if (!firstColumn) return;
        setDraftFilters((current) => [...current, createDefaultCertificateEligibleFilter(firstColumn)]);
    };

    const updateRule = (index: number, next: CertificateEligibleFilter) => {
        setDraftFilters((current) => current.map((filter, filterIndex) => (
            filterIndex === index ? next : filter
        )));
    };

    const removeRule = (index: number) => {
        setDraftFilters((current) => current.filter((_, filterIndex) => filterIndex !== index));
    };

    const toggleDirection = () => {
        const nextDirection: SortDirection = draftSortSpec.direction === 'asc' ? 'desc' : 'asc';
        setDraftSortSpec({ ...draftSortSpec, direction: nextDirection });
    };

    const handleApply = () => {
        const completeFilters = draftFilters.filter((filter) => (
            isCertificateEligibleFilterComplete(filter, columns)
        ));
        onApply(completeFilters, draftSortSpec, {
            dateFrom: draftDateFrom,
            dateTo: draftDateTo,
        });
        onClose();
    };

    const handleClear = () => {
        setDraftFilters([]);
        setDraftSortSpec(DEFAULT_CERTIFICATE_ELIGIBLE_SORT);
        setDraftDateFrom('');
        setDraftDateTo('');
        onClear();
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="certificate-eligible-filter-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="certificate-eligible-filter-title">
                            Sort & filters
                        </h2>
                        <p className="modal-subtitle">
                            Sort recipients and narrow the list with column rules and issue date.
                        </p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>
                <div className="modal-body event-registration-filter-modal-body">
                    <div className="event-registration-filter-sort">
                        <h3 className="form-section-title">Sort by</h3>
                        <div className="event-registration-filter-sort__controls">
                            <select
                                aria-label="Sort by"
                                className="form-input"
                                value={draftSortSpec.columnId}
                                onChange={(event) => setDraftSortSpec({
                                    ...draftSortSpec,
                                    columnId: event.target.value,
                                })}
                            >
                                {columns.map((column) => (
                                    <option key={column.id} value={column.id}>{column.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-secondary event-registration-sort-direction-btn"
                                onClick={toggleDirection}
                                aria-label={draftSortSpec.direction === 'asc' ? 'Sort ascending' : 'Sort descending'}
                                title={draftSortSpec.direction === 'asc' ? 'Ascending' : 'Descending'}
                            >
                                {draftSortSpec.direction === 'asc' ? 'A→Z' : 'Z→A'}
                            </button>
                        </div>
                    </div>

                    <div className="event-registration-filter-rules-section">
                        <h3 className="form-section-title">Column filters</h3>
                        {draftFilters.length === 0 ? (
                            <p className="event-registration-filter-empty">
                                No filter rules yet. Add a rule to narrow the table.
                            </p>
                        ) : (
                            <div className="event-registration-filter-rules">
                                {draftFilters.map((filter, index) => {
                                    const column = columns.find((entry) => entry.id === filter.columnId)
                                        ?? columns[0];
                                    if (!column) return null;

                                    return (
                                        <div key={`${filter.columnId}-${index}`} className="event-registration-filter-rule">
                                            <div className="event-registration-filter-rule__header">
                                                <select
                                                    aria-label="Filter column"
                                                    className="form-input"
                                                    value={filter.columnId}
                                                    onChange={(event) => {
                                                        const nextColumn = columns.find(
                                                            (entry) => entry.id === event.target.value,
                                                        );
                                                        if (!nextColumn) return;
                                                        updateRule(
                                                            index,
                                                            createDefaultCertificateEligibleFilter(nextColumn),
                                                        );
                                                    }}
                                                >
                                                    {columns.map((entry) => (
                                                        <option key={entry.id} value={entry.id}>
                                                            {entry.label}
                                                        </option>
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
                                                {renderValueEditor(filter, column, (next) => updateRule(index, next))}
                                            </div>
                                            {isCertificateEligibleFilterComplete(filter, columns) ? (
                                                <p className="event-registration-filter-rule__preview">
                                                    {describeCertificateEligibleFilter(filter, columns)}
                                                </p>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={addRule}>
                            <Plus size={14} />
                            Add filter rule
                        </button>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Issued date</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="cert-unified-date-from">
                                    Issued from
                                </label>
                                <input
                                    id="cert-unified-date-from"
                                    type="date"
                                    className="form-input"
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="cert-unified-date-to">
                                    Issued to
                                </label>
                                <input
                                    id="cert-unified-date-to"
                                    type="date"
                                    className="form-input"
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClear}>
                        Clear
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleApply}>
                        Apply
                    </button>
                </div>
            </div>
        </>
    );
}

interface CertificateEligibleFilterChipsProps {
    filters: CertificateEligibleFilter[];
    columns: CertificateEligibleColumn[];
    issueDateRange?: CertificateIssueDateRange;
    onRemove: (index: number) => void;
    onClearAll: () => void;
    onClearIssueDate?: () => void;
}

export function CertificateEligibleFilterChips({
    filters,
    columns,
    issueDateRange = EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    onRemove,
    onClearAll,
    onClearIssueDate,
}: CertificateEligibleFilterChipsProps) {
    const hasDateRange = Boolean(issueDateRange.dateFrom || issueDateRange.dateTo);
    if (filters.length === 0 && !hasDateRange) return null;

    const dateLabel = [
        issueDateRange.dateFrom ? `from ${issueDateRange.dateFrom}` : null,
        issueDateRange.dateTo ? `to ${issueDateRange.dateTo}` : null,
    ].filter(Boolean).join(' ');

    return (
        <div className="event-registration-filter-chips">
            {filters.map((filter, index) => (
                <button
                    key={`${filter.columnId}-${index}`}
                    type="button"
                    className="event-registration-filter-chip"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove filter: ${describeCertificateEligibleFilter(filter, columns)}`}
                >
                    <span>{describeCertificateEligibleFilter(filter, columns)}</span>
                    <X size={12} />
                </button>
            ))}
            {hasDateRange ? (
                <button
                    type="button"
                    className="event-registration-filter-chip"
                    onClick={() => onClearIssueDate?.()}
                    aria-label={`Remove filter: Issued ${dateLabel}`}
                >
                    <span>Issued {dateLabel}</span>
                    <X size={12} />
                </button>
            ) : null}
            <button
                type="button"
                className="event-registration-filter-clear"
                onClick={() => {
                    onClearAll();
                    onClearIssueDate?.();
                }}
            >
                Clear all
            </button>
        </div>
    );
}
