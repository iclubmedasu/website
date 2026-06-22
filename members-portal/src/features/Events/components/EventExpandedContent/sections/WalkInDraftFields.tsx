import type { EventCustomFieldRef, EventTierRef } from '@/types/backend-contracts';
import {
    dropdownOptions,
    parseCustomFieldInputValue,
    type AttendeeDraft,
} from '../customFieldUtils';

interface WalkInDraftFieldsProps {
    variant: 'table' | 'stack';
    draft: AttendeeDraft;
    draftErrors: Record<string, string>;
    sortedFields: EventCustomFieldRef[];
    tiers: EventTierRef[];
    onDraftChange: (patch: Partial<AttendeeDraft>) => void;
    onClearError: (key: string) => void;
    onCustomFieldChange: (fieldKey: string, value: unknown) => void;
}

function cellErrorClass(draftErrors: Record<string, string>, key: string) {
    return draftErrors[key] ? ' event-registrations-cell--error' : '';
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
            <label key={field.id} className={`event-registrations-walkin-stack-checkbox${errorClass}`}>
                <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onCustomFieldChange(fieldKey, event.target.checked)}
                />
                <span>{field.label}{field.required ? ' *' : ''}</span>
            </label>
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
                <label className="event-registrations-table-checkbox">
                    <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => onCustomFieldChange(fieldKey, event.target.checked)}
                        className="event-registrations-table-input"
                        aria-label={field.label}
                    />
                </label>
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
                <div className="form-group">
                    <label className="form-label" htmlFor="walkin-stack-tier">Tier</label>
                    <select
                        id="walkin-stack-tier"
                        aria-label="Tier"
                        value={draft.tierId}
                        onChange={(event) => updateField('tierId', event.target.value)}
                        className="form-input"
                    >
                        <option value="">No tier</option>
                        {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                    </select>
                </div>
            </div>
        );
    }

    return (
        <>
            <td className={cellErrorClass(draftErrors, 'fullName').trim() || undefined}>
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
            <td>
                <select
                    aria-label="Tier"
                    value={draft.tierId}
                    onChange={(event) => updateField('tierId', event.target.value)}
                    className="event-registrations-table-input form-input"
                >
                    <option value="">No tier</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
        </>
    );
}
