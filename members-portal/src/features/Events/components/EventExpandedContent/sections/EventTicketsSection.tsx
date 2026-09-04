import { CLUB_TIMEZONE, toEventDayString } from '@iclub/shared/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Filter, Loader2, Mail, Search } from 'lucide-react';
import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import { Checkbox } from '@/components/checkbox';
import { useResourceChannel } from '@/hooks/useResourceChannel';
import { eventsAPI } from '@/services/api';
import type {
    EventCustomFieldRef,
    EventIdCardDesignRef,
    EventRegistrationRef,
    EventSessionRef,
    EventTicketDesignRef,
    EventTierRef,
    Id,
    SendRegistrationTicketsResult,
} from '@/types/backend-contracts';
import {
    formatReminderEmailStatus,
    formatTicketEmailStatus,
    getSendableRegistrations,
    isImportPlaceholderEmail,
    REGISTRATION_EMAIL_DISPLAY_LIMIT,
    REGISTRATION_NAME_DISPLAY_LIMIT,
    truncateRegistrationCell,
} from '../customFieldUtils';
import { isMultiDayEvent, isWithinEventDays, enumerateEventDays } from '../../eventDateUtils';
import CollapsibleAttendanceChips, { type AttendanceRemovalTarget } from './CollapsibleAttendanceChips';
import RemoveAttendanceModal from '@/features/Events/modals/RemoveAttendanceModal';
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
import TicketDesignPanel from './TicketDesign/TicketDesignPanel';
import IdCardDesignPanel from './IdCardDesign/IdCardDesignPanel';

interface EventTicketsSectionProps {
    eventId: Id | string;
    eventTitle?: string;
    eventDescription?: string | null;
    eventVenue?: string | null;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    sessions?: EventSessionRef[];
    tiers?: EventTierRef[];
    fields?: EventCustomFieldRef[];
    ticketDesign?: EventTicketDesignRef | null;
    idCardDesign?: EventIdCardDesignRef | null;
    canRemoveAttendance?: boolean;
    funnel: RegistrationTableFunnelState;
    onFunnelChange: (
        next:
            | RegistrationTableFunnelState
            | ((prev: RegistrationTableFunnelState) => RegistrationTableFunnelState),
    ) => void;
    onReload: () => void;
}

function formatBulkSummary(result: SendRegistrationTicketsResult, label: string): string {
    return [
        `${label}: ${result.sent}`,
        result.skipped > 0 ? `Skipped: ${result.skipped}` : '',
        result.failed > 0 ? `Failed: ${result.failed}` : '',
    ].filter(Boolean).join('\n');
}

function EmailDeliveryStatusCell({
    status,
}: {
    status: { label: string; sent: boolean; sentAt?: string | null };
}) {
    return (
        <div className="event-email-delivery-status">
            <span className={`status-badge${status.sent ? ' active' : ' away'}`}>
                {status.label}
            </span>
            {status.sent && status.sentAt ? (
                <span className="event-email-delivery-status__date">{fmtDate(status.sentAt)}</span>
            ) : null}
        </div>
    );
}

