import { useEffect, useRef, useState } from 'react';
import type { EventCustomFieldRef, EventSessionRef, EventTierRef } from '@/types/backend-contracts';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import EmailInputWithDomainSuggestions from '@/components/EmailInputWithDomainSuggestions';
import {
    dropdownOptions,
    parseCustomFieldInputValue,
    type AttendeeDraft,
} from '../customFieldUtils';
import type { MiddleColumn } from '../registrationColumnOrderUtils';
import { compareSessionsBySchedule } from '../../eventUtils';

interface WalkInDraftFieldsProps {
    variant: 'table' | 'stack';
    draft: AttendeeDraft;
    draftErrors: Record<string, string>;
    middleColumns: MiddleColumn[];
    tiers: EventTierRef[];
    sessions: EventSessionRef[];
    tierFieldRequired: boolean;
    sessionFieldRequired: boolean;
    phoneFieldRequired: boolean;
    multiDayEvent: boolean;
    onDraftChange: (patch: Partial<AttendeeDraft>) => void;
    onClearError: (key: string) => void;
    onCustomFieldChange: (fieldKey: string, value: unknown) => void;
}

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

function cellErrorClass(draftErrors: Record<string, string>, key: string) {
    return draftErrors[key] ? ' event-registrations-cell--error' : '';
}

function getSortedActiveSessions(sessions: EventSessionRef[]): EventSessionRef[] {
    return [...sessions]
        .filter((session) => session.isActive !== false)
        .sort(compareSessionsBySchedule);
}

function getSessionSelectionLabel(sessionIds: string[], activeSessions: EventSessionRef[]): string {
    if (sessionIds.length === 0) return 'Select sessions';
    if (sessionIds.length === 1) {
        const session = activeSessions.find((entry) => String(entry.id) === sessionIds[0]);
        return session ? getSessionTitle(session) : '1 session selected';
    }
    return `${sessionIds.length} sessions selected`;
}

interface SessionSelectionsPickerProps {
    draft: AttendeeDraft;
    sessions: EventSessionRef[];
    sessionFieldRequired: boolean;
    draftErrors: Record<string, string>;
    onDraftChange: (patch: Partial<AttendeeDraft>) => void;
    onClearError: (key: string) => void;
    variant: 'table' | 'stack';
}

