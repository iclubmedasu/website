import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import { eventsAPI } from '@/services/api';
import AddCustomFieldModal from '@/features/Events/modals/AddCustomFieldModal';
import ImportRegistrationsModal from '@/features/Events/modals/ImportRegistrationsModal';
import { exportEventRegistrationsExcel } from '@/features/Events/components/registrationExcelExport';
import type {
    EventCustomFieldRef,
    EventRegistrationRef,
    EventRegistrationSourceGroup,
    EventTierRef,
    Id,
    ImportRegistrationsResult,
    ReorderEventCustomFieldsPayload,
    UpdateEventCustomFieldPayload,
} from '@/types/backend-contracts';
import {
    emptyAttendeeDraft,
    formatRegistrationSource,
    formatRegistrationStatus,
    REGISTRATION_SOURCE_GROUP_OPTIONS,
    validateAttendeeDraft,
    type AttendeeDraft,
} from '../customFieldUtils';
import CustomFieldColumnMenu from './CustomFieldColumnMenu';
import EditableCustomFieldCell from './EditableCustomFieldCell';
import EditableRegistrationContactCell from './EditableRegistrationContactCell';
import EventCheckInPanel from './EventCheckInSection';
import WalkInDraftFields from './WalkInDraftFields';
import { formatEventDuration, formatAttendanceDayLabel, isMultiDayEvent, isWithinEventDays } from '../../eventDateUtils';

interface EventRegistrationsSectionProps {
    eventId: Id | string;
    eventTitle?: string;
    tiers: EventTierRef[];
    fields: EventCustomFieldRef[];
    onFieldsChange: (fields: EventCustomFieldRef[]) => void;
    totalRegistered?: number;
    allowWalkIns?: boolean;
    eventDate?: string | null;
    eventEndDate?: string | null;
    onRegistrationAdded?: () => void;
    onCheckIn?: () => void;
    onImportComplete?: (result: ImportRegistrationsResult) => void;
}

