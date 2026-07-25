import { CLUB_TIMEZONE, toEventDayString } from '@iclub/shared/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Filter, Loader2, Mail, Search } from 'lucide-react';
import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import { useResourceChannel } from '@/hooks/useResourceChannel';
import { eventsAPI } from '@/services/api';
import type {
    EventCustomFieldRef,
    EventRegistrationRef,
    EventSessionRef,
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
    REGISTRATION_PHONE_DISPLAY_LIMIT,
    truncateRegistrationCell,
} from '../customFieldUtils';
import { isMultiDayEvent, isWithinEventDays } from '../../eventDateUtils';
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

interface EventTicketsSectionProps {
    eventId: Id | string;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    sessions?: EventSessionRef[];
    tiers?: EventTierRef[];
    fields?: EventCustomFieldRef[];
    canRemoveAttendance?: boolean;
    funnel: RegistrationTableFunnelState;
    onFunnelChange: (
        next:
            | RegistrationTableFunnelState
            | ((prev: RegistrationTableFunnelState) => RegistrationTableFunnelState),
    ) => void;
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
    eventDate,
    eventEndDate,
    eventTimezone = CLUB_TIMEZONE,
    sessions = [],
    tiers = [],
    fields = [],
    canRemoveAttendance = false,
    funnel,
    onFunnelChange,
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
    const [bulkAction, setBulkAction] = useState<
        'imported' | 'allTickets' | 'reminders' | 'filtered' | 'filteredReminders' | null
    >(null);
    const [allTicketsCount, setAllTicketsCount] = useState(0);
    const [allRemindersCount, setAllRemindersCount] = useState(0);
    const [attendanceRemovalTarget, setAttendanceRemovalTarget] = useState<AttendanceRemovalTarget | null>(null);
    const [removingAttendance, setRemovingAttendance] = useState(false);

