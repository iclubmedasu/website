'use client';

import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Plus, Upload, X } from 'lucide-react';
import { Checkbox } from '@/components/checkbox';
import '@/components/FileUpload/FileUploadZone.css';
import { eventsAPI } from '@/services/api';
import { FIELD_TYPES } from '@/features/Events/modals/AddCustomFieldModal';
import type {
    EventCustomFieldRef,
    EventCustomFieldType,
    EventTierRef,
    Id,
    ImportRegistrationsResult,
    RegistrationImportColumnMapping,
} from '@/types/backend-contracts';
import {
    buildImportRows,
    buildNewFieldDrafts,
    extractDropdownOptionsFromColumn,
    formatSamplePreview,
    getMappedExcelColumns,
    getNormalizedOptions,
    getUnmappedExcelColumns,
    initializeCustomFieldMapping,
    normalizeOptionRows,
    parseRegistrationWorkbook,
    suggestStandardColumnMapping,
    type NewFieldImportDraft,
    type ParsedRegistrationWorkbook,
} from '../components/registrationExcelImport';

type ImportStep = 'upload' | 'mapping' | 'preview';

const NOT_IN_FILE = '';

interface ImportRegistrationsModalProps {
    eventId: Id | string;
    tiers: EventTierRef[];
    fields: EventCustomFieldRef[];
    onClose: () => void;
    onImported: (result: ImportRegistrationsResult, newFields: EventCustomFieldRef[]) => void;
    onImportComplete?: (result: ImportRegistrationsResult) => void;
}

function columnOptions(headers: string[]) {
    return [
        { value: NOT_IN_FILE, label: 'Not in file' },
        ...headers.map((header) => ({ value: header, label: header })),
    ];
}

