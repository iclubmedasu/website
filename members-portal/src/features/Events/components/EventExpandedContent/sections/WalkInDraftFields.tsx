import { useEffect, useRef, useState } from 'react';
import type { EventCustomFieldRef, EventSessionRef, EventTierRef } from '@/types/backend-contracts';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import {
    dropdownOptions,
    parseCustomFieldInputValue,
    type AttendeeDraft,
} from '../customFieldUtils';
import { compareSessionsBySchedule } from '../../eventUtils';

interface WalkInDraftFieldsProps {
    variant: 'table' | 'stack';
    draft: AttendeeDraft;
    draftErrors: Record<string, string>;
    sortedFields: EventCustomFieldRef[];
    tiers: EventTierRef[];
    sessions: EventSessionRef[];
    tierFieldRequired: boolean;
    sessionFieldRequired: boolean;
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

    const label = getSessionSelectionLabel(draft.sessionIds, activeSessions);

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
                    {open && activeSessions.length > 0 ? (
                        <div className="event-registration-sessions-cell__menu" role="listbox" aria-multiselectable="true">
                            {activeSessions.map((session) => {
                                const sessionId = String(session.id);
                                return (
                                    <label key={sessionId} className="event-registration-sessions-cell__option">
                                        <input
                                            type="checkbox"
                                            checked={draft.sessionIds.includes(sessionId)}
                                            onChange={() => toggleSession(sessionId)}
                                        />
                                        <span>{getSessionTitle(session)}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : null}
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
                {open && activeSessions.length > 0 ? (
                    <div className="event-registration-sessions-cell__menu" role="listbox" aria-multiselectable="true">
                        {activeSessions.map((session) => {
                            const sessionId = String(session.id);
                            return (
                                <label key={sessionId} className="event-registration-sessions-cell__option">
                                    <input
                                        type="checkbox"
                                        checked={draft.sessionIds.includes(sessionId)}
                                        onChange={() => toggleSession(sessionId)}
                                    />
                                    <span>{getSessionTitle(session)}</span>
                                </label>
                            );
                        })}
                    </div>
                ) : null}
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

export default function WalkInDraftFields({
    variant,
    draft,
    draftErrors,
    sortedFields,
    tiers,
    sessions,
    tierFieldRequired,
    sessionFieldRequired,
    multiDayEvent,
    onDraftChange,
    onClearError,
    onCustomFieldChange,
}: WalkInDraftFieldsProps) {
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
                    <input
                        id="walkin-stack-email"
                        type="email"
                        value={draft.email}
                        onChange={(event) => updateField('email', event.target.value)}
                        placeholder="Email"
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="walkin-stack-phone">Phone</label>
                    <input
                        id="walkin-stack-phone"
                        value={draft.phoneNumber}
                        onChange={(event) => updateField('phoneNumber', event.target.value)}
                        placeholder="Phone"
                        className="form-input"
                    />
                </div>
                {sortedFields.map((field) => renderCustomFieldStackInput(field, draft, draftErrors, onCustomFieldChange))}
                <SessionSelectionsPicker
                    draft={draft}
                    sessions={sessions}
                    sessionFieldRequired={sessionFieldRequired}
                    draftErrors={draftErrors}
                    onDraftChange={onDraftChange}
                    onClearError={onClearError}
                    variant="stack"
                />
                <div className={`form-group${cellErrorClass(draftErrors, 'tierId').trim() ? ' event-registrations-walkin-stack-field--error' : ''}`}>
                    <label className="form-label" htmlFor="walkin-stack-tier">
                        Tier{tierFieldRequired ? ' *' : ''}
                    </label>
                    <select
                        id="walkin-stack-tier"
                        aria-label="Tier"
                        value={draft.tierId}
                        onChange={(event) => updateField('tierId', event.target.value)}
                        className="form-input"
                    >
                        <option value="">{tierFieldRequired ? 'Select tier…' : 'No tier'}</option>
                        {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                    </select>
                    {draftErrors.tierId ? <p className="error-message">{draftErrors.tierId}</p> : null}
                </div>
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
                <input
                    type="email"
                    value={draft.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="Email"
                    className="event-registrations-table-input form-input"
                    aria-label="Email"
                />
            </td>
            <td>
                <input
                    value={draft.phoneNumber}
                    onChange={(event) => updateField('phoneNumber', event.target.value)}
                    placeholder="Phone"
                    className="event-registrations-table-input form-input"
                    aria-label="Phone"
                />
            </td>
            {sortedFields.map((field) => renderCustomFieldTableCell(field, draft, draftErrors, onCustomFieldChange))}
            <SessionSelectionsPicker
                draft={draft}
                sessions={sessions}
                sessionFieldRequired={sessionFieldRequired}
                draftErrors={draftErrors}
                onDraftChange={onDraftChange}
                onClearError={onClearError}
                variant="table"
            />
            <td className={cellErrorClass(draftErrors, 'tierId').trim() || undefined}>
                <select
                    aria-label="Tier"
                    value={draft.tierId}
                    onChange={(event) => updateField('tierId', event.target.value)}
                    className="event-registrations-table-input form-input"
                >
                    <option value="">{tierFieldRequired ? 'Select tier…' : 'No tier'}</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
            </td>
            <td>—</td>
            {multiDayEvent ? <td>—</td> : null}
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td className="event-registrations-add-field-col" aria-hidden="true" />
        </>
    );
}