export default function EventRegistrationsSection({
    eventId,
    eventTitle,
    tiers,
    fields,
    onFieldsChange,
    totalRegistered = 0,
    allowWalkIns = false,
    eventDate,
    eventEndDate,
    onRegistrationAdded,
    onCheckIn,
    onImportComplete,
}: EventRegistrationsSectionProps) {
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const [registrationSearch, setRegistrationSearch] = useState('');
    const [registrationTier, setRegistrationTier] = useState('');
    const [registrationCheckIn, setRegistrationCheckIn] = useState('');
    const [registrationSourceGroup, setRegistrationSourceGroup] = useState<EventRegistrationSourceGroup | ''>('');
    const [isAddingAttendee, setIsAddingAttendee] = useState(false);
    const [draft, setDraft] = useState<AttendeeDraft>(emptyAttendeeDraft);
    const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [fieldModalOpen, setFieldModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [editingField, setEditingField] = useState<EventCustomFieldRef | null>(null);
    const dragFieldId = useRef<number | null>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);

    const hasRegistrations = totalRegistered > 0;
    const sortedFields = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const withinEventDays = isWithinEventDays(eventDate, eventEndDate);
    const walkInsEnabled = allowWalkIns && withinEventDays;
    const canEditCustomFieldValues = withinEventDays;
    const eventDurationLabel = formatEventDuration(eventDate, eventEndDate ?? eventDate);
    const multiDayEvent = isMultiDayEvent(eventDate, eventEndDate);

    const loadRegistrations = useCallback(async () => {
        try {
            const result = await eventsAPI.getRegistrations(eventId, {
                tierId: registrationTier || undefined,
                checkInStatus: registrationCheckIn === 'CHECKED_IN' || registrationCheckIn === 'NOT_CHECKED_IN' || registrationCheckIn === 'CHECKED_IN_TODAY'
                    ? registrationCheckIn
                    : undefined,
                sourceGroup: registrationSourceGroup || undefined,
            });
            setRegistrations(result);
        } catch {
            setRegistrations([]);
        }
    }, [eventId, registrationCheckIn, registrationSourceGroup, registrationTier]);

    useEffect(() => {
        void loadRegistrations();
    }, [loadRegistrations]);

    useEffect(() => {
        if (isAddingAttendee && tableScrollRef.current) {
            tableScrollRef.current.scrollTop = 0;
            tableScrollRef.current.scrollLeft = 0;
        }
    }, [isAddingAttendee]);

    const handleCheckInSuccess = () => {
        void loadRegistrations();
        onCheckIn?.();
    };

    const handleUpdateField = async (field: EventCustomFieldRef, patch: UpdateEventCustomFieldPayload) => {
        const updated = await eventsAPI.updateCustomField(eventId, field.id, patch);
        onFieldsChange(fields.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveField = async (fieldId: number) => {
        try {
            await eventsAPI.removeCustomField(eventId, fieldId);
            onFieldsChange(fields.filter((item) => item.id !== fieldId));
        } catch {
            window.alert('Cannot delete this field after registrations exist.');
        }
    };

    const moveField = async (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= sortedFields.length || fromIndex === toIndex) return;
        const next = [...sortedFields];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onFieldsChange(next.map((field, index) => ({ ...field, order: index })));
        const payload: ReorderEventCustomFieldsPayload = {
            order: next.map((field, index) => ({ id: field.id, order: index })),
        };
        await eventsAPI.reorderCustomFields(eventId, payload);
    };

    const handleFieldSaved = (saved: EventCustomFieldRef) => {
        if (editingField) {
            onFieldsChange(fields.map((item) => (item.id === saved.id ? saved : item)));
        } else {
            onFieldsChange([...fields, saved]);
        }
        setEditingField(null);
    };

    const openFieldModal = () => {
        setEditingField(null);
        setFieldModalOpen(true);
    };

    const openDraft = () => {
        setDraft(emptyAttendeeDraft());
        setDraftErrors({});
        setIsAddingAttendee(true);
    };

    const closeDraft = () => {
        setIsAddingAttendee(false);
        setDraft(emptyAttendeeDraft());
        setDraftErrors({});
    };

    const handleDraftChange = (patch: Partial<AttendeeDraft>) => {
        setDraft((current) => ({ ...current, ...patch }));
    };

    const clearDraftError = (key: string) => {
        setDraftErrors((current) => {
            if (!current[key]) return current;
            const next = { ...current };
            delete next[key];
            return next;
        });
    };

    const updateDraftCustomField = (fieldKey: string, value: unknown) => {
        setDraft((current) => ({
            ...current,
            customFieldValues: { ...current.customFieldValues, [fieldKey]: value },
        }));
        clearDraftError(fieldKey);
    };

    const handleSaveAttendee = async () => {
        const errors = validateAttendeeDraft(draft, sortedFields);
        if (Object.keys(errors).length > 0) {
            setDraftErrors(errors);
            return;
        }

        setSaving(true);
        try {
            const customFieldValues = Object.fromEntries(
                sortedFields.map((field) => [String(field.id), draft.customFieldValues[String(field.id)] ?? null]),
            );
            const saved = await eventsAPI.createWalkInRegistration(eventId, {
                fullName: draft.fullName.trim(),
                email: draft.email.trim(),
                phoneNumber: draft.phoneNumber.trim() || null,
                tierId: draft.tierId || null,
                isWalkIn: true,
                customFieldValues,
            });
            setRegistrations((current) => {
                const existingIndex = current.findIndex((item) => item.id === saved.id);
                if (existingIndex >= 0) {
                    const next = [...current];
                    next[existingIndex] = saved;
                    return next;
                }
                return [saved, ...current];
            });
            closeDraft();
            onRegistrationAdded?.();
        } catch (error) {
            setDraftErrors({
                _form: error instanceof Error ? error.message : 'Failed to save attendee.',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRegistrationUpdated = (updated: EventRegistrationRef) => {
        setRegistrations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    };

    const filtered = registrations.filter((registration) => {
        const query = registrationSearch.trim().toLowerCase();
        if (!query) return true;
        return [registration.fullName, registration.email, registration.confirmationCode].some((value) => String(value || '').toLowerCase().includes(query));
    });

    const handleImportCompleted = (_importResult: ImportRegistrationsResult, refreshedFields: EventCustomFieldRef[]) => {
        onFieldsChange(refreshedFields);
        void loadRegistrations();
        onRegistrationAdded?.();
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const allRegistrations = await eventsAPI.getRegistrations(eventId);
            await exportEventRegistrationsExcel({
                registrations: allRegistrations,
                fields,
                multiDayEvent,
                fileName: eventTitle?.trim() || `event-${eventId}`,
            });
        } catch {
            window.alert('Failed to export registrations to Excel.');
        } finally {
            setExporting(false);
        }
    };

    const walkInDraftFieldProps = {
        draft,
        draftErrors,
        sortedFields,
        tiers,
        onDraftChange: handleDraftChange,
        onClearError: clearDraftError,
        onCustomFieldChange: updateDraftCustomField,
    };

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact">
               <div>
                    <h2 className="expanded-section-title">Registrations</h2>
                </div>
            </div>
            <div className="event-expanded-form-grid">
                <input value={registrationSearch} onChange={(e) => setRegistrationSearch(e.target.value)} placeholder="Search by name, email, or code" className="form-input" />
                <select aria-label="Filter by tier" value={registrationTier} onChange={(e) => setRegistrationTier(e.target.value)} className="form-input">
                    <option value="">All tiers</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
                <select aria-label="Filter by check-in status" value={registrationCheckIn} onChange={(e) => setRegistrationCheckIn(e.target.value)} className="form-input">
                    <option value="">Check-in status</option>
                    <option value="CHECKED_IN">Checked in</option>
                    <option value="NOT_CHECKED_IN">Not checked in</option>
                    {multiDayEvent && withinEventDays ? <option value="CHECKED_IN_TODAY">Checked in today</option> : null}
                </select>
                <select aria-label="Filter by source" value={registrationSourceGroup} onChange={(e) => setRegistrationSourceGroup(e.target.value as EventRegistrationSourceGroup | '')} className="form-input">
                    {REGISTRATION_SOURCE_GROUP_OPTIONS.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
            {draftErrors._form ? <p className="error-message">{draftErrors._form}</p> : null}
            <div className="event-registrations-layout">
                <div className="event-registrations-table-column">
                    <div className={`event-registrations-table-shell${isAddingAttendee ? ' event-registrations-table-shell--drafting' : ''}`}>
                        <div ref={tableScrollRef} className="table-container event-registrations-table-scroll">
                            <table className="members-table event-registrations-table">
                                <thead>
                                    <tr>
                                        <th className="event-registrations-name-cell">Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        {sortedFields.map((field, index) => (
                                            <th
                                                key={field.id}
                                                className="event-registrations-col-th"
                                                draggable
                                                onDragStart={() => { dragFieldId.current = Number(field.id); }}
                                                onDragOver={(event) => event.preventDefault()}
                                                onDrop={() => {
                                                    const fromIndex = sortedFields.findIndex((item) => Number(item.id) === dragFieldId.current);
                                                    dragFieldId.current = null;
                                                    if (fromIndex >= 0) void moveField(fromIndex, index);
                                                }}
                                            >
                                                <CustomFieldColumnMenu
                                                    field={field}
                                                    index={index}
                                                    total={sortedFields.length}
                                                    onEdit={() => {
                                                        setEditingField(field);
                                                        setFieldModalOpen(true);
                                                    }}
                                                    onToggleRequired={() => void handleUpdateField(field, { required: !field.required })}
                                                    onToggleShowOnPublic={() => void handleUpdateField(field, { showOnPublic: !field.showOnPublic })}
                                                    onDelete={() => void handleRemoveField(Number(field.id))}
                                                    onMoveLeft={() => void moveField(index, Math.max(0, index - 1))}
                                                    onMoveRight={() => void moveField(index, Math.min(sortedFields.length - 1, index + 1))}
                                                />
                                            </th>
                                        ))}
                                        <th>Tier</th>
                                        <th>Code</th>
                                        {multiDayEvent ? <th>Attendance</th> : null}
                                        <th>Status</th>
                                        <th>Source</th>
                                        <th>Registered</th>
                                        <th className="event-registrations-add-field-col">
                                            <button type="button" className="event-registrations-add-field-btn" onClick={openFieldModal}>
                                                <Plus size={14} />
                                                Add field
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isAddingAttendee ? (
                                        <tr className="event-registrations-row--draft">
                                            <WalkInDraftFields variant="table" {...walkInDraftFieldProps} />
                                        </tr>
                                    ) : null}
                                    {filtered.map((registration, index) => (
                                        <tr key={registration.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                            <EditableRegistrationContactCell
                                                eventId={eventId}
                                                registration={registration}
                                                field="fullName"
                                                editable={canEditCustomFieldValues}
                                                className="event-registrations-name-cell"
                                                onUpdated={handleRegistrationUpdated}
                                            />
                                            <EditableRegistrationContactCell
                                                eventId={eventId}
                                                registration={registration}
                                                field="email"
                                                editable={canEditCustomFieldValues}
                                                className="email-cell"
                                                onUpdated={handleRegistrationUpdated}
                                            />
                                            <EditableRegistrationContactCell
                                                eventId={eventId}
                                                registration={registration}
                                                field="phoneNumber"
                                                editable={canEditCustomFieldValues}
                                                onUpdated={handleRegistrationUpdated}
                                            />
                                            {sortedFields.map((field) => (
                                                <EditableCustomFieldCell
                                                    key={field.id}
                                                    eventId={eventId}
                                                    registration={registration}
                                                    field={field}
                                                    editable={canEditCustomFieldValues}
                                                    onUpdated={handleRegistrationUpdated}
                                                />
                                            ))}
                                            <td>{registration.tier?.name || '—'}</td>
                                            <td><code>{registration.confirmationCode}</code></td>
                                            {multiDayEvent ? (
                                                <td>
                                                    {registration.attendanceDays && registration.attendanceDays.length > 0 ? (
                                                        <span className="event-attendance-days">
                                                            {registration.attendanceDays.map((day) => (
                                                                <span key={day.eventDay} className="event-attendance-day-chip">
                                                                    {formatAttendanceDayLabel(day.eventDay)}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                            ) : null}
                                            <td>{formatRegistrationStatus(registration)}</td>
                                            <td>{formatRegistrationSource(registration)}</td>
                                            <td>{fmtDate(registration.createdAt) || '—'}</td>
                                            <td className="event-registrations-add-field-col" aria-hidden="true" />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {walkInsEnabled && isAddingAttendee ? (
                            <div className="event-registrations-table-footer event-registrations-table-footer--draft">
                                <WalkInDraftFields variant="stack" {...walkInDraftFieldProps} />
                                <div className="event-registrations-draft-footer-actions">
                                    <button type="button" onClick={() => void handleSaveAttendee()} className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving…' : 'Save walk-in'}
                                    </button>
                                    <button type="button" onClick={closeDraft} className="btn btn-secondary" disabled={saving}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : null}
                        {!isAddingAttendee ? (
                            <>
                                <div className="event-registrations-table-footer">
                                    {walkInsEnabled ? (
                                        <button type="button" className="add-attendee-btn" onClick={openDraft}>
                                            <Plus size={18} />
                                            Add walk-in
                                        </button>
                                    ) : null}
                                    {allowWalkIns && !withinEventDays ? (
                                        <p className="event-registrations-table-footer--muted">
                                            Walk-ins are available on event days only ({eventDurationLabel}).
                                        </p>
                                    ) : null}
                                    {!allowWalkIns ? (
                                        <p className="event-registrations-table-footer--muted">
                                            Enable walk-ins in event settings to add attendees here.
                                        </p>
                                    ) : null}
                                </div>
                                <div className="event-registrations-io-bar">
                                    <button
                                        type="button"
                                        className="event-registrations-io-btn"
                                        onClick={() => setImportModalOpen(true)}
                                    >
                                        <FileSpreadsheet size={18} />
                                        Import from Excel
                                    </button>
                                    <button
                                        type="button"
                                        className="event-registrations-io-btn"
                                        onClick={() => void handleExportExcel()}
                                        disabled={exporting}
                                    >
                                        <FileSpreadsheet size={18} />
                                        {exporting ? 'Exporting…' : 'Export Excel'}
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
                <aside className="event-registrations-checkin-column">
                    <EventCheckInPanel
                        eventId={eventId}
                        onCheckIn={handleCheckInSuccess}
                        suspended={fieldModalOpen || importModalOpen || isAddingAttendee}
                    />
                </aside>
            </div>

            {importModalOpen ? (
                <ImportRegistrationsModal
                    eventId={eventId}
                    tiers={tiers}
                    fields={fields}
                    onClose={() => setImportModalOpen(false)}
                    onImported={(importResult, refreshedFields) => {
                        handleImportCompleted(importResult, refreshedFields);
                    }}
                    onImportComplete={onImportComplete}
                />
            ) : null}

            {fieldModalOpen ? (
                <AddCustomFieldModal
                    eventId={eventId}
                    field={editingField}
                    lockTypeChange={Boolean(editingField && hasRegistrations)}
                    onClose={() => {
                        setFieldModalOpen(false);
                        setEditingField(null);
                    }}
                    onSaved={handleFieldSaved}
                />
            ) : null}
        </section>
    );
}
