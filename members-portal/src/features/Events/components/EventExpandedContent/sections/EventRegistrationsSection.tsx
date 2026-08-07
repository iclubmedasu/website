import { CLUB_TIMEZONE, formatSessionRange, toEventDayString } from '@iclub/shared/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResourceChannel } from '@/hooks/useResourceChannel';
import { Download, Filter, Plus, Search, Upload } from 'lucide-react';
import Toggle from '@/components/toggle/Toggle';
import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import { eventsAPI } from '@/services/api';
import AddCustomFieldModal from '@/features/Events/modals/AddCustomFieldModal';
import ImportRegistrationsModal from '@/features/Events/modals/ImportRegistrationsModal';
import RemoveAttendanceModal from '@/features/Events/modals/RemoveAttendanceModal';
import { exportEventRegistrationsExcel } from '@/features/Events/components/registrationExcelExport';
import type {
    EventCustomFieldRef,
    EventIdCardDesignRef,
    EventRegistrationRef,
    EventSessionRef,
    EventTierRef,
    Id,
    ImportRegistrationsResult,
    ReorderEventCustomFieldsPayload,
    UpdateEventCustomFieldPayload,
    UpdateEventRegistrationColumnsPayload,
} from '@/types/backend-contracts';
import {
    emptyAttendeeDraft,
    formatRegistrationSource,
    validateAttendeeDraft,
    type AttendeeDraft,
} from '../customFieldUtils';
import CustomFieldColumnMenu from './CustomFieldColumnMenu';
import SpecialColumnMenu from './SpecialColumnMenu';
import CopyPublicEventLinkButton from '../../CopyPublicEventLinkButton';
import GenerateEmbedButton from '../../GenerateEmbedButton';
import EditableCustomFieldCell from './EditableCustomFieldCell';
import EditableRegistrationContactCell from './EditableRegistrationContactCell';
import EditableRegistrationTierCell from './EditableRegistrationTierCell';
import EditableRegistrationSessionCell from './EditableRegistrationSessionCell';
import CollapsibleAttendanceChips, { type AttendanceRemovalTarget } from './CollapsibleAttendanceChips';
import EventCheckInPanel from './EventCheckInSection';
import {
    buildMiddleColumns,
    extractColumnOrderState,
    swapMiddleColumnOrders,
    type MiddleColumn,
} from '../registrationColumnOrderUtils';
import WalkInDraftFields from './WalkInDraftFields';
import SessionAttendanceOptions from './SessionAttendanceOptions';
import EventStaffModal from '@/features/Events/components/EventStaffModal';
import { useCheckInFlow } from '../useCheckInFlow';
import { formatEventDuration, getActiveSessionsNow, isMultiDayEvent, isWithinEventDays } from '../../eventDateUtils';
import RegistrationColumnFilterModal, {
    DEFAULT_REGISTRATION_SORT,
    EMPTY_REGISTRATION_SERVER_FILTERS,
    isRegistrationFunnelActive,
    RegistrationFilterChips,
    type RegistrationServerFilters,
} from './RegistrationColumnFilterModal';
import {
    applyRegistrationColumnFilters,
    applyRegistrationTextSearch,
    buildFilterableColumns,
    normalizeSortSpec,
    sortRegistrations,
    type RegistrationColumnFilter,
    type RegistrationSortSpec,
} from '../registrationTableFilterUtils';
import type { RegistrationTableFunnelState } from '../eventExpandedFunnelState';
import ExpandedSectionTitle from '../ExpandedSectionTitle';

interface EventRegistrationsSectionProps {
    eventId: Id | string;
    eventSlug?: string;
    eventTitle?: string;
    tiers: EventTierRef[];
    sessions?: EventSessionRef[];
    fields: EventCustomFieldRef[];
    onFieldsChange: (fields: EventCustomFieldRef[]) => void;
    totalRegistered?: number;
    allowWalkIns?: boolean;
    allowDirectCheckIn?: boolean;
    trackSessionCheckOut?: boolean;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    isPublished?: boolean;
    canPublishEvent?: boolean;
    canRemoveAttendance?: boolean;
    onPublishedChange?: (eventId: Id, published: boolean) => Promise<void>;
    canManageFields?: boolean;
    tierFieldShowOnPublic?: boolean;
    tierFieldRequired?: boolean;
    sessionFieldShowOnPublic?: boolean;
    sessionFieldRequired?: boolean;
    phoneFieldRequired?: boolean;
    sessionFieldOrder?: number;
    tierFieldOrder?: number;
    onRegistrationColumnsChange?: (columns: UpdateEventRegistrationColumnsPayload) => void;
    onRegistrationAdded?: () => void;
    onCheckIn?: () => void;
    onImportComplete?: (result: ImportRegistrationsResult) => void;
    funnel: RegistrationTableFunnelState;
    onFunnelChange: (
        next:
            | RegistrationTableFunnelState
            | ((prev: RegistrationTableFunnelState) => RegistrationTableFunnelState),
    ) => void;
    idCardDesign?: EventIdCardDesignRef | null;
}