export default function EventTicketsSection({
    eventId,
    eventTitle = 'Event',
    eventDescription,
    eventVenue,
    eventDate,
    eventEndDate,
    eventTimezone = CLUB_TIMEZONE,
    sessions = [],
    tiers = [],
    fields = [],
    ticketDesign,
    idCardDesign,
    canRemoveAttendance = false,
    funnel,
    onFunnelChange,
    onReload,
}: EventTicketsSectionProps) {
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const ticketSearch = funnel.search;
    const columnFilters = funnel.columnFilters;
    const sortSpec = funnel.sortSpec;
    const serverFilters = funnel.serverFilters;
    const setTicketSearch = (search: string) => {
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
    const [resendingTicketId, setResendingTicketId] = useState<number | null>(null);
    const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
    const [bulkAction, setBulkAction] = useState<'tickets' | 'reminders' | null>(null);
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const [attendanceRemovalTarget, setAttendanceRemovalTarget] = useState<AttendanceRemovalTarget | null>(null);
    const [removingAttendance, setRemovingAttendance] = useState(false);

    const withinEventDays = isWithinEventDays(eventDate, eventEndDate, new Date(), eventTimezone);
    const multiDayEvent = isMultiDayEvent(eventDate, eventEndDate, eventTimezone);
    const eventDays = useMemo(
        () => enumerateEventDays(eventDate, eventEndDate, eventTimezone),
        [eventDate, eventEndDate, eventTimezone],
    );
    const sessionDateById = new Map(
        sessions.map((session) => {
            const instant = session.startDateTime ?? session.sessionDate;
            const day = instant ? toEventDayString(instant, eventTimezone) : null;
            return [String(session.id), day ?? ''] as const;
        }),
    );
    const columnCount = multiDayEvent ? 7 : 6;
    const filterableColumns = useMemo(
        () => buildFilterableColumns('tickets', fields, tiers, sessions, eventDays),
        [eventDays, fields, sessions, tiers],
    );
    const tableContext = useMemo(() => ({
        tableKind: 'tickets' as const,
        fields,
        tiers,
        sessions,
        eventDays,
    }), [eventDays, fields, sessions, tiers]);

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
                checkInStatus: serverFilters.checkInStatus === 'CHECKED_IN'
                    || serverFilters.checkInStatus === 'NOT_CHECKED_IN'
                    || serverFilters.checkInStatus === 'CHECKED_IN_TODAY'
                    ? serverFilters.checkInStatus
                    : undefined,
                sourceGroup: serverFilters.sourceGroup || undefined,
                ticketStatus: serverFilters.ticketStatus || undefined,
                reminderStatus: serverFilters.reminderStatus || undefined,
            });
            setRegistrations(result);
        } catch {
            setRegistrations([]);
        }
    }, [
        eventId,
        serverFilters.checkInStatus,
        serverFilters.reminderStatus,
        serverFilters.sourceGroup,
        serverFilters.ticketStatus,
    ]);

    const refreshAll = useCallback(async () => {
        await loadRegistrations();
    }, [loadRegistrations]);

    useResourceChannel({
        resource: 'event',
        resourceId: eventId,
        onRefresh: () => {
            void refreshAll();
        },
    });

    useEffect(() => {
        void loadRegistrations();
    }, [loadRegistrations]);

    const filtered = useMemo(() => {
        let rows = registrations;
        rows = applyRegistrationTextSearch(rows, ticketSearch);
        rows = applyRegistrationColumnFilters(rows, columnFilters, tableContext);
        rows = sortRegistrations(rows, sortSpec, tableContext);
        return rows;
    }, [columnFilters, registrations, sortSpec, tableContext, ticketSearch]);

    const hasFunnelFiltersActive = isRegistrationFunnelActive(columnFilters, sortSpec, serverFilters);

    const filteredSendable = useMemo(
        () => getSendableRegistrations(filtered),
        [filtered],
    );

    const filteredSendableKeys = useMemo(
        () => filteredSendable.map((registration) => String(registration.id)),
        [filteredSendable],
    );

    const selectedVisibleCount = useMemo(() => {
        let count = 0;
        for (const key of filteredSendableKeys) {
            if (selection.has(key)) count += 1;
        }
        return count;
    }, [filteredSendableKeys, selection]);

    const canSendEmail = (registration: EventRegistrationRef) => (
        registration.status !== 'CANCELLED'
        && Boolean(registration.email?.trim())
        && !isImportPlaceholderEmail(registration.email)
    );

    const toggleSelection = (registration: EventRegistrationRef) => {
        if (!canSendEmail(registration)) return;
        const key = String(registration.id);
        setSelection((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectAllFiltered = () => {
        setSelection(new Set(filteredSendableKeys));
    };

    const clearSelection = () => {
        setSelection(new Set());
    };

    const getSelectedVisibleRegistrationIds = () => {
        const visibleKeys = new Set(filteredSendableKeys);
        return filteredSendable
            .filter((registration) => {
                const key = String(registration.id);
                return selection.has(key) && visibleKeys.has(key);
            })
            .map((registration) => Number(registration.id));
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
            setAttendanceRemovalTarget(null);
        } finally {
            setRemovingAttendance(false);
        }
    };

    const handleResendTicket = async (registration: EventRegistrationRef) => {
        if (!canSendEmail(registration)) return;

        setResendingTicketId(Number(registration.id));
        try {
            const result = await eventsAPI.resendRegistrationTicket(eventId, registration.id);
            window.alert(result.message || 'Ticket email sent.');
            void refreshAll();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to send ticket email.');
        } finally {
            setResendingTicketId(null);
        }
    };

    const handleSendReminder = async (registration: EventRegistrationRef) => {
        if (!canSendEmail(registration)) return;

        setSendingReminderId(Number(registration.id));
        try {
            const result = await eventsAPI.resendRegistrationReminder(eventId, registration.id);
            window.alert(result.message || 'Reminder email sent.');
            void refreshAll();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to send reminder email.');
        } finally {
            setSendingReminderId(null);
        }
    };

    const handleSendSelectedTickets = async () => {
        const registrationIds = getSelectedVisibleRegistrationIds();
        if (registrationIds.length === 0) return;

        if (!window.confirm(`Send tickets to ${registrationIds.length} selected registrant(s)?`)) {
            return;
        }

        setBulkAction('tickets');
        try {
            const result = await eventsAPI.sendRegistrationTickets(eventId, { registrationIds });
            window.alert(formatBulkSummary(result, 'Tickets sent'));
            void refreshAll();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to send ticket emails.');
        } finally {
            setBulkAction(null);
        }
    };

    const handleSendSelectedReminders = async () => {
        const registrationIds = getSelectedVisibleRegistrationIds();
        if (registrationIds.length === 0) return;

        if (!window.confirm(`Send reminders to ${registrationIds.length} selected registrant(s)?`)) {
            return;
        }

        setBulkAction('reminders');
        try {
            const result = await eventsAPI.sendRegistrationReminders(eventId, { registrationIds });
            window.alert(formatBulkSummary(result, 'Reminders sent'));
            void refreshAll();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to send reminder emails.');
        } finally {
            setBulkAction(null);
        }
    };

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact event-tickets-header">
                <ExpandedSectionTitle label="Tickets" onReload={refreshAll} />
            </div>

            <div className="event-tickets-layout">
                <div className="event-tickets-table-column">
                    <div className="page-search-row event-registration-search-row">
                        <div className="page-search-field page-search-field--full event-registration-search-field">
                            <Search className="page-search-icon" size={16} />
                            <input
                                type="search"
                                className="page-search-input"
                                value={ticketSearch}
                                onChange={(event) => setTicketSearch(event.target.value)}
                                placeholder="Search by name, email, or code"
                                aria-label="Search tickets"
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
                            showSource: true,
                            showCheckIn: true,
                            showTicketStatus: true,
                            showReminderStatus: true,
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
                                sourceGroup: nextServerFilters.sourceGroup,
                                checkInStatus: nextServerFilters.checkInStatus,
                                ticketStatus: nextServerFilters.ticketStatus,
                                reminderStatus: nextServerFilters.reminderStatus,
                            });
                        }}
                        onClear={() => {
                            setColumnFilters([]);
                            setSortSpec(DEFAULT_REGISTRATION_SORT);
                            setServerFilters(EMPTY_REGISTRATION_SERVER_FILTERS);
                        }}
                    />

                    <div className="event-registrations-table-shell event-tickets-table-shell">
                        <div className="table-container event-registrations-table-scroll">
                            <table className="members-table event-registrations-table">
                                <thead>
                                    <tr>
                                        <th aria-label="Select" />
                                        <th className="event-registrations-name-cell">Name</th>
                                        <th className="event-registrations-email-cell">Email</th>
                                        {multiDayEvent ? <th>Attendance</th> : null}
                                        <th className="event-tickets-delivery-col">Ticket</th>
                                        <th className="event-tickets-delivery-col">Reminder</th>
                                        <th className="event-registrations-actions-col">Actions</th>
                                        {/* Source and Check-in columns hidden */}
                                        {/* <th>Source</th> */}
                                        {/* <th className="event-registrations-status-cell">Check-in</th> */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={columnCount} className="event-tickets-empty">No registrations match these filters.</td>
                                        </tr>
                                    ) : filtered.map((registration, index) => {
                                        const ticketStatus = formatTicketEmailStatus(registration);
                                        const reminderStatus = formatReminderEmailStatus(registration);
                                        const sendable = canSendEmail(registration);
                                        const registrationKey = String(registration.id);
                                        const checked = selection.has(registrationKey);

                                        return (
                                            <tr key={registration.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                                <td className="event-registrations-table-checkbox">
                                                    <Checkbox
                                                        color="purple"
                                                        checked={checked}
                                                        disabled={!sendable}
                                                        onChange={() => toggleSelection(registration)}
                                                        aria-label={`Select ${registration.fullName || registration.email || registrationKey}`}
                                                    />
                                                </td>
                                                <td className="event-registrations-name-cell" title={registration.fullName || undefined}>
                                                    {registration.fullName
                                                        ? truncateRegistrationCell(registration.fullName, REGISTRATION_NAME_DISPLAY_LIMIT)
                                                        : '—'}
                                                </td>
                                                <td className="event-registrations-email-cell" title={registration.email || undefined}>
                                                    {registration.email
                                                        ? truncateRegistrationCell(registration.email, REGISTRATION_EMAIL_DISPLAY_LIMIT)
                                                        : '—'}
                                                </td>
                                                {multiDayEvent ? (
                                                    <td>
                                                        <CollapsibleAttendanceChips
                                                            registration={registration}
                                                            sessionDateById={sessionDateById}
                                                            canRemoveAttendance={canRemoveAttendance}
                                                            collapsible={multiDayEvent}
                                                            onRequestRemoval={setAttendanceRemovalTarget}
                                                        />
                                                    </td>
                                                ) : null}
                                                <td className="event-tickets-delivery-col">
                                                    <EmailDeliveryStatusCell status={ticketStatus} />
                                                </td>
                                                <td className="event-tickets-delivery-col">
                                                    <EmailDeliveryStatusCell status={reminderStatus} />
                                                </td>
                                                <td className="event-registrations-actions-col">
                                                    {sendable ? (
                                                        <div className="event-tickets-actions-col">
                                                            <button
                                                                type="button"
                                                                className="table-action-btn view-btn"
                                                                title="Resend ticket"
                                                                disabled={resendingTicketId === Number(registration.id)}
                                                                onClick={() => void handleResendTicket(registration)}
                                                            >
                                                                {resendingTicketId === Number(registration.id)
                                                                    ? <Loader2 className="animate-spin" />
                                                                    : <Mail />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="table-action-btn view-btn"
                                                                title="Send reminder"
                                                                disabled={sendingReminderId === Number(registration.id)}
                                                                onClick={() => void handleSendReminder(registration)}
                                                            >
                                                                {sendingReminderId === Number(registration.id)
                                                                    ? <Loader2 className="animate-spin" />
                                                                    : <Bell />}
                                                            </button>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                {/* Source and Check-in cells hidden */}
                                                {/* <td>{formatRegistrationSource(registration)}</td> */}
                                                {/* <td className="event-registrations-status-cell">{formatRegistrationStatus(registration)}</td> */}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="event-tickets-io-bar">
                            <div className="event-tickets-io-bar-row event-tickets-io-bar-row--pair">
                                <button
                                    type="button"
                                    className="btn btn-secondary event-tickets-io-btn"
                                    disabled={filteredSendableKeys.length === 0}
                                    onClick={selectAllFiltered}
                                >
                                    Select all
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary event-tickets-io-btn"
                                    disabled={selection.size === 0}
                                    onClick={clearSelection}
                                >
                                    Clear
                                </button>
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary event-tickets-io-btn"
                                disabled={selectedVisibleCount === 0 || bulkAction !== null}
                                onClick={() => void handleSendSelectedTickets()}
                            >
                                {bulkAction === 'tickets'
                                    ? 'Sending…'
                                    : selectedVisibleCount > 0
                                        ? `Send tickets (${selectedVisibleCount})`
                                        : 'Send tickets'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary event-tickets-io-btn"
                                disabled={selectedVisibleCount === 0 || bulkAction !== null}
                                onClick={() => void handleSendSelectedReminders()}
                            >
                                {bulkAction === 'reminders'
                                    ? 'Sending…'
                                    : selectedVisibleCount > 0
                                        ? `Send reminders (${selectedVisibleCount})`
                                        : 'Send reminders'}
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="event-tickets-design-column">
                    <TicketDesignPanel
                        eventId={eventId}
                        eventTitle={eventTitle}
                        eventDescription={eventDescription}
                        eventVenue={eventVenue}
                        eventDate={eventDate}
                        eventEndDate={eventEndDate}
                        eventTimezone={eventTimezone}
                        sessions={sessions}
                        tiers={tiers}
                        ticketDesign={ticketDesign}
                        onReload={onReload}
                    />
                    <IdCardDesignPanel
                        eventId={eventId}
                        fields={fields}
                        tiers={tiers}
                        idCardDesign={idCardDesign}
                        onReload={onReload}
                    />
                </aside>
            </div>

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