    const withinEventDays = isWithinEventDays(eventDate, eventEndDate, new Date(), eventTimezone);
    const multiDayEvent = isMultiDayEvent(eventDate, eventEndDate, eventTimezone);
    const sessionDateById = new Map(
        sessions.map((session) => {
            const instant = session.startDateTime ?? session.sessionDate;
            const day = instant ? toEventDayString(instant, eventTimezone) : null;
            return [String(session.id), day ?? ''] as const;
        }),
    );
    const columnCount = multiDayEvent ? 7 : 6;
    const filterableColumns = useMemo(
        () => buildFilterableColumns('tickets', fields, tiers, sessions, multiDayEvent),
        [fields, multiDayEvent, sessions, tiers],
    );
    const tableContext = useMemo(() => ({
        tableKind: 'tickets' as const,
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

    const loadBulkCounts = useCallback(async () => {
        try {
            const allSendable = await eventsAPI.getRegistrations(eventId);
            const sendableCount = getSendableRegistrations(allSendable).length;
            setAllTicketsCount(sendableCount);
            setAllRemindersCount(sendableCount);
        } catch {
            setAllTicketsCount(0);
            setAllRemindersCount(0);
        }
    }, [eventId]);

    const refreshAll = useCallback(async () => {
        await Promise.all([loadRegistrations(), loadBulkCounts()]);
    }, [loadBulkCounts, loadRegistrations]);

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

    useEffect(() => {
        void loadBulkCounts();
    }, [loadBulkCounts]);

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

    const filteredReminderSendable = useMemo(
        () => getSendableRegistrations(filtered),
        [filtered],
    );

    const canSendEmail = (registration: EventRegistrationRef) => (
        registration.status !== 'CANCELLED'
        && Boolean(registration.email?.trim())
        && !isImportPlaceholderEmail(registration.email)
    );

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

    const handleResendAllTickets = async () => {
        setBulkAction('allTickets');
        try {
            const all = await eventsAPI.getRegistrations(eventId);
            const registrationIds = getSendableRegistrations(all).map((registration) => Number(registration.id));

            if (registrationIds.length === 0) {
                window.alert('No registrations with a real email address can receive tickets.');
                return;
            }

            if (!window.confirm(`Send ticket emails to ${registrationIds.length} registration(s)?`)) {
                return;
            }

            const result = await eventsAPI.sendRegistrationTickets(eventId, { registrationIds });
            window.alert(formatBulkSummary(result, 'Tickets sent'));
            void refreshAll();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to send ticket emails.');
        } finally {
            setBulkAction(null);
        }
    };

    const handleSendFilteredTickets = async () => {
        const registrationIds = filteredSendable.map((registration) => Number(registration.id));
        if (registrationIds.length === 0) return;

        if (!window.confirm(`Send tickets to ${registrationIds.length} filtered registrant(s)?`)) {
            return;
        }

        setBulkAction('filtered');
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

    const handleSendReminders = async () => {
        setBulkAction('reminders');
        try {
            const all = await eventsAPI.getRegistrations(eventId);
            const registrationIds = getSendableRegistrations(all).map((registration) => Number(registration.id));

            if (registrationIds.length === 0) {
                window.alert('No registrations with a real email address can receive reminders.');
                return;
            }

            if (!window.confirm(`Send reminders to ${registrationIds.length} registrant(s)?`)) {
                return;
            }

            const result = await eventsAPI.sendRegistrationReminders(eventId, { registrationIds });
            window.alert(formatBulkSummary(result, 'Reminders sent'));
            void refreshAll();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to send reminder emails.');
        } finally {
            setBulkAction(null);
        }
    };

    const handleSendFilteredReminders = async () => {
        const registrationIds = filteredReminderSendable.map((registration) => Number(registration.id));
        if (registrationIds.length === 0) return;

        if (!window.confirm(`Send reminders to ${registrationIds.length} filtered registrant(s)?`)) {
            return;
        }

        setBulkAction('filteredReminders');
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
                <h2 className="expanded-section-title">Tickets</h2>
            </div>

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
                                <th className="event-registrations-name-cell">Name</th>
                                <th className="event-registrations-email-cell">Email</th>
                                <th className="event-registrations-phone-cell">Phone</th>
                                {multiDayEvent ? <th>Attendance</th> : null}
                                <th>Ticket</th>
                                <th>Reminder</th>
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

                                return (
                                    <tr key={registration.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
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
                                        <td className="event-registrations-phone-cell" title={registration.phoneNumber || undefined}>
                                            {registration.phoneNumber
                                                ? truncateRegistrationCell(registration.phoneNumber, REGISTRATION_PHONE_DISPLAY_LIMIT)
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
                                        <td><EmailDeliveryStatusCell status={ticketStatus} /></td>
                                        <td><EmailDeliveryStatusCell status={reminderStatus} /></td>
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
                    {/* Send tickets to imported — hidden for now
                    <button
                        type="button"
                        className="btn btn-secondary event-tickets-io-btn"
                        disabled={bulkAction !== null || importUnsentCount === 0}
                        onClick={() => void handleSendImportedTickets()}
                    >
                        {bulkAction === 'imported'
                            ? 'Sending…'
                            : importUnsentCount > 0
                                ? `Send tickets to imported (${importUnsentCount})`
                                : 'Send tickets to imported'}
                    </button>
                    */}
                    <button
                        type="button"
                        className="btn btn-secondary event-tickets-io-btn"
                        disabled={bulkAction !== null || filteredSendable.length === 0}
                        onClick={() => void handleSendFilteredTickets()}
                    >
                        {bulkAction === 'filtered'
                            ? 'Sending…'
                            : filteredSendable.length > 0
                                ? `Send tickets to filtered (${filteredSendable.length})`
                                : 'Send tickets to filtered'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary event-tickets-io-btn"
                        disabled={bulkAction !== null || allTicketsCount === 0}
                        onClick={() => void handleResendAllTickets()}
                    >
                        {bulkAction === 'allTickets'
                            ? 'Sending…'
                            : allTicketsCount > 0
                                ? `Send tickets to all (${allTicketsCount})`
                                : 'Send tickets to all'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary event-tickets-io-btn"
                        disabled={bulkAction !== null || allRemindersCount === 0}
                        onClick={() => void handleSendReminders()}
                    >
                        {bulkAction === 'reminders'
                            ? 'Sending…'
                            : allRemindersCount > 0
                                ? `Send reminders to all (${allRemindersCount})`
                                : 'Send reminders to all'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary event-tickets-io-btn"
                        disabled={bulkAction !== null || filteredReminderSendable.length === 0}
                        onClick={() => void handleSendFilteredReminders()}
                    >
                        {bulkAction === 'filteredReminders'
                            ? 'Sending…'
                            : filteredReminderSendable.length > 0
                                ? `Send reminders to filtered (${filteredReminderSendable.length})`
                                : 'Send reminders to filtered'}
                    </button>
                </div>
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
