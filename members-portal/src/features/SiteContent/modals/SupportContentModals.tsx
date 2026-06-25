'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import type {
    EditorIncidentReportField,
    EditorIncidentReportForm,
    EditorSupportPage,
    SupportLocale,
} from '@iclub/shared';
import { supportContentAPI } from '@/services/api';
import Toggle from '@/components/toggle/Toggle';
import { SiteContentModal } from '../components/SiteContentModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export const INCIDENT_FIELD_TYPES = ['text', 'dropdown', 'checkbox', 'number'] as const;

const INCIDENT_FIELD_TYPE_LABELS: Record<(typeof INCIDENT_FIELD_TYPES)[number], string> = {
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

interface FormFieldModalProps {
    formId: number;
    field?: EditorIncidentReportField | null;
    onClose: () => void;
    onSaved: (page: EditorSupportPage) => void;
}

function FormFieldModal({ formId, field, onClose, onSaved }: FormFieldModalProps) {
    const isEdit = Boolean(field);
    const [label, setLabel] = useState(field?.label ?? '');
    const [type, setType] = useState<(typeof INCIDENT_FIELD_TYPES)[number]>(
        (field?.type as (typeof INCIDENT_FIELD_TYPES)[number]) ?? 'text',
    );
    const [optionRows, setOptionRows] = useState(() => normalizeOptionRows(field?.options));
    const [required, setRequired] = useState(field?.required ?? false);
    const [isActive, setIsActive] = useState(field?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handleTypeChange = (nextType: (typeof INCIDENT_FIELD_TYPES)[number]) => {
        setType(nextType);
        if (nextType === 'dropdown' && optionRows.length < 2) {
            setOptionRows(normalizeOptionRows(optionRows));
        }
    };

    const save = async () => {
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

        setBusy(true);
        setError('');

        try {
            const payload: Record<string, unknown> = {
                label: trimmedLabel,
                type,
                required,
                isActive,
            };
            if (type === 'dropdown') {
                payload.options = normalizedOptions;
            }

            const updated = isEdit && field
                ? ((await supportContentAPI.updateFormField(formId, field.id, payload)) as EditorSupportPage)
                : ((await supportContentAPI.createFormField(formId, payload)) as EditorSupportPage);
            onSaved(updated);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save field.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteContentModal
            title={isEdit ? 'Edit field' : 'Add field'}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                        {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add field'}
                    </button>
                </>
            }
        >
            {error ? <p className="site-content-error">{error}</p> : null}
            <div className="form-group">
                <label htmlFor="incident-field-label" className="form-label">
                    Label
                </label>
                <input
                    id="incident-field-label"
                    className="form-input"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="incident-field-type" className="form-label">
                    Type
                </label>
                <select
                    id="incident-field-type"
                    className="form-input"
                    value={type}
                    onChange={(event) => handleTypeChange(event.target.value as typeof type)}
                >
                    {INCIDENT_FIELD_TYPES.map((fieldType) => (
                        <option key={fieldType} value={fieldType}>
                            {INCIDENT_FIELD_TYPE_LABELS[fieldType]}
                        </option>
                    ))}
                </select>
            </div>
            {type === 'dropdown' ? (
                <div className="form-group">
                    <span className="form-label">Options</span>
                    <div className="custom-field-options-list">
                        {optionRows.map((option, index) => (
                            <div key={index} className="custom-field-option-row">
                                <input
                                    value={option}
                                    onChange={(event) =>
                                        setOptionRows((current) =>
                                            current.map((value, rowIndex) =>
                                                rowIndex === index ? event.target.value : value,
                                            ),
                                        )
                                    }
                                    placeholder={`Option ${index + 1}`}
                                    className="form-input"
                                    aria-label={`Option ${index + 1}`}
                                />
                                {optionRows.length > 2 ? (
                                    <button
                                        type="button"
                                        className="custom-field-option-remove"
                                        onClick={() =>
                                            setOptionRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                                        }
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
                        Add option
                    </button>
                </div>
            ) : null}
            <div className="site-content-toggle-row">
                <div className="site-content-toggle-copy">
                    <span className="site-content-toggle-label">Required</span>
                    <span className="site-content-toggle-hint">Must be completed before submitting.</span>
                </div>
                <Toggle checked={required} onChange={setRequired} aria-label="Required field" />
            </div>
            {isEdit ? (
                <div className="site-content-toggle-row">
                    <div className="site-content-toggle-copy">
                        <span className="site-content-toggle-label">Active</span>
                        <span className="site-content-toggle-hint">Inactive fields are hidden from the form.</span>
                    </div>
                    <Toggle checked={isActive} onChange={setIsActive} aria-label="Active field" />
                </div>
            ) : null}
        </SiteContentModal>
    );
}

interface AddFormModalProps {
    onClose: () => void;
    onCreated: (page: EditorSupportPage, newFormId: number) => void;
}

export function AddFormModal({ onClose, onCreated }: AddFormModalProps) {
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            setError('Form name is required.');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const updated = (await supportContentAPI.createForm({ label: trimmedLabel })) as EditorSupportPage;
            const newForm = updated.forms.find((form) => form.label === trimmedLabel && !form.isSystem);
            if (!newForm) {
                throw new Error('Failed to locate the new form.');
            }
            onCreated(updated, newForm.id);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create form');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteContentModal
            title="Add form"
            subtitle="Create a new incident report form. You can add fields after creating it."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                        {busy ? 'Creating…' : 'Create form'}
                    </button>
                </>
            }
        >
            {error ? <p className="site-content-error">{error}</p> : null}
            <div className="form-group">
                <label htmlFor="form-label" className="form-label">
                    Form name
                </label>
                <input
                    id="form-label"
                    className="form-input"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Equipment issue"
                />
            </div>
        </SiteContentModal>
    );
}

interface EditFormModalProps {
    form: EditorIncidentReportForm;
    onClose: () => void;
    onSaved: (page: EditorSupportPage) => void;
}

export function EditFormModal({ form, onClose, onSaved }: EditFormModalProps) {
    const [label, setLabel] = useState(form.label);
    const [isActive, setIsActive] = useState(form.isActive);
    const [fields, setFields] = useState(form.fields);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [editingField, setEditingField] = useState<EditorIncidentReportField | null>(null);
    const [showFieldModal, setShowFieldModal] = useState(false);
    const [deleteFieldTarget, setDeleteFieldTarget] = useState<EditorIncidentReportField | null>(null);

    const syncForm = (page: EditorSupportPage) => {
        const refreshed = page.forms.find((entry) => entry.id === form.id);
        if (refreshed) {
            setFields(refreshed.fields);
        }
        onSaved(page);
    };

    const saveForm = async () => {
        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            setError('Form name is required.');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const updated = (await supportContentAPI.updateForm(form.id, {
                label: trimmedLabel,
                isActive,
            })) as EditorSupportPage;
            syncForm(updated);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save form');
        } finally {
            setBusy(false);
        }
    };

    const moveField = async (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= fields.length) return;
        const order = fields.map((field, fieldIndex) => ({
            id: field.id,
            order: fieldIndex === index ? target : fieldIndex === target ? index : fieldIndex,
        }));
        setBusy(true);
        try {
            const updated = (await supportContentAPI.reorderFormFields(form.id, order)) as EditorSupportPage;
            syncForm(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reorder fields');
        } finally {
            setBusy(false);
        }
    };

    const confirmDeleteField = async () => {
        if (!deleteFieldTarget) return;
        setBusy(true);
        try {
            const updated = (await supportContentAPI.deleteFormField(form.id, deleteFieldTarget.id)) as EditorSupportPage;
            syncForm(updated);
            setDeleteFieldTarget(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete field');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <SiteContentModal
                title={form.isSystem ? 'Edit protected form' : 'Edit form'}
                subtitle={
                    form.isSystem
                        ? 'Protected forms cannot be deleted. Name, visibility, and fields can be edited.'
                        : 'Manage form settings and fields.'
                }
                onClose={onClose}
                wide
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => void saveForm()} disabled={busy}>
                            {busy ? 'Saving…' : 'Save form'}
                        </button>
                    </>
                }
            >
                {error ? <p className="site-content-error">{error}</p> : null}
                <div className="form-group">
                    <label htmlFor="edit-form-label" className="form-label">
                        Form name
                    </label>
                    <input
                        id="edit-form-label"
                        className="form-input"
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                    />
                </div>
                <div className="site-content-toggle-row">
                    <div className="site-content-toggle-copy">
                        <span className="site-content-toggle-label">Active</span>
                        <span className="site-content-toggle-hint">
                            Inactive forms are hidden from the portal and public website.
                        </span>
                    </div>
                    <Toggle checked={isActive} onChange={setIsActive} aria-label="Active form" />
                </div>

                <div className="site-content-form-fields-section">
                    <div className="site-content-form-fields-header">
                        <div>
                            <h3 className="site-content-form-fields-title">Fields</h3>
                            <p className="site-content-form-fields-subtitle">
                                Additional questions for this form beyond the fixed contact and description fields.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setShowFieldModal(true)}
                            disabled={busy}
                        >
                            Add field
                        </button>
                    </div>
                    <div className="site-content-section-list">
                        {fields.length ? (
                            fields.map((field, index) => (
                                <div key={field.id} className="site-content-section-row">
                                    <div>
                                        <p className="site-content-section-type">{field.type}</p>
                                        <h4 className="site-content-section-title">{field.label}</h4>
                                        <p className="site-content-section-meta">
                                            {field.required ? 'Required' : 'Optional'}
                                            {!field.isActive ? ' · Hidden' : ''}
                                        </p>
                                    </div>
                                    <div className="site-content-row-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => void moveField(index, -1)}
                                            disabled={busy || index === 0}
                                            aria-label="Move up"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => void moveField(index, 1)}
                                            disabled={busy || index === fields.length - 1}
                                            aria-label="Move down"
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => setEditingField(field)}
                                            disabled={busy}
                                            aria-label="Edit field"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-danger btn-icon"
                                            onClick={() => setDeleteFieldTarget(field)}
                                            disabled={busy}
                                            aria-label="Delete field"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="site-content-empty">No extra fields yet.</p>
                        )}
                    </div>
                </div>
            </SiteContentModal>

            {showFieldModal ? (
                <FormFieldModal
                    formId={form.id}
                    onClose={() => setShowFieldModal(false)}
                    onSaved={syncForm}
                />
            ) : null}

            {editingField ? (
                <FormFieldModal
                    formId={form.id}
                    field={editingField}
                    onClose={() => setEditingField(null)}
                    onSaved={syncForm}
                />
            ) : null}

            {deleteFieldTarget ? (
                <ConfirmDeleteModal
                    title="Delete field"
                    message="This field will be removed from the form."
                    itemLabel={deleteFieldTarget.label}
                    busy={busy}
                    onClose={() => setDeleteFieldTarget(null)}
                    onConfirm={confirmDeleteField}
                />
            ) : null}
        </>
    );
}

interface EditSupportNoticeModalProps {
    notice?: { id: number; locale: SupportLocale; content: string };
    onClose: () => void;
    onSaved: (page: EditorSupportPage) => void;
}

export function EditSupportNoticeModal({ notice, onClose, onSaved }: EditSupportNoticeModalProps) {
    const [locale, setLocale] = useState<SupportLocale>(notice?.locale ?? 'EN');
    const [content, setContent] = useState(notice?.content ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        if (!content.trim()) {
            setError('Content is required.');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const payload = { locale, content: content.trim() };
            const updated = notice
                ? ((await supportContentAPI.updateNotice(notice.id, payload)) as EditorSupportPage)
                : ((await supportContentAPI.createNotice(payload)) as EditorSupportPage);
            onSaved(updated);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save notice block');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteContentModal
            title={notice ? 'Edit guidance block' : 'Add guidance block'}
            subtitle="Bilingual guidance shown above the incident report form."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                        Save
                    </button>
                </>
            }
        >
            {error ? <p className="site-content-error">{error}</p> : null}
            <div className="form-group">
                <label htmlFor="support-notice-locale" className="form-label">
                    Language
                </label>
                <select
                    id="support-notice-locale"
                    className="form-input"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value as SupportLocale)}
                >
                    <option value="EN">English</option>
                    <option value="AR">Arabic</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="support-notice-content" className="form-label">
                    Content
                </label>
                <textarea
                    id="support-notice-content"
                    className="form-input form-textarea"
                    rows={10}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                />
            </div>
        </SiteContentModal>
    );
}
