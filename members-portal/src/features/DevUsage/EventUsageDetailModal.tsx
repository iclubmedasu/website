'use client';

import { X } from 'lucide-react';
import {
    CLUB_TIMEZONE,
    formatDate,
    formatDateTime,
    formatSessionRangeInTimezone,
} from '@iclub/shared/utils';
import { useUsageEventDetail } from '@/hooks/useUsageEventDetail';
import type { Id } from '@/types/backend-contracts';
import './DevUsageDashboardPage.css';

type EventUsageDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    eventId?: Id | null;
    from: string | null;
    to: string | null;
};

function formatMaybeDate(value: string | null | undefined): string {
    if (!value) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return formatDate(`${value.trim()}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
    }
    return formatDate(value, { timeZone: CLUB_TIMEZONE });
}

function formatMaybeDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    return formatDateTime(value, { timeZone: CLUB_TIMEZONE });
}

function formatHours(hours: number | null | undefined): string {
    if (hours == null || Number.isNaN(hours)) return '—';
    return String(Math.round(hours * 10) / 10);
}

function formatPercent(rate: number | null | undefined): string {
    if (rate == null || Number.isNaN(rate)) return '—';
    // Accept 0–1 ratios or already-scaled 0–100 percentages from the API.
    const pct = rate > 1 ? rate : rate * 100;
    return `${Math.round(pct * 10) / 10}%`;
}

function formatStatus(status: string | null | undefined): string {
    if (!status) return '—';
    return status
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

function formatMinutes(minutes: number | null | undefined): string {
    if (minutes == null || Number.isNaN(minutes)) return '—';
    return `${Math.round(minutes * 10) / 10} min`;
}

export default function EventUsageDetailModal({
    isOpen,
    onClose,
    eventId,
    from,
    to,
}: EventUsageDetailModalProps) {
    const eventIdParam = isOpen && eventId != null ? String(eventId) : null;

    const { data, isLoading, error, refetch } = useUsageEventDetail(
        eventIdParam,
        isOpen ? from : null,
        isOpen ? to : null,
    );

    if (!isOpen) return null;

    const periodLabel =
        from && to ? `${formatMaybeDate(from)} – ${formatMaybeDate(to)}` : null;

    const event = data?.event;
    const metrics = data?.metrics;

    const subtitleParts = [
        event?.title || null,
        event?.venue || null,
        periodLabel ? `Period: ${periodLabel}` : null,
    ].filter(Boolean);

    const sessions = data?.sessions ?? [];
    const statusBreakdown = Object.entries(data?.registrationStatusBreakdown ?? {}).map(
        ([status, count]) => ({ status, count }),
    );

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container usage-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="event-usage-detail-modal-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 id="event-usage-detail-modal-title" className="modal-title">
                            Event Usage Detail
                        </h2>
                        {subtitleParts.length > 0 ? (
                            <p className="modal-subtitle">{subtitleParts.join(' · ')}</p>
                        ) : null}
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={onClose}
                        type="button"
                        title="Close"
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {isLoading && !data ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading event usage detail…</p>
                        </div>
                    ) : error && !data ? (
                        <div className="error-state">
                            <div className="error-message">{error}</div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => void refetch()}
                            >
                                Retry
                            </button>
                        </div>
                    ) : data && event && metrics ? (
                        <>
                            {error ? <div className="error-message">{error}</div> : null}

                            <div className="form-section">
                                <h3 className="form-section-title">Event</h3>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Status</span>
                                        <span className="info-value">{formatStatus(event.status)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Start</span>
                                        <span className="info-value">
                                            {formatMaybeDateTime(event.eventDate)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">End</span>
                                        <span className="info-value">
                                            {formatMaybeDateTime(event.eventEndDate)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Created</span>
                                        <span className="info-value">
                                            {formatMaybeDateTime(event.createdAt)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Capacity</span>
                                        <span className="info-value">
                                            {event.capacity != null ? event.capacity : '—'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Capacity fill</span>
                                        <span className="info-value">
                                            {formatPercent(metrics.capacityFillPercent)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Summary</h3>
                                <div className="dashboard-stats-grid">
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Duration (hours)</p>
                                        <p className="dashboard-stat-value">
                                            {formatHours(metrics.durationHours)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Sessions</p>
                                        <p className="dashboard-stat-value">{metrics.sessions}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Registrations</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.registrations}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Walk-ins</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.walkInRegistrations}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Cancelled</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.cancelledRegistrations}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Day check-ins</p>
                                        <p className="dashboard-stat-value">{metrics.checkIns}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Tickets sent</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.ticketsSent}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Reminders sent</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.remindersSent}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Certificates</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.certificatesIssued}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Cert emails</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.certificateEmailsSent}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Files</p>
                                        <p className="dashboard-stat-value">{metrics.files}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Photos</p>
                                        <p className="dashboard-stat-value">{metrics.photos}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Event tasks</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.eventTasks}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Assignments</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.eventTaskAssignments}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">People worked</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.peopleWorked}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Assignment hours</p>
                                        <p className="dashboard-stat-value">
                                            {formatHours(metrics.assignmentHours)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Attendance segments</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.sessionAttendanceSegments}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Dwell time</p>
                                        <p className="dashboard-stat-value">
                                            {formatMinutes(metrics.sessionAttendanceDwellMinutes)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {statusBreakdown.length > 0 ? (
                                <div className="form-section">
                                    <h3 className="form-section-title">Registration status</h3>
                                    <div className="members-table-shell">
                                        <div className="table-container">
                                            <table className="members-table">
                                                <thead>
                                                    <tr>
                                                        <th>Status</th>
                                                        <th>Count</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {statusBreakdown.map((row, index) => (
                                                        <tr
                                                            key={row.status}
                                                            className={
                                                                index % 2 === 0
                                                                    ? 'even-row'
                                                                    : 'odd-row'
                                                            }
                                                        >
                                                            <td>{formatStatus(row.status)}</td>
                                                            <td>{row.count}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {sessions.length > 0 ? (
                                <div className="form-section">
                                    <h3 className="form-section-title">Sessions</h3>
                                    <div className="members-table-shell">
                                        <div className="table-container">
                                            <table className="members-table">
                                                <thead>
                                                    <tr>
                                                        <th>Label</th>
                                                        <th>Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sessions.map((session, index) => (
                                                        <tr
                                                            key={String(session.id)}
                                                            className={
                                                                index % 2 === 0
                                                                    ? 'even-row'
                                                                    : 'odd-row'
                                                            }
                                                        >
                                                            <td>{session.label || '—'}</td>
                                                            <td>
                                                                {session.startDateTime &&
                                                                session.endDateTime
                                                                    ? formatSessionRangeInTimezone(
                                                                          session.startDateTime,
                                                                          session.endDateTime,
                                                                          CLUB_TIMEZONE,
                                                                      )
                                                                    : formatMaybeDate(
                                                                          session.sessionDate,
                                                                      )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <p className="empty-state">No event usage data available.</p>
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </>
    );
}