export default function EventRegistrationsSection({
    eventId,
    eventSlug,
    eventTitle,
    tiers,
    sessions = [],
    fields,
    onFieldsChange,
    totalRegistered = 0,
    allowWalkIns = false,
    allowDirectCheckIn = false,
    trackSessionCheckOut = false,
    eventDate,
    eventEndDate,
    eventTimezone = CLUB_TIMEZONE,
    isPublished = false,
    canPublishEvent = false,
    canRemoveAttendance = false,
    onPublishedChange,
    canManageFields = false,
    tierFieldShowOnPublic = true,
    tierFieldRequired = true,
    sessionFieldShowOnPublic = false,
    sessionFieldRequired = false,
    phoneFieldRequired = false,
    sessionFieldOrder = 0,
    tierFieldOrder = 1,
    onRegistrationColumnsChange,
    onRegistrationAdded,
    onCheckIn,
    onImportComplete,
    funnel,
    onFunnelChange,
    idCardDesign,
}: EventRegistrationsSectionProps) {
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const registrationSearch = funnel.search;
    const columnFilters = funnel.columnFilters;
    const sortSpec = funnel.sortSpec;
    const serverFilters = funnel.serverFilters;
    const setRegistrationSearch = (search: string) => {
        onFunnelChange((prev) => ({ ...prev, search }));
    };
    const setColumnFilters = (
        next: RegistrationColumnFilter[] | ((current: RegistrationColumnFilter[]) => RegistrationColumnFilter[]),
    ) => {
        onFunnelChange((prev) => ({
            ...prev,
            columnFilters: typeof next === 'function' ? next(prev.columnFilters) : next,
        }));
    };
    const setSortSpec = (
        next: RegistrationSortSpec | ((current: RegistrationSortSpec) => RegistrationSortSpec),
    ) => {
        onFunnelChange((prev) => ({
            ...prev,
            sortSpec: typeof next === 'function' ? next(prev.sortSpec) : next,
        }));
    };
    const setServerFilters = (
        next: RegistrationServerFilters | ((current: RegistrationServerFilters) => RegistrationServerFilters),
    ) => {
        onFunnelChange((prev) => ({
            ...prev,
            serverFilters: typeof next === 'function' ? next(prev.serverFilters) : next,
        }));
    };
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [isAddingAttendee, setIsAddingAttendee] = useState(false);
    const [draft, setDraft] = useState<AttendeeDraft>(emptyAttendeeDraft);
    const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [fieldModalOpen, setFieldModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [attendanceRemovalTarget, setAttendanceRemovalTarget] = useState<AttendanceRemovalTarget | null>(null);
    const [removingAttendance, setRemovingAttendance] = useState(false);
    const [walkInAttendanceOpen, setWalkInAttendanceOpen] = useState(false);
    const [walkInAttendanceSessionId, setWalkInAttendanceSessionId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<EventCustomFieldRef | null>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);

    const hasRegistrations = totalRegistered > 0;
    const middleColumns = buildMiddleColumns(fields, sessionFieldOrder, tierFieldOrder);
    const sortedFields = middleColumns
        .filter((column): column is Extract<MiddleColumn, { kind: 'custom' }> => column.kind === 'custom')
        .map((column) => column.field);
    const withinEventDays = isWithinEventDays(eventDate, eventEndDate, new Date(), eventTimezone);
    const walkInsEnabled = allowWalkIns && withinEventDays;
    const directCheckInEnabled = allowDirectCheckIn && withinEventDays;
    const canEditCustomFieldValues = withinEventDays;
    const eventDurationLabel = formatEventDuration(eventDate, eventEndDate ?? eventDate);
    const multiDayEvent = isMultiDayEvent(eventDate, eventEndDate, eventTimezone);
    const activeSessionsNow = getActiveSessionsNow(sessions);
    const sessionDateById = new Map(
        sessions.map((session) => {
            const instant = session.startDateTime ?? session.sessionDate;
            const day = instant ? toEventDayString(instant, eventTimezone) : null;
            return [String(session.id), day ?? ''] as const;
        }),
    );
    const filterableColumns = useMemo(
        () => buildFilterableColumns('registrations', fields, tiers, sessions, multiDayEvent),
        [fields, multiDayEvent, sessions, tiers],
    );
    const tableContext = useMemo(() => ({
        tableKind: 'registrations' as const,
        fields,
        tiers,
        sessions,
        multiDayEvent,
    }), [fields, multiDayEvent, sessions, tiers]);

    useEffect(() => {
        setSortSpec((current) => normalizeSortSpec(current, filterableColumns));
    }, [filterableColumns]);

    useEffect(() => {
        setColumnFilters((current) => current.filter((filter) => (
            filterableColumns.some((column) => column.id === filter.columnId)
        )));
    }, [filterableColumns]);

    const loadRegistrations = useCallback(async () => {
        try {
            const result = await eventsAPI.getRegistrations(eventId, {
                tierId: serverFilters.tierId || undefined,
                checkInStatus: serverFilters.checkInStatus === 'CHECKED_IN'
                    || serverFilters.checkInStatus === 'NOT_CHECKED_IN'
                    || serverFilters.checkInStatus === 'CHECKED_IN_TODAY'
                    ? serverFilters.checkInStatus
                    : undefined,
                sourceGroup: serverFilters.sourceGroup || undefined,
            });
            setRegistrations(result);
        } catch {
            setRegistrations([]);
        }
    }, [eventId, serverFilters.checkInStatus, serverFilters.sourceGroup, serverFilters.tierId]);

    useEffect(() => {
        void loadRegistrations();
    }, [loadRegistrations]);

    const handleRemoteRefresh = useCallback(() => {
        void loadRegistrations();
        onCheckIn?.();
    }, [loadRegistrations, onCheckIn]);

    useResourceChannel({
        resource: 'event',
        resourceId: eventId,
        onRefresh: handleRemoteRefresh,
    });

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

    const checkInFlow = useCheckInFlow({
        eventId,
        onCheckIn: handleCheckInSuccess,
        tiers,
        sessions,
        tierFieldRequired,
        sessionFieldRequired,
        trackSessionCheckOut,
    });

    const {
        stationSessionId,
        setStationSessionId,
        setOpenInsideCount,
        sortedActiveSessions,
        handleCloseOpenAttendances,
        closingOpen,
        openInsideCount,
        loading: checkInLoading,
        showCombinedModal,
    } = checkInFlow;

    // Keep open-inside badge count in sync with loaded registrations for the station session.
    useEffect(() => {
        if (!trackSessionCheckOut || !stationSessionId) {
            setOpenInsideCount(0);
            return;
        }
        const count = registrations.reduce((total, registration) => {
            const hasOpen = (registration.sessionAttendances ?? []).some(
                (attendance) =>
                    String(attendance.sessionId) === stationSessionId
                    && attendance.mode === 'ONSITE'
                    && (attendance.isOpen === true
                        || (attendance.checkedOutAt == null && attendance.joinedAt)),
            );
            return total + (hasOpen ? 1 : 0);
        }, 0);
        setOpenInsideCount(count);
    }, [registrations, trackSessionCheckOut, stationSessionId, setOpenInsideCount]);

    const registrationHasOpenSegment = useCallback((registration: EventRegistrationRef, sessionId: string) => {
        return (registration.sessionAttendances ?? []).some(
            (attendance) =>
                String(attendance.sessionId) === sessionId
                && attendance.mode === 'ONSITE'
                && (attendance.isOpen === true
                    || (attendance.checkedOutAt == null && attendance.joinedAt)),
        );
    }, []);

    const resolveDirectCheckInSessionId = useCallback((registration: EventRegistrationRef): string | null => {
        if (stationSessionId) return stationSessionId;
        if (activeSessionsNow.length === 1) return String(activeSessionsNow[0].id);
        // Prefer any open segment if only one open session
        if (trackSessionCheckOut) {
            const openIds = (registration.sessionAttendances ?? [])
                .filter((attendance) =>
                    attendance.mode === 'ONSITE'
                    && (attendance.isOpen === true || attendance.checkedOutAt == null),
                )
                .map((attendance) => String(attendance.sessionId));
            const unique = Array.from(new Set(openIds));
            if (unique.length === 1) return unique[0];
        }
        return null;
    }, [activeSessionsNow, stationSessionId, trackSessionCheckOut]);

    const handlePublishToggle = async (nextPublished: boolean) => {
        if (!onPublishedChange || publishing) return;
        setPublishing(true);
        try {
            await onPublishedChange(eventId as Id, nextPublished);
        } catch {
            window.alert('Failed to update registration publish status.');
        } finally {
            setPublishing(false);
        }
    };

    const handleUpdateField = async (field: EventCustomFieldRef, patch: UpdateEventCustomFieldPayload) => {
        const updated = await eventsAPI.updateCustomField(eventId, field.id, patch);
        onFieldsChange(fields.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRegistrationColumnsChange = async (patch: UpdateEventRegistrationColumnsPayload) => {
        const updated = await eventsAPI.updateRegistrationColumns(eventId, patch);
        onRegistrationColumnsChange?.({
            tierFieldShowOnPublic: updated.tierFieldShowOnPublic,
            tierFieldRequired: updated.tierFieldRequired,
            sessionFieldShowOnPublic: updated.sessionFieldShowOnPublic,
            sessionFieldRequired: updated.sessionFieldRequired,
            phoneFieldRequired: updated.phoneFieldRequired,
            sessionFieldOrder: updated.sessionFieldOrder,
            tierFieldOrder: updated.tierFieldOrder,
        });
    };

    const persistMiddleColumnState = async (nextColumns: MiddleColumn[]) => {
        const state = extractColumnOrderState(nextColumns);
        onFieldsChange(state.fields);
        await handleRegistrationColumnsChange({
            sessionFieldOrder: state.sessionFieldOrder,
            tierFieldOrder: state.tierFieldOrder,
        });
        if (state.fields.some((field) => field.order !== fields.find((item) => item.id === field.id)?.order)) {
            const payload: ReorderEventCustomFieldsPayload = {
                order: state.fields.map((field, index) => ({ id: field.id, order: field.order ?? index })),
            };
            await eventsAPI.reorderCustomFields(eventId, payload);
        }
    };

    const moveMiddleColumn = async (index: number, direction: 'left' | 'right') => {
        const nextColumns = swapMiddleColumnOrders(middleColumns, index, direction);
        if (!nextColumns) return;
        await persistMiddleColumnState(nextColumns);
    };

    const handleRemoveField = async (fieldId: number) => {
        try {
            await eventsAPI.removeCustomField(eventId, fieldId);
            onFieldsChange(fields.filter((item) => item.id !== fieldId));
        } catch {
            window.alert('Cannot delete this field after registrations exist.');
        }
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
        setWalkInAttendanceOpen(false);
        setWalkInAttendanceSessionId(null);
    };

    const buildWalkInPayload = (attendanceSessionId?: string | null) => {
        const customFieldValues = Object.fromEntries(
            sortedFields.map((field) => [String(field.id), draft.customFieldValues[String(field.id)] ?? null]),
        );
        return {
            fullName: draft.fullName.trim(),
            email: draft.email.trim(),
            phoneNumber: draft.phoneNumber.trim() || null,
            tierId: draft.tierId || null,
            sessionIds: draft.sessionIds,
            ...(attendanceSessionId ? { sessionId: attendanceSessionId } : {}),
            isWalkIn: true,
            customFieldValues,
        };
    };

    const executeWalkInSave = async (attendanceSessionId?: string | null) => {
        setSaving(true);
        try {
            const saved = await eventsAPI.createWalkInRegistration(eventId, buildWalkInPayload(attendanceSessionId));
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
            setWalkInAttendanceOpen(false);
            setDraftErrors({
                _form: error instanceof Error ? error.message : 'Failed to save attendee.',
            });
        } finally {
            setSaving(false);
        }
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
        const errors = validateAttendeeDraft(draft, sortedFields, {
            tierFieldRequired,
            sessionFieldRequired,
            phoneFieldRequired,
        });
        if (Object.keys(errors).length > 0) {
            setDraftErrors(errors);
            return;
        }

        if (activeSessionsNow.length > 0) {
            setWalkInAttendanceSessionId(null);
            setWalkInAttendanceOpen(true);
            return;
        }

        await executeWalkInSave();
    };

    const handleConfirmWalkInAttendance = async () => {
        await executeWalkInSave(walkInAttendanceSessionId);
    };

    const handleCancelWalkInAttendance = () => {
        setWalkInAttendanceOpen(false);
        setWalkInAttendanceSessionId(null);
    };

    const handleRegistrationUpdated = (updated: EventRegistrationRef) => {
        setRegistrations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleConfirmRemoveAttendance = async () => {
        if (!attendanceRemovalTarget || removingAttendance) return;
        setRemovingAttendance(true);
        try {
            const updated = attendanceRemovalTarget.kind === 'onsite'
                ? await eventsAPI.removeRegistrationAttendance(
                    eventId,
                    attendanceRemovalTarget.registration.id,
                    { eventDay: attendanceRemovalTarget.eventDay },
                )
                : await eventsAPI.removeSessionAttendance(
                    eventId,
                    attendanceRemovalTarget.registration.id,
                    attendanceRemovalTarget.sessionAttendanceId,
                );
            handleRegistrationUpdated(updated);
            onCheckIn?.();
            setAttendanceRemovalTarget(null);
        } finally {
            setRemovingAttendance(false);
        }
    };

    const filtered = useMemo(() => {
        let rows = registrations;
        rows = applyRegistrationTextSearch(rows, registrationSearch);
        rows = applyRegistrationColumnFilters(rows, columnFilters, tableContext);
        rows = sortRegistrations(rows, sortSpec, tableContext);
        return rows;
    }, [columnFilters, registrationSearch, registrations, sortSpec, tableContext]);

    const hasFunnelFiltersActive = isRegistrationFunnelActive(columnFilters, sortSpec, serverFilters);

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
                sessions,
                multiDayEvent,
                fileName: eventTitle?.trim() || `event-${eventId}`,
                eventTimezone,
                trackSessionCheckOut,
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
        middleColumns,
        tiers,
        sessions,
        tierFieldRequired,
        sessionFieldRequired,
        phoneFieldRequired,
        multiDayEvent,
        onDraftChange: handleDraftChange,
        onClearError: clearDraftError,
        onCustomFieldChange: updateDraftCustomField,
    };

    const renderMiddleColumnHeader = (column: MiddleColumn, index: number) => {
        if (column.kind === 'sessions') {
            return (
                <th key="sessions" className="event-registrations-col-th">
                    {canManageFields ? (
                        <SpecialColumnMenu
                            label="Sessions"
                            required={sessionFieldRequired}
                            showOnPublic={sessionFieldShowOnPublic}
                            onToggleRequired={() => void handleRegistrationColumnsChange({
                                sessionFieldRequired: !sessionFieldRequired,
                            })}
                            onToggleShowOnPublic={() => void handleRegistrationColumnsChange({
                                sessionFieldShowOnPublic: !sessionFieldShowOnPublic,
                            })}
                            onMoveLeft={() => void moveMiddleColumn(index, 'left')}
                            onMoveRight={() => void moveMiddleColumn(index, 'right')}
                            canMoveLeft={index > 0}
                            canMoveRight={index < middleColumns.length - 1}
                        />
                    ) : 'Sessions'}
                </th>
            );
        }

        if (column.kind === 'tier') {
            return (
                <th key="tier" className="event-registrations-col-th">
                    {canManageFields ? (
                        <SpecialColumnMenu
                            label="Tier"
                            required={tierFieldRequired}
                            showOnPublic={tierFieldShowOnPublic}
                            onToggleRequired={() => void handleRegistrationColumnsChange({
                                tierFieldRequired: !tierFieldRequired,
                            })}
                            onToggleShowOnPublic={() => void handleRegistrationColumnsChange({
                                tierFieldShowOnPublic: !tierFieldShowOnPublic,
                            })}
                            onMoveLeft={() => void moveMiddleColumn(index, 'left')}
                            onMoveRight={() => void moveMiddleColumn(index, 'right')}
                            canMoveLeft={index > 0}
                            canMoveRight={index < middleColumns.length - 1}
                        />
                    ) : 'Tier'}
                </th>
            );
        }

        const fieldIndex = sortedFields.findIndex((field) => field.id === column.field.id);
        const field = column.field;
        return (
            <th key={field.id} className="event-registrations-col-th">
                {canManageFields ? (
                    <CustomFieldColumnMenu
                        field={field}
                        index={fieldIndex}
                        total={sortedFields.length}
                        onEdit={() => {
                            setEditingField(field);
                            setFieldModalOpen(true);
                        }}
                        onToggleRequired={() => void handleUpdateField(field, { required: !field.required })}
                        onToggleShowOnPublic={() => void handleUpdateField(field, { showOnPublic: !field.showOnPublic })}
                        onDelete={() => void handleRemoveField(Number(field.id))}
                        onMoveLeft={() => void moveMiddleColumn(index, 'left')}
                        onMoveRight={() => void moveMiddleColumn(index, 'right')}
                        canMoveLeft={index > 0}
                        canMoveRight={index < middleColumns.length - 1}
                    />
                ) : field.label}
            </th>
        );
    };

    const renderMiddleColumnCell = (column: MiddleColumn, registration: EventRegistrationRef) => {
        if (column.kind === 'sessions') {
            return (
                <EditableRegistrationSessionCell
                    key="sessions"
                    eventId={eventId}
                    registration={registration}
                    sessions={sessions}
                    editable={canEditCustomFieldValues}
                    onUpdated={handleRegistrationUpdated}
                />
            );
        }

        if (column.kind === 'tier') {
            return (
                <EditableRegistrationTierCell
                    key="tier"
                    eventId={eventId}
                    registration={registration}
                    tiers={tiers}
                    editable={canEditCustomFieldValues}
                    onUpdated={handleRegistrationUpdated}
                />
            );
        }

        return (
            <EditableCustomFieldCell
                key={column.field.id}
                eventId={eventId}
                registration={registration}
                field={column.field}
                editable={canEditCustomFieldValues}
                onUpdated={handleRegistrationUpdated}
            />
        );
    };

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact">
                <ExpandedSectionTitle label="Registrations" onReload={loadRegistrations} />
                <div className="event-expanded-header-actions">
                    <div className="event-expanded-copy-link">
                        <button
                            type="button"
                            className="event-expanded-copy-link-btn"
                            onClick={() => setImportModalOpen(true)}
                            aria-label="Import from Excel"
                            title="Import from Excel"
                        >
                            <Upload size={22} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="event-expanded-copy-link-btn"
                            onClick={() => void handleExportExcel()}
                            disabled={exporting}
                            aria-label={exporting ? 'Exporting…' : 'Export Excel'}
                            title={exporting ? 'Exporting…' : 'Export Excel'}
                        >
                            <Download size={22} strokeWidth={2} aria-hidden="true" />
                        </button>
                    </div>
                    <span className="event-expanded-header-divider" aria-hidden="true" />
                    {canPublishEvent ? (
                        <>
                            <div className="event-expanded-publish-toggle">
                                <span className="event-expanded-publish-toggle-label">Accept registrations (publish to public website)</span>
                                <Toggle
                                    color="purple"
                                    checked={isPublished}
                                    disabled={publishing}
                                    onChange={(next) => void handlePublishToggle(next)}
                                    aria-label="Accept registrations on public website"
                                />
                            </div>
                            <span className="event-expanded-header-divider" aria-hidden="true" />
                        </>
                    ) : null}
                    <CopyPublicEventLinkButton eventSlug={eventSlug || String(eventId)} isPublished={isPublished} />
                    <span className="event-expanded-header-divider" aria-hidden="true" />
                    <GenerateEmbedButton eventSlug={eventSlug || String(eventId)} isPublished={isPublished} />
                </div>
            </div>
            <div className="event-registrations-layout">
                <div className="event-registrations-table-column">
                    <div className="page-search-row event-registration-search-row">
                        <div className="page-search-field page-search-field--full event-registration-search-field">
                            <Search className="page-search-icon" size={16} />
                            <input
                                type="search"
                                className="page-search-input"
                                value={registrationSearch}
                                onChange={(e) => setRegistrationSearch(e.target.value)}
                                placeholder="Search by name, email, phone, or code"
                                aria-label="Search registrations"
                            />
                            <button
                                type="button"
                                className={`page-search-filter-btn${hasFunnelFiltersActive ? ' page-search-filter-btn--active' : ''}`}
                                onClick={() => setFilterModalOpen(true)}
                                aria-label="Open sort and filters"
                            >
                                <Filter size={16} />
                                <span className="page-search-filter-label">Sort & Filters</span>
                            </button>
                        </div>
                    </div>
                    <RegistrationFilterChips
                        filters={columnFilters}
                        serverFilters={serverFilters}
                        columns={filterableColumns}
                        context={tableContext}
                        tiers={tiers}
                        onRemove={(index) => setColumnFilters((current) => current.filter((_, filterIndex) => filterIndex !== index))}
                        onRemoveServerFilter={(key) => {
                            setServerFilters((current) => ({ ...current, [key]: EMPTY_REGISTRATION_SERVER_FILTERS[key] }));
                        }}
                        onClearAll={() => {
                            setColumnFilters([]);
                            setServerFilters(EMPTY_REGISTRATION_SERVER_FILTERS);
                        }}
                    />
                    <RegistrationColumnFilterModal
                        open={filterModalOpen}
                        columns={filterableColumns}
                        activeFilters={columnFilters}
                        sortSpec={sortSpec}
                        serverFilters={serverFilters}
                        serverFilterConfig={{
                            showTier: true,
                            showSource: true,
                            showCheckIn: true,
                            showCheckedInToday: multiDayEvent && withinEventDays,
                        }}
                        context={tableContext}
                        tiers={tiers}
                        sessions={sessions}
                        onClose={() => setFilterModalOpen(false)}
                        onApply={(filters, nextSort, nextServerFilters) => {
                            setColumnFilters(filters);
                            setSortSpec(nextSort);
                            setServerFilters({
                                ...EMPTY_REGISTRATION_SERVER_FILTERS,
                                tierId: nextServerFilters.tierId,
                                sourceGroup: nextServerFilters.sourceGroup,
                                checkInStatus: nextServerFilters.checkInStatus,
                            });
                        }}
                        onClear={() => {
                            setColumnFilters([]);
                            setSortSpec(DEFAULT_REGISTRATION_SORT);
                            setServerFilters(EMPTY_REGISTRATION_SERVER_FILTERS);
                        }}
                    />
                    {draftErrors._form ? <p className="error-message">{draftErrors._form}</p> : null}
                    <div className={`event-registrations-table-shell${isAddingAttendee ? ' event-registrations-table-shell--drafting' : ''}`}>
                        <div ref={tableScrollRef} className="table-container event-registrations-table-scroll">
                            <table className="members-table event-registrations-table">
                                <thead>
                                    <tr>
                                        <th className="event-registrations-name-cell">Name</th>
                                        <th>Email</th>
                                        <th className="event-registrations-col-th">
                                            {canManageFields ? (
                                                <SpecialColumnMenu
                                                    label="Phone"
                                                    required={phoneFieldRequired}
                                                    onToggleRequired={() => void handleRegistrationColumnsChange({
                                                        phoneFieldRequired: !phoneFieldRequired,
                                                    })}
                                                />
                                            ) : 'Phone'}
                                        </th>
                                        {middleColumns.map((column, index) => renderMiddleColumnHeader(column, index))}
                                        <th>Code</th>
                                        {multiDayEvent || trackSessionCheckOut ? <th>Attendance</th> : null}
                                        {/* Status column hidden */}
                                        {/* <th className="event-registrations-status-cell">Status</th> */}
                                        <th>Source</th>
                                        <th>Registered</th>
                                        <th className="event-registrations-add-field-col">
                                            {canManageFields ? (
                                                <button type="button" className="event-registrations-add-field-btn" onClick={openFieldModal}>
                                                    <Plus size={14} />
                                                    Add field
                                                </button>
                                            ) : null}
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
                                                onCheckIn={directCheckInEnabled
                                                    ? () => void checkInFlow.processConfirmationCode(registration.confirmationCode, 'table')
                                                    : undefined}
                                                checkInDisabled={registration.status === 'CANCELLED' || checkInFlow.loading}
                                                checkInTitle={
                                                    trackSessionCheckOut
                                                        && (() => {
                                                            const sid = resolveDirectCheckInSessionId(registration);
                                                            return sid && registrationHasOpenSegment(registration, sid)
                                                                ? 'Check out attendee'
                                                                : 'Check in attendee';
                                                        })()
                                                    || 'Check in attendee'
                                                }
                                                checkInVariant={
                                                    trackSessionCheckOut
                                                        && (() => {
                                                            const sid = resolveDirectCheckInSessionId(registration);
                                                            return sid && registrationHasOpenSegment(registration, sid)
                                                                ? 'checkout'
                                                                : 'checkin';
                                                        })()
                                                    || 'checkin'
                                                }
                                            />
                                            <EditableRegistrationContactCell
                                                eventId={eventId}
                                                registration={registration}
                                                field="email"
                                                editable={canEditCustomFieldValues}
                                                className="event-registrations-email-cell"
                                                onUpdated={handleRegistrationUpdated}
                                            />
                                            <EditableRegistrationContactCell
                                                eventId={eventId}
                                                registration={registration}
                                                field="phoneNumber"
                                                editable={canEditCustomFieldValues}
                                                phoneFieldRequired={phoneFieldRequired}
                                                className="event-registrations-phone-cell"
                                                onUpdated={handleRegistrationUpdated}
                                            />
                                            {middleColumns.map((column) => renderMiddleColumnCell(column, registration))}
                                            <td><code>{registration.confirmationCode}</code></td>
                                            {multiDayEvent || trackSessionCheckOut ? (
                                                <td>
                                                    <CollapsibleAttendanceChips
                                                        registration={registration}
                                                        sessionDateById={sessionDateById}
                                                        sessions={sessions}
                                                        trackSessionCheckOut={trackSessionCheckOut}
                                                        canRemoveAttendance={canRemoveAttendance}
                                                        collapsible={multiDayEvent || trackSessionCheckOut}
                                                        onRequestRemoval={setAttendanceRemovalTarget}
                                                    />
                                                </td>
                                            ) : null}
                                            {/* Status column hidden */}
                                            {/* <td className="event-registrations-status-cell">{formatRegistrationStatus(registration)}</td> */}
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
                                <div className="event-registrations-table-footer event-registrations-footer-bar">
                                    <div className="event-registrations-footer-bar__left">
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
                                    {trackSessionCheckOut && sortedActiveSessions.length > 0 ? (
                                        <div className="event-registrations-footer-bar__right">
                                            <div className="event-registrations-footer-station">
                                                <select
                                                    className="form-input event-registrations-footer-station__select"
                                                    value={stationSessionId}
                                                    disabled={
                                                        checkInLoading
                                                        || showCombinedModal
                                                        || fieldModalOpen
                                                        || importModalOpen
                                                        || walkInAttendanceOpen
                                                    }
                                                    onChange={(event) => setStationSessionId(event.target.value)}
                                                    aria-label="Session to track at this station"
                                                >
                                                    <option value="">Any / ask each scan…</option>
                                                    {sortedActiveSessions.map((session) => {
                                                        const title = session.label?.trim() || 'Untitled session';
                                                        const range = session.startDateTime && session.endDateTime
                                                            ? formatSessionRange(session.startDateTime, session.endDateTime)
                                                            : null;
                                                        const label = [title, range].filter(Boolean).join(' · ');
                                                        return (
                                                            <option key={session.id} value={String(session.id)}>
                                                                {label}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary event-registrations-footer-station__close"
                                                    disabled={
                                                        checkInLoading
                                                        || showCombinedModal
                                                        || fieldModalOpen
                                                        || importModalOpen
                                                        || walkInAttendanceOpen
                                                        || !stationSessionId
                                                        || closingOpen
                                                    }
                                                    onClick={() => void handleCloseOpenAttendances()}
                                                    title="Close all open check-ins for the selected session"
                                                >
                                                    {closingOpen
                                                        ? 'Closing…'
                                                        : openInsideCount > 0
                                                            ? `Close all still inside (${openInsideCount})`
                                                            : 'Close all still inside'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
                <aside className="event-registrations-checkin-column">
                    <EventCheckInPanel
                        eventId={eventId}
                        checkInFlow={checkInFlow}
                        suspended={fieldModalOpen || importModalOpen || isAddingAttendee || walkInAttendanceOpen || checkInFlow.showCombinedModal}
                        tiers={tiers}
                        fields={fields}
                        idCardDesign={idCardDesign}
                    />
                </aside>
            </div>

            <EventStaffModal
                open={walkInAttendanceOpen}
                title="Session attendance"
                subtitle={`${draft.fullName.trim() || 'Walk-in attendee'} — choose how to record attendance for this check-in.`}
                titleId="walkin-attendance-title"
                onClose={handleCancelWalkInAttendance}
                closeDisabled={saving}
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={handleCancelWalkInAttendance}
                            className="btn btn-secondary"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleConfirmWalkInAttendance()}
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save walk-in'}
                        </button>
                    </>
                )}
            >
                <SessionAttendanceOptions
                    activeSessionsNow={activeSessionsNow}
                    selectedSessionId={walkInAttendanceSessionId}
                    onSelectSessionId={setWalkInAttendanceSessionId}
                    radioName="walkin-session"
                />
            </EventStaffModal>

            {importModalOpen ? (
                <ImportRegistrationsModal
                    eventId={eventId}
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

            {attendanceRemovalTarget ? (
                <RemoveAttendanceModal
                    attendeeName={attendanceRemovalTarget.registration.fullName}
                    dayLabel={attendanceRemovalTarget.dayLabel}
                    onClose={() => {
                        if (!removingAttendance) setAttendanceRemovalTarget(null);
                    }}
                    onConfirm={handleConfirmRemoveAttendance}
                />
            ) : null}
        </section>
    );
}