function downloadErrorsCsv(errors: ImportRegistrationsResult['errors']) {
    const lines = ['row,email,message', ...errors.map((entry) => `${entry.row},"${entry.email ?? ''}","${entry.message.replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'registration-import-errors.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export default function ImportRegistrationsModal({
    eventId,
    tiers,
    fields,
    onClose,
    onImported,
    onImportComplete,
}: ImportRegistrationsModalProps) {
    const [step, setStep] = useState<ImportStep>('upload');
    const [parsed, setParsed] = useState<ParsedRegistrationWorkbook | null>(null);
    const [mapping, setMapping] = useState<RegistrationImportColumnMapping>({
        fullName: null,
        email: null,
        phoneNumber: null,
        tier: null,
        notes: null,
        customFields: {},
    });
    const [newFieldState, setNewFieldState] = useState<Record<string, NewFieldImportDraft>>({});
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportRegistrationsResult | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sortedFields = useMemo(
        () => [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [fields],
    );

    const unmappedForNewFields = useMemo(() => {
        if (!parsed) return [];
        return getUnmappedExcelColumns(parsed.headers, getMappedExcelColumns(mapping, []));
    }, [parsed, mapping]);

    const newFieldDrafts = useMemo(() => {
        if (!parsed) return [];
        return unmappedForNewFields.map((excelColumn) => {
            const saved = newFieldState[excelColumn];
            if (saved) return saved;
            return buildNewFieldDrafts(parsed.rows, [excelColumn])[0];
        });
    }, [parsed, unmappedForNewFields, newFieldState]);

    const previewRows = useMemo(() => {
        if (!parsed) return [];
        return buildImportRows(parsed.rows, mapping, newFieldDrafts, sortedFields, tiers).slice(0, 5);
    }, [parsed, mapping, newFieldDrafts, sortedFields, tiers]);

    const importPayload = useMemo(() => {
        if (!parsed) return null;
        const rows = buildImportRows(parsed.rows, mapping, newFieldDrafts, sortedFields, tiers);
        const newCustomFields = newFieldDrafts
            .filter((field) => field.mode === 'import')
            .map(({ excelColumn, label, type, optionRows, required }) => ({
                excelColumn,
                label,
                type,
                options: type === 'dropdown' ? getNormalizedOptions(optionRows) : undefined,
                required,
            }));
        return { rows, newCustomFields };
    }, [parsed, mapping, newFieldDrafts, sortedFields, tiers]);

    const canContinueFromMapping = Boolean(mapping.fullName);

    const handleFileChange = async (file: File | null) => {
        if (!file) return;
        setError('');
        try {
            const workbook = await parseRegistrationWorkbook(file);
            const suggested = suggestStandardColumnMapping(workbook.headers);
            const withCustomFields = initializeCustomFieldMapping(sortedFields, workbook.headers, suggested);
            setParsed(workbook);
            setMapping(withCustomFields);
            setNewFieldState({});
            setStep('mapping');
        } catch (parseError) {
            setError(parseError instanceof Error ? parseError.message : 'Failed to read the file.');
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0] ?? null;
        void handleFileChange(file);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
    };

    const updateStandardMapping = (key: keyof Pick<RegistrationImportColumnMapping, 'fullName' | 'email' | 'phoneNumber' | 'tier' | 'notes'>, value: string) => {
        setMapping((current) => ({
            ...current,
            [key]: value || null,
        }));
    };

    const updateCustomFieldMapping = (fieldId: string, value: string) => {
        setMapping((current) => ({
            ...current,
            customFields: {
                ...current.customFields,
                [fieldId]: value || null,
            },
        }));
    };

    const updateNewFieldDraft = (excelColumn: string, patch: Partial<NewFieldImportDraft>) => {
        setNewFieldState((current) => {
            const base = current[excelColumn] ?? buildNewFieldDrafts(parsed!.rows, [excelColumn])[0];
            return {
                ...current,
                [excelColumn]: { ...base, ...patch },
            };
        });
    };

    const handleNewFieldTypeChange = (excelColumn: string, nextType: EventCustomFieldType) => {
        if (!parsed) return;
        const columnValues = parsed.rows.map((row) => row[excelColumn] ?? '');
        const patch: Partial<NewFieldImportDraft> = { type: nextType };
        if (nextType === 'dropdown') {
            const options = extractDropdownOptionsFromColumn(columnValues);
            patch.options = options;
            patch.optionRows = normalizeOptionRows(options);
        } else {
            patch.options = undefined;
        }
        updateNewFieldDraft(excelColumn, patch);
    };

    const handleImport = async () => {
        if (!importPayload) return;
        setImporting(true);
        setError('');
        try {
            const importResult = await eventsAPI.importRegistrations(eventId, importPayload);
            setResult(importResult);
            const refreshedFields = await eventsAPI.getCustomFields(eventId);
            onImported(importResult, refreshedFields);
        } catch (importError) {
            setError(importError instanceof Error ? importError.message : 'Import failed.');
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        if (result && result.created > 0) {
            onImportComplete?.(result);
        }
        onClose();
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container import-registrations-modal" role="dialog" aria-modal="true" aria-labelledby="import-registrations-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="import-registrations-title">Import registrations from Excel</h2>
                        <p className="event-expanded-muted">
                            {step === 'upload' && 'Upload a spreadsheet with headers in the first row.'}
                            {step === 'mapping' && parsed ? `${parsed.fileName} · ${parsed.rows.length} rows` : null}
                            {step === 'preview' && parsed ? `Ready to import ${parsed.rows.length} rows` : null}
                        </p>
                    </div>
                </div>

                <div className="modal-body import-registrations-modal__body">
                    {error ? <p className="error-message">{error}</p> : null}

                    {step === 'upload' ? (
                        <>
                            <div
                                className={`file-drop-area${dragOver ? ' file-drop-area--active' : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                            >
                                <Upload size={24} className="file-drop-icon" />
                                <span className="file-drop-text">Drag &amp; drop a spreadsheet here or click to browse</span>
                            </div>
                            <p className="file-drop-hint">Excel or CSV · first worksheet · row 1 = column headers</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="file-input-hidden"
                                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                            />
                        </>
                    ) : null}

                    {step === 'mapping' && parsed ? (
                        <div className="import-registrations-mapping">
                            <section>
                                <h3 className="expanded-section-title expanded-section-title--sm">Map registration fields</h3>
                                <div className="import-registrations-mapping-table">
                                    {([
                                        ['fullName', 'Full name', true],
                                        ['email', 'Email', false],
                                        ['phoneNumber', 'Phone', false],
                                        ['tier', 'Tier', false],
                                        ['notes', 'Notes', false],
                                    ] as const).map(([key, label, required]) => (
                                        <div key={key} className="import-registrations-mapping-row">
                                            <span className={required ? 'import-registrations-mapping-label--required' : undefined}>{label}</span>
                                            <select
                                                className="form-input"
                                                value={mapping[key] ?? NOT_IN_FILE}
                                                onChange={(event) => updateStandardMapping(key, event.target.value)}
                                            >
                                                {columnOptions(parsed.headers).map((option) => (
                                                    <option key={`${key}-${option.value || 'none'}`} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}

                                    {sortedFields.map((field) => (
                                        <div key={field.id} className="import-registrations-mapping-row">
                                            <span className={field.required ? 'import-registrations-mapping-label--required' : undefined}>
                                                {field.label}
                                            </span>
                                            <select
                                                className="form-input"
                                                value={mapping.customFields[String(field.id)] ?? NOT_IN_FILE}
                                                onChange={(event) => updateCustomFieldMapping(String(field.id), event.target.value)}
                                            >
                                                {columnOptions(parsed.headers).map((option) => (
                                                    <option key={`${field.id}-${option.value || 'none'}`} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {newFieldDrafts.length > 0 ? (
                                <>
                                    <hr className="import-registrations-divider" />
                                    <section>
                                    <h3 className="expanded-section-title expanded-section-title--sm">Extra Excel columns</h3>
                                    <p className="event-expanded-muted">Create new registration fields from columns not mapped above.</p>
                                    <div className="import-registrations-new-fields">
                                        {newFieldDrafts.map((field) => {
                                            const columnValues = parsed.rows.map((row) => row[field.excelColumn] ?? '');
                                            const samplePreview = formatSamplePreview(columnValues);
                                            return (
                                                <div key={field.excelColumn} className="import-registrations-new-field-card">
                                                    <div className="import-registrations-new-field-card__header">
                                                        <strong>{field.excelColumn}</strong>
                                                        <span className="import-registrations-sample-preview event-expanded-muted">
                                                            {samplePreview || 'No sample values'}
                                                        </span>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label" htmlFor={`import-action-${field.excelColumn}`}>Action</label>
                                                        <select
                                                            id={`import-action-${field.excelColumn}`}
                                                            className="form-input"
                                                            value={field.mode}
                                                            onChange={(event) => updateNewFieldDraft(field.excelColumn, {
                                                                mode: event.target.value as 'skip' | 'import',
                                                            })}
                                                        >
                                                            <option value="skip">Skip column</option>
                                                            <option value="import">Import as new field</option>
                                                        </select>
                                                    </div>
                                                    {field.mode === 'import' ? (
                                                        <>
                                                            <div className="form-group">
                                                                <label className="form-label" htmlFor={`import-label-${field.excelColumn}`}>Label</label>
                                                                <input
                                                                    id={`import-label-${field.excelColumn}`}
                                                                    className="form-input"
                                                                    value={field.label}
                                                                    onChange={(event) => updateNewFieldDraft(field.excelColumn, { label: event.target.value })}
                                                                    placeholder="Field label"
                                                                />
                                                            </div>
                                                            <div className="form-group">
                                                                <label className="form-label" htmlFor={`import-type-${field.excelColumn}`}>Type</label>
                                                                <select
                                                                    id={`import-type-${field.excelColumn}`}
                                                                    className="form-input"
                                                                    value={field.type}
                                                                    onChange={(event) => handleNewFieldTypeChange(
                                                                        field.excelColumn,
                                                                        event.target.value as EventCustomFieldType,
                                                                    )}
                                                                >
                                                                    {FIELD_TYPES.map((type) => (
                                                                        <option key={type} value={type}>{type}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            {field.type === 'dropdown' ? (
                                                                <div className="form-group">
                                                                    <label className="form-label">Options</label>
                                                                    <div className="custom-field-options-list">
                                                                        {field.optionRows.map((option, index) => (
                                                                            <div key={index} className="custom-field-option-row">
                                                                                <input
                                                                                    value={option}
                                                                                    onChange={(event) => updateNewFieldDraft(field.excelColumn, {
                                                                                        optionRows: field.optionRows.map((value, rowIndex) => (
                                                                                            rowIndex === index ? event.target.value : value
                                                                                        )),
                                                                                    })}
                                                                                    placeholder={`Option ${index + 1}`}
                                                                                    className="form-input"
                                                                                    aria-label={`Option ${index + 1}`}
                                                                                />
                                                                                {field.optionRows.length > 2 ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="custom-field-option-remove"
                                                                                        onClick={() => updateNewFieldDraft(field.excelColumn, {
                                                                                            optionRows: field.optionRows.filter((_, rowIndex) => rowIndex !== index),
                                                                                        })}
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
                                                                        onClick={() => updateNewFieldDraft(field.excelColumn, {
                                                                            optionRows: [...field.optionRows, ''],
                                                                        })}
                                                                    >
                                                                        <Plus size={16} />
                                                                        Add more option
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                            <label className="toggle-field">
                                                                <Checkbox
                                                                    checked={field.required}
                                                                    onChange={(event) => updateNewFieldDraft(field.excelColumn, { required: event.target.checked })}
                                                                />
                                                                <span>
                                                                    <strong>Required</strong>
                                                                    <small>Must be completed when registering or at check-in if still empty.</small>
                                                                </span>
                                                            </label>
                                                        </>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                                </>
                            ) : null}
                        </div>
                    ) : null}

                    {step === 'preview' && parsed && importPayload ? (
                        <div className="import-registrations-preview">
                            <div className="import-registrations-summary">
                                <span><FileSpreadsheet size={16} /> {parsed.rows.length} rows</span>
                                <span>{importPayload.newCustomFields.length} new fields</span>
                            </div>
                            <div className="table-container">
                                <table className="members-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Tier</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, index) => (
                                            <tr key={`${row.fullName}-${row.email ?? index}`}>
                                                <td>{row.fullName || '—'}</td>
                                                <td>{row.email || '—'}</td>
                                                <td>{row.phoneNumber || '—'}</td>
                                                <td>{row.tierName || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {result ? (
                                <div className="import-registrations-result">
                                    <p>
                                        Created {result.created}, updated {result.updated}, skipped {result.skipped}.
                                    </p>
                                    {result.created > 0 ? (
                                        <p className="event-expanded-muted">
                                            Send ticket emails from the Tickets tab.
                                        </p>
                                    ) : null}
                                    {result.errors.length > 0 ? (
                                        <button type="button" className="btn btn-secondary" onClick={() => downloadErrorsCsv(result.errors)}>
                                            Download error report
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={importing}>
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {step === 'mapping' ? (
                        <>
                            <button type="button" className="btn btn-secondary" onClick={() => setStep('upload')}>
                                Back
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!canContinueFromMapping}
                                onClick={() => setStep('preview')}
                            >
                                Continue
                            </button>
                        </>
                    ) : null}
                    {step === 'preview' && !result ? (
                        <>
                            <button type="button" className="btn btn-secondary" onClick={() => setStep('mapping')} disabled={importing}>
                                Back
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => void handleImport()} disabled={importing}>
                                {importing ? 'Importing…' : 'Import'}
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        </>
    );
}