function SessionSelectionsPicker({
    draft,
    sessions,
    sessionFieldRequired,
    draftErrors,
    onDraftChange,
    onClearError,
    variant,
}: SessionSelectionsPickerProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeSessions = getSortedActiveSessions(sessions);
    const errorClass = cellErrorClass(draftErrors, 'sessionIds');

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    const toggleSession = (sessionId: string) => {
        const next = draft.sessionIds.includes(sessionId)
            ? draft.sessionIds.filter((id) => id !== sessionId)
            : [...draft.sessionIds, sessionId];
        onDraftChange({ sessionIds: next });
        onClearError('sessionIds');
    };

    const selectableSessionIds = activeSessions
        .filter((session) => !session.isFull || draft.sessionIds.includes(String(session.id)))
        .map((session) => String(session.id));
    const allSelected = selectableSessionIds.length > 0
        && selectableSessionIds.every((sessionId) => draft.sessionIds.includes(sessionId));

    const toggleSelectAll = () => {
        if (allSelected) {
            onDraftChange({ sessionIds: [] });
            onClearError('sessionIds');
            return;
        }
        const next = new Set(draft.sessionIds);
        for (const session of activeSessions) {
            const sessionId = String(session.id);
            if (!session.isFull || draft.sessionIds.includes(sessionId)) {
                next.add(sessionId);
            }
        }
        onDraftChange({ sessionIds: [...next] });
        onClearError('sessionIds');
    };

    const label = getSessionSelectionLabel(draft.sessionIds, activeSessions);

    const sessionMenu = open && activeSessions.length > 0 ? (
        <div className="event-registration-sessions-cell__menu" role="listbox" aria-multiselectable="true">
            <label className="event-registration-sessions-cell__option event-registration-sessions-cell__option--select-all">
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                />
                <span>Select all</span>
            </label>
            {activeSessions.map((session) => {
                const sessionId = String(session.id);
                const checked = draft.sessionIds.includes(sessionId);
                const fullAndUnselected = Boolean(session.isFull) && !checked;
                return (
                    <label key={sessionId} className="event-registration-sessions-cell__option">
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled={fullAndUnselected}
                            onChange={() => toggleSession(sessionId)}
                        />
                        <span>
                            {getSessionTitle(session)}
                            {fullAndUnselected ? ' (Full)' : ''}
                        </span>
                    </label>
                );
            })}
        </div>
    ) : null;

    if (variant === 'stack') {
        return (
            <div className={`form-group${errorClass.trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                <label className="form-label">
                    Sessions{sessionFieldRequired ? ' *' : ''}
                </label>
                <div className="event-registration-sessions-cell" ref={containerRef}>
                    <button
                        type="button"
                        className={[
                            'form-input',
                            'event-registration-sessions-cell__trigger',
                            draft.sessionIds.length === 0 ? 'event-registration-sessions-cell__trigger--placeholder' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setOpen((current) => !current)}
                        disabled={activeSessions.length === 0}
                        aria-expanded={open}
                        aria-haspopup="listbox"
                    >
                        {activeSessions.length === 0 ? 'No sessions configured' : label}
                    </button>
                    {sessionMenu}
                </div>
                {draftErrors.sessionIds ? (
                    <p className="error-message">{draftErrors.sessionIds}</p>
                ) : null}
            </div>
        );
    }

    return (
        <td className={errorClass.trim() || undefined} title={draftErrors.sessionIds || undefined}>
            <div className="event-registration-sessions-cell" ref={containerRef}>
                <button
                    type="button"
                    className={[
                        'event-registrations-table-input',
                        'form-input',
                        'event-registration-sessions-cell__trigger',
                        draft.sessionIds.length === 0 ? 'event-registration-sessions-cell__trigger--placeholder' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setOpen((current) => !current)}
                    disabled={activeSessions.length === 0}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-label="Sessions"
                >
                    {activeSessions.length === 0 ? 'No sessions configured' : label}
                </button>
                {sessionMenu}
            </div>
        </td>
    );
}

function renderCustomFieldStackInput(
    field: EventCustomFieldRef,
    draft: AttendeeDraft,
    draftErrors: Record<string, string>,
    onCustomFieldChange: (fieldKey: string, value: unknown) => void,
) {
    const fieldKey = String(field.id);
    const value = draft.customFieldValues[fieldKey];
    const errorClass = cellErrorClass(draftErrors, fieldKey);

    if (field.type === 'checkbox') {
        return (
            <div key={field.id} className={errorClass.trim() ? 'event-registrations-walkin-stack-field--error' : undefined}>
                <YesNoField
                    id={`walkin-stack-${field.id}`}
                    label={field.label}
                    required={field.required}
                    checked={Boolean(value)}
                    onChange={(next) => onCustomFieldChange(fieldKey, next)}
                    variant="stacked"
                />
            </div>
        );
    }

    if (field.type === 'dropdown') {
        return (
            <div key={field.id} className={`form-group${errorClass.trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                <label className="form-label" htmlFor={`walkin-stack-${field.id}`}>
                    {field.label}{field.required ? ' *' : ''}
                </label>
                <select
                    id={`walkin-stack-${field.id}`}
                    value={value != null ? String(value) : ''}
                    onChange={(event) => onCustomFieldChange(fieldKey, event.target.value || null)}
                    className="form-input"
                >
                    <option value="">{field.required ? 'Select…' : '—'}</option>
                    {dropdownOptions(field).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div key={field.id} className={`form-group${errorClass.trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
            <label className="form-label" htmlFor={`walkin-stack-${field.id}`}>
                {field.label}{field.required ? ' *' : ''}
            </label>
            <input
                id={`walkin-stack-${field.id}`}
                type={field.type === 'number' ? 'number' : 'text'}
                value={value != null ? String(value) : ''}
                onChange={(event) => onCustomFieldChange(
                    fieldKey,
                    parseCustomFieldInputValue(field, event.target.value),
                )}
                className="form-input"
            />
        </div>
    );
}

function renderCustomFieldTableCell(
    field: EventCustomFieldRef,
    draft: AttendeeDraft,
    draftErrors: Record<string, string>,
    onCustomFieldChange: (fieldKey: string, value: unknown) => void,
) {
    const fieldKey = String(field.id);
    const value = draft.customFieldValues[fieldKey];
    const errorClass = cellErrorClass(draftErrors, fieldKey);

    if (field.type === 'checkbox') {
        return (
            <td key={field.id} className={errorClass.trim() || undefined}>
                <YesNoField
                    label={field.label}
                    checked={Boolean(value)}
                    onChange={(next) => onCustomFieldChange(fieldKey, next)}
                    variant="inline"
                />
            </td>
        );
    }

    if (field.type === 'dropdown') {
        return (
            <td key={field.id} className={errorClass.trim() || undefined}>
                <select
                    aria-label={field.label}
                    value={value != null ? String(value) : ''}
                    onChange={(event) => onCustomFieldChange(fieldKey, event.target.value || null)}
                    className="event-registrations-table-input form-input"
                >
                    <option value="">{field.required ? 'Select…' : '—'}</option>
                    {dropdownOptions(field).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </td>
        );
    }

    return (
        <td key={field.id} className={errorClass.trim() || undefined}>
            <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={value != null ? String(value) : ''}
                onChange={(event) => onCustomFieldChange(
                    fieldKey,
                    parseCustomFieldInputValue(field, event.target.value),
                )}
                placeholder={field.label}
                className="event-registrations-table-input form-input"
                aria-label={field.label}
            />
        </td>
    );
}

function renderMiddleColumnStack(
    column: MiddleColumn,
    props: WalkInDraftFieldsProps,
) {
    const {
        draft,
        draftErrors,
        tiers,
        sessions,
        tierFieldRequired,
        sessionFieldRequired,
        onDraftChange,
        onClearError,
        onCustomFieldChange,
    } = props;

    if (column.kind === 'sessions') {
        return (
            <SessionSelectionsPicker
                key="sessions"
                draft={draft}
                sessions={sessions}
                sessionFieldRequired={sessionFieldRequired}
                draftErrors={draftErrors}
                onDraftChange={onDraftChange}
                onClearError={onClearError}
                variant="stack"
            />
        );
    }

    if (column.kind === 'tier') {
        return (
            <div key="tier" className={`form-group${cellErrorClass(draftErrors, 'tierId').trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                <label className="form-label" htmlFor="walkin-stack-tier">
                    Tier{tierFieldRequired ? ' *' : ''}
                </label>
                <select
                    id="walkin-stack-tier"
                    aria-label="Tier"
                    value={draft.tierId}
                    onChange={(event) => {
                        onDraftChange({ tierId: event.target.value });
                        onClearError('tierId');
                    }}
                    className="form-input"
                >
                    <option value="">{tierFieldRequired ? 'Select tier…' : 'No tier'}</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
                {draftErrors.tierId ? <p className="error-message">{draftErrors.tierId}</p> : null}
            </div>
        );
    }

    return renderCustomFieldStackInput(column.field, draft, draftErrors, onCustomFieldChange);
}

function renderMiddleColumnTable(
    column: MiddleColumn,
    props: WalkInDraftFieldsProps,
) {
    const {
        draft,
        draftErrors,
        tiers,
        sessions,
        tierFieldRequired,
        sessionFieldRequired,
        onDraftChange,
        onClearError,
        onCustomFieldChange,
    } = props;

    if (column.kind === 'sessions') {
        return (
            <SessionSelectionsPicker
                key="sessions"
                draft={draft}
                sessions={sessions}
                sessionFieldRequired={sessionFieldRequired}
                draftErrors={draftErrors}
                onDraftChange={onDraftChange}
                onClearError={onClearError}
                variant="table"
            />
        );
    }

    if (column.kind === 'tier') {
        return (
            <td key="tier" className={cellErrorClass(draftErrors, 'tierId').trim() || undefined}>
                <select
                    aria-label="Tier"
                    value={draft.tierId}
                    onChange={(event) => {
                        onDraftChange({ tierId: event.target.value });
                        onClearError('tierId');
                    }}
                    className="event-registrations-table-input form-input"
                >
                    <option value="">{tierFieldRequired ? 'Select tier…' : 'No tier'}</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
            </td>
        );
    }

    return renderCustomFieldTableCell(column.field, draft, draftErrors, onCustomFieldChange);
}

export default function WalkInDraftFields(props: WalkInDraftFieldsProps) {
    const {
        variant,
        draft,
        draftErrors,
        middleColumns,
        phoneFieldRequired,
        multiDayEvent,
        onDraftChange,
        onClearError,
    } = props;

    const updateField = (key: keyof AttendeeDraft, value: string) => {
        onDraftChange({ [key]: value });
        onClearError(key);
    };

    if (variant === 'stack') {
        return (
            <div className="event-registrations-walkin-stack event-registrations-walkin-stack--mobile">
                <div className={`form-group${cellErrorClass(draftErrors, 'fullName').trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                    <label className="form-label" htmlFor="walkin-stack-fullName">Full name *</label>
                    <input
                        id="walkin-stack-fullName"
                        value={draft.fullName}
                        onChange={(event) => updateField('fullName', event.target.value)}
                        placeholder="Full name"
                        className="form-input"
                    />
                </div>
                <div className={`form-group${cellErrorClass(draftErrors, 'email').trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                    <label className="form-label" htmlFor="walkin-stack-email">Email *</label>
                    <EmailInputWithDomainSuggestions
                        id="walkin-stack-email"
                        value={draft.email}
                        onChange={(value) => updateField('email', value)}
                        placeholder="Email"
                        className="form-input"
                    />
                </div>
                <div className={`form-group${cellErrorClass(draftErrors, 'phoneNumber').trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                    <label className="form-label" htmlFor="walkin-stack-phone">
                        Phone{phoneFieldRequired ? ' *' : ''}
                    </label>
                    <input
                        id="walkin-stack-phone"
                        value={draft.phoneNumber}
                        onChange={(event) => updateField('phoneNumber', event.target.value)}
                        placeholder="Phone"
                        className="form-input"
                    />
                    {draftErrors.phoneNumber ? <p className="error-message">{draftErrors.phoneNumber}</p> : null}
                </div>
                {middleColumns.map((column) => renderMiddleColumnStack(column, props))}
            </div>
        );
    }

    return (
        <>
            <td className={[cellErrorClass(draftErrors, 'fullName').trim(), 'event-registrations-name-cell'].filter(Boolean).join(' ')}>
                <input
                    value={draft.fullName}
                    onChange={(event) => updateField('fullName', event.target.value)}
                    placeholder="Full name"
                    className="event-registrations-table-input form-input"
                    aria-label="Full name"
                />
            </td>
            <td className={cellErrorClass(draftErrors, 'email').trim() || undefined}>
                <EmailInputWithDomainSuggestions
                    value={draft.email}
                    onChange={(value) => updateField('email', value)}
                    placeholder="Email"
                    className="event-registrations-table-input form-input"
                    aria-label="Email"
                />
            </td>
            <td className={cellErrorClass(draftErrors, 'phoneNumber').trim() || undefined}>
                <input
                    value={draft.phoneNumber}
                    onChange={(event) => updateField('phoneNumber', event.target.value)}
                    placeholder="Phone"
                    className="event-registrations-table-input form-input"
                    aria-label="Phone"
                />
            </td>
            {middleColumns.map((column) => renderMiddleColumnTable(column, props))}
            <td>—</td>
            {multiDayEvent ? <td>—</td> : null}
            {/* Status column hidden — walk-in placeholder */}
            {/* <td>—</td> */}
            <td>—</td>
            <td>—</td>
            <td className="event-registrations-add-field-col" aria-hidden="true" />
        </>
    );
}
