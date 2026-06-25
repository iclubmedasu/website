'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/checkbox';
import { eventsAPI } from '@/services/api';
import type {
    CreateEventCustomFieldPayload,
    EventCustomFieldRef,
    Id,
    UpdateEventCustomFieldPayload,
} from '@/types/backend-contracts';

export const FIELD_TYPES = ['text', 'dropdown', 'checkbox', 'number'] as const;

const FIELD_TYPE_LABELS: Record<(typeof FIELD_TYPES)[number], string> = {
    text: 'text',
    dropdown: 'dropdown',
    checkbox: 'Yes/No toggle',
    number: 'number',
};

const DEFAULT_OPTION_ROWS = ['', ''];

function normalizeOptionRows(options: unknown): string[] {
    if (!Array.isArray(options) || options.length === 0) {
        return [...DEFAULT_OPTION_ROWS];
    }
    const rows = options.map((option) => String(option));
    while (rows.length < 2) rows.push('');
    return rows;
}

function getNormalizedOptions(optionRows: string[]): string[] {
    return optionRows.map((option) => option.trim()).filter(Boolean);
}

interface AddCustomFieldModalProps {
    eventId: Id | string;
    field?: EventCustomFieldRef | null;
    lockTypeChange?: boolean;
    onClose: () => void;
    onSaved: (field: EventCustomFieldRef) => void;
}

export default function AddCustomFieldModal({
    eventId,
    field,
    lockTypeChange = false,
    onClose,
    onSaved,
}: AddCustomFieldModalProps) {
    const isEdit = Boolean(field);
    const [label, setLabel] = useState(field?.label ?? '');
    const [type, setType] = useState<(typeof FIELD_TYPES)[number]>(
        (field?.type as (typeof FIELD_TYPES)[number]) ?? 'text',
    );
    const [optionRows, setOptionRows] = useState(() => normalizeOptionRows(field?.options));
    const [required, setRequired] = useState(field?.required ?? false);
    const [showOnPublic, setShowOnPublic] = useState(field?.showOnPublic ?? false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleTypeChange = (nextType: (typeof FIELD_TYPES)[number]) => {
        setType(nextType);
        if (nextType === 'dropdown' && optionRows.length < 2) {
            setOptionRows(normalizeOptionRows(optionRows));
        }
    };

    const handleSave = async () => {
        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            setError('Label is required.');
            return;
        }

        const normalizedOptions = getNormalizedOptions(optionRows);
        if (type === 'dropdown' && normalizedOptions.length === 0) {
            setError('Add at least one dropdown option.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (isEdit && field) {
                const patch: UpdateEventCustomFieldPayload = {
                    label: trimmedLabel,
                    required,
                    showOnPublic,
                };
                if (!lockTypeChange) {
                    patch.type = type;
                }
                if (type === 'dropdown') {
                    patch.options = normalizedOptions;
                }
                const updated = await eventsAPI.updateCustomField(eventId, field.id, patch);
                onSaved(updated);
            } else {
                const payload: CreateEventCustomFieldPayload = {
                    label: trimmedLabel,
                    type,
                    options: type === 'dropdown' ? normalizedOptions : undefined,
                    required,
                    showOnPublic,
                };
                const created = await eventsAPI.createCustomField(eventId, payload);
                onSaved(created);
            }
            onClose();
        } catch {
            setError('Failed to save field. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="add-custom-field-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="add-custom-field-title">
                            {isEdit ? 'Edit registration item' : 'Add registration item'}
                        </h2>
                        <p className="modal-subtitle">
                            Extra fields appear as columns in the registration table and on the public form when enabled.
                        </p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label" htmlFor="custom-field-label">Label</label>
                        <input
                            id="custom-field-label"
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                            placeholder="Field label"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="custom-field-type">Type</label>
                        <select
                            id="custom-field-type"
                            aria-label="Field type"
                            value={type}
                            onChange={(event) => handleTypeChange(event.target.value as typeof type)}
                            className="form-input"
                            disabled={lockTypeChange}
                        >
                            {FIELD_TYPES.map((fieldType) => (
                                <option key={fieldType} value={fieldType}>{FIELD_TYPE_LABELS[fieldType]}</option>
                            ))}
                        </select>
                    </div>

                    {type === 'dropdown' && (
                        <div className="form-group">
                            <label className="form-label">Options</label>
                            <div className="custom-field-options-list">
                                {optionRows.map((option, index) => (
                                    <div key={index} className="custom-field-option-row">
                                        <input
                                            value={option}
                                            onChange={(event) => setOptionRows((current) => current.map((value, rowIndex) => (
                                                rowIndex === index ? event.target.value : value
                                            )))}
                                            placeholder={`Option ${index + 1}`}
                                            className="form-input"
                                            aria-label={`Option ${index + 1}`}
                                        />
                                        {optionRows.length > 2 ? (
                                            <button
                                                type="button"
                                                className="custom-field-option-remove"
                                                onClick={() => setOptionRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                                                aria-label={`Remove option ${index + 1}`}
                                            >
                                                <X size={16} />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary custom-field-option-add"
                                onClick={() => setOptionRows((current) => [...current, ''])}
                            >
                                <Plus size={16} />
                                Add more option
                            </button>
                        </div>
                    )}

                    <div className="form-row">
                        <label className="toggle-field">
                            <Checkbox checked={required} onChange={(event) => setRequired(event.target.checked)} />
                            <span>
                                <strong>Required</strong>
                                <small>Must be completed when registering (public or walk-in) and before check-in if still empty.</small>
                            </span>
                        </label>

                        <label className="toggle-field">
                            <Checkbox checked={showOnPublic} onChange={(event) => setShowOnPublic(event.target.checked)} />
                            <span>
                                <strong>Show on public registration form</strong>
                                <small>Shown on the public registration form. Required public fields are enforced at registration; required hidden fields are enforced at walk-in or check-in.</small>
                            </span>
                        </label>
                    </div>

                    {error ? <p className="error-message">{error}</p> : null}
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="button" onClick={() => void handleSave()} className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add field'}
                    </button>
                </div>
            </div>
        </>
    );
}
