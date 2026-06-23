import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Mail, RefreshCw } from 'lucide-react';
import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import { eventsAPI } from '@/services/api';
import type {
    EventRegistrationRef,
    EventRegistrationSourceGroup,
    Id,
    SendRegistrationTicketsResult,
} from '@/types/backend-contracts';
import {
    formatRegistrationSource,
    formatRegistrationStatus,
    formatReminderEmailStatus,
    formatTicketEmailStatus,
    getSendableRegistrations,
    isImportPlaceholderEmail,
    REGISTRATION_SOURCE_GROUP_OPTIONS,
} from '../customFieldUtils';
import { isMultiDayEvent, isWithinEventDays } from '../../eventDateUtils';

interface EventTicketsSectionProps {
    eventId: Id | string;
    eventDate?: string | null;
    eventEndDate?: string | null;
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
}: EventTicketsSectionProps) {
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const [ticketSearch, setTicketSearch] = useState('');
    const [ticketCheckIn, setTicketCheckIn] = useState('');
    const [ticketSourceGroup, setTicketSourceGroup] = useState<EventRegistrationSourceGroup | ''>('');
    const [ticketStatusFilter, setTicketStatusFilter] = useState<'SENT' | 'NOT_SENT' | ''>('');
    const [reminderStatusFilter, setReminderStatusFilter] = useState<'SENT' | 'NOT_SENT' | ''>('');
    const [resendingTicketId, setResendingTicketId] = useState<number | null>(null);
    const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
    const [bulkAction, setBulkAction] = useState<'imported' | 'allTickets' | 'reminders' | null>(null);
    const [importUnsentCount, setImportUnsentCount] = useState(0);
    const [allTicketsCount, setAllTicketsCount] = useState(0);
    const [unsentRemindersCount, setUnsentRemindersCount] = useState(0);

    const withinEventDays = isWithinEventDays(eventDate, eventEndDate);
    const multiDayEvent = isMultiDayEvent(eventDate, eventEndDate);

    const loadRegistrations = useCallback(async () => {
        try {
            const result = await eventsAPI.getRegistrations(eventId, {
                checkInStatus: ticketCheckIn === 'CHECKED_IN' || ticketCheckIn === 'NOT_CHECKED_IN' || ticketCheckIn === 'CHECKED_IN_TODAY'
                    ? ticketCheckIn
                    : undefined,
                sourceGroup: ticketSourceGroup || undefined,
                ticketStatus: ticketStatusFilter || undefined,
                reminderStatus: reminderStatusFilter || undefined,
            });
            setRegistrations(result);
        } catch {
            setRegistrations([]);
        }
    }, [eventId, reminderStatusFilter, ticketCheckIn, ticketSourceGroup, ticketStatusFilter]);

    const loadBulkCounts = useCallback(async () => {
        try {
            const [importUnsent, allSendable, reminderUnsent] = await Promise.all([
                eventsAPI.getRegistrations(eventId, { sourceGroup: 'IMPORT', ticketStatus: 'NOT_SENT' }),
                eventsAPI.getRegistrations(eventId),
                eventsAPI.getRegistrations(eventId, { reminderStatus: 'NOT_SENT' }),
            ]);
            setImportUnsentCount(getSendableRegistrations(importUnsent).length);
            setAllTicketsCount(getSendableRegistrations(allSendable).length);
            setUnsentRemindersCount(getSendableRegistrations(reminderUnsent).length);
        } catch {
            setImportUnsentCount(0);
            setAllTicketsCount(0);
            setUnsentRemindersCount(0);
        }
    }, [eventId]);

    const refreshAll = useCallback(async () => {
        await Promise.all([loadRegistrations(), loadBulkCounts()]);
    }, [loadBulkCounts, loadRegistrations]);

    useEffect(() => {
        void loadRegistrations();
    }, [loadRegistrations]);

    useEffect(() => {
        void loadBulkCounts();
    }, [loadBulkCounts]);

    const filtered = useMemo(() => {
        const query = ticketSearch.trim().toLowerCase();
        if (!query) return registrations;
        return registrations.filter((registration) => (
            [registration.fullName, registration.email, registration.confirmationCode]
                .some((value) => String(value || '').toLowerCase().includes(query))
        ));
    }, [registrations, ticketSearch]);

    const canSendEmail = (registration: EventRegistrationRef) => (
        registration.status !== 'CANCELLED'
        && Boolean(registration.email?.trim())
        && !isImportPlaceholderEmail(registration.email)
    );

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

    const handleSendImportedTickets = async () => {
        setBulkAction('imported');
        try {
            const importUnsent = await eventsAPI.getRegistrations(eventId, {
                sourceGroup: 'IMPORT',
                ticketStatus: 'NOT_SENT',
            });
            const registrationIds = getSendableRegistrations(importUnsent).map((registration) => Number(registration.id));

            if (registrationIds.length === 0) {
                window.alert('No imported registrations with a real email address need tickets.');
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

    const handleResendAllTickets = async () => {
        setBulkAction('allTickets');
        try {
            const all = await eventsAPI.getRegistrations(eventId);
            const registrationIds = getSendableRegistrations(all).map((registration) => Number(registration.id));

            if (registrationIds.length === 0) {
                window.alert('No registrations with a real email address can receive tickets.');
                return;
            }

            if (!window.confirm(`Resend ticket emails to ${registrationIds.length} registration(s)?`)) {
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

    const handleSendReminders = async () => {
        setBulkAction('reminders');
        try {
            const unsent = await eventsAPI.getRegistrations(eventId, { reminderStatus: 'NOT_SENT' });
            const registrationIds = getSendableRegistrations(unsent).map((registration) => Number(registration.id));

            if (registrationIds.length === 0) {
                window.alert('No registrations with a real email address need reminders.');
                return;
            }

            if (!window.confirm(`Send reminder emails to ${registrationIds.length} registration(s)?`)) {
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

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact event-tickets-header">
                <h2 className="expanded-section-title">Tickets</h2>
            </div>

            <div className="event-expanded-form-grid">
                <input
                    value={ticketSearch}
                    onChange={(event) => setTicketSearch(event.target.value)}
                    placeholder="Search by name, email, or code"
                    className="form-input"
                />
                <select
                    aria-label="Filter by check-in status"
                    value={ticketCheckIn}
                    onChange={(event) => setTicketCheckIn(event.target.value)}
                    className="form-input"
                >
                    <option value="">Check-in status</option>
                    <option value="CHECKED_IN">Checked in</option>
                    <option value="NOT_CHECKED_IN">Not checked in</option>
                    {multiDayEvent && withinEventDays ? <option value="CHECKED_IN_TODAY">Checked in today</option> : null}
                </select>
                <select
                    aria-label="Filter by source"
                    value={ticketSourceGroup}
                    onChange={(event) => setTicketSourceGroup(event.target.value as EventRegistrationSourceGroup | '')}
                    className="form-input"
                >
                    {REGISTRATION_SOURCE_GROUP_OPTIONS.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filter by ticket status"
                    value={ticketStatusFilter}
                    onChange={(event) => setTicketStatusFilter(event.target.value as 'SENT' | 'NOT_SENT' | '')}
                    className="form-input"
                >
                    <option value="">Ticket status</option>
                    <option value="SENT">Sent</option>
                    <option value="NOT_SENT">Not sent</option>
                </select>
                <select
                    aria-label="Filter by reminder status"
                    value={reminderStatusFilter}
                    onChange={(event) => setReminderStatusFilter(event.target.value as 'SENT' | 'NOT_SENT' | '')}
                    className="form-input"
                >
                    <option value="">Reminder status</option>
                    <option value="SENT">Sent</option>
                    <option value="NOT_SENT">Not sent</option>
                </select>
            </div>

            <div className="table-container event-registrations-table-scroll">
                <table className="members-table event-registrations-table event-tickets-table">
                    <thead>
                        <tr>
                            <th className="event-registrations-name-cell">Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Source</th>
                            <th>Check-in</th>
                            <th>Ticket</th>
                            <th>Reminder</th>
                            <th className="event-registrations-actions-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="event-tickets-empty">No registrations match these filters.</td>
                            </tr>
                        ) : filtered.map((registration, index) => {
                            const ticketStatus = formatTicketEmailStatus(registration);
                            const reminderStatus = formatReminderEmailStatus(registration);
                            const sendable = canSendEmail(registration);

                            return (
                                <tr key={registration.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                    <td className="event-registrations-name-cell">{registration.fullName || '—'}</td>
                                    <td className="email-cell">{registration.email || '—'}</td>
                                    <td>{registration.phoneNumber || '—'}</td>
                                    <td>{formatRegistrationSource(registration)}</td>
                                    <td>{formatRegistrationStatus(registration)}</td>
                                    <td><EmailDeliveryStatusCell status={ticketStatus} /></td>
                                    <td><EmailDeliveryStatusCell status={reminderStatus} /></td>
                                    <td className="event-registrations-actions-col">
                                        {sendable ? (
                                            <div className="event-tickets-actions-col">
                                                <button
                                                    type="button"
                                                    className="event-tickets-action-btn"
                                                    disabled={resendingTicketId === Number(registration.id)}
                                                    onClick={() => void handleResendTicket(registration)}
                                                >
                                                    {resendingTicketId === Number(registration.id) ? 'Sending…' : 'Resend ticket'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="event-tickets-action-btn"
                                                    disabled={sendingReminderId === Number(registration.id)}
                                                    onClick={() => void handleSendReminder(registration)}
                                                >
                                                    {sendingReminderId === Number(registration.id) ? 'Sending…' : 'Send reminder'}
                                                </button>
                                            </div>
                                        ) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="event-tickets-io-bar">
                <button
                    type="button"
                    className="btn btn-secondary event-tickets-io-btn"
                    disabled={bulkAction !== null || importUnsentCount === 0}
                    onClick={() => void handleSendImportedTickets()}
                >
                    <Mail size={16} />
                    {bulkAction === 'imported'
                        ? 'Sending…'
                        : importUnsentCount > 0
                            ? `Send tickets to imported (${importUnsentCount})`
                            : 'Send tickets to imported'}
                </button>
                <button
                    type="button"
                    className="btn btn-secondary event-tickets-io-btn"
                    disabled={bulkAction !== null || allTicketsCount === 0}
                    onClick={() => void handleResendAllTickets()}
                >
                    <RefreshCw size={16} />
                    {bulkAction === 'allTickets'
                        ? 'Sending…'
                        : allTicketsCount > 0
                            ? `Resend tickets to all (${allTicketsCount})`
                            : 'Resend tickets to all'}
                </button>
                <button
                    type="button"
                    className="btn btn-primary event-tickets-io-btn"
                    disabled={bulkAction !== null || unsentRemindersCount === 0}
                    onClick={() => void handleSendReminders()}
                >
                    <Bell size={16} />
                    {bulkAction === 'reminders'
                        ? 'Sending…'
                        : unsentRemindersCount > 0
                            ? `Send reminders (${unsentRemindersCount})`
                            : 'Send reminders'}
                </button>
            </div>
        </section>
    );
}
