'use client';

import { X } from 'lucide-react';
import { CLUB_TIMEZONE, formatDate, formatDateTime } from '@iclub/shared/utils';
import { useUsageAnnouncementDetail } from '@/hooks/useUsageAnnouncementDetail';
import type { UsageAnnouncementTargetType } from '@/services/usageDashboardAPI';
import type { Id } from '@/types/backend-contracts';
import './DevUsageDashboardPage.css';

type AnnouncementUsageDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    announcementId?: Id | null;
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

function formatPercent(rate: number | null | undefined): string {
    if (rate == null || Number.isNaN(rate)) return '—';
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

function formatTarget(
    targetType: UsageAnnouncementTargetType | null | undefined,
    eventTitle?: string | null,
    projectTitle?: string | null,
): string {
    if (!targetType || targetType === 'NONE') return 'None';
    if (targetType === 'EVENT') {
        return eventTitle ? `Event · ${eventTitle}` : 'Event';
    }
    if (targetType === 'PROJECT') {
        return projectTitle ? `Project · ${projectTitle}` : 'Project';
    }
    return formatStatus(targetType);
}

export default function AnnouncementUsageDetailModal({
    isOpen,
    onClose,
    announcementId,
    from,
    to,
}: AnnouncementUsageDetailModalProps) {
    const announcementIdParam =
        isOpen && announcementId != null ? String(announcementId) : null;

    const { data, isLoading, error, refetch } = useUsageAnnouncementDetail(
        announcementIdParam,
        isOpen ? from : null,
        isOpen ? to : null,
    );

    if (!isOpen) return null;

    const periodLabel =
        from && to ? `${formatMaybeDate(from)} – ${formatMaybeDate(to)}` : null;

    const announcement = data?.announcement;
    const metrics = data?.metrics;

    const subtitleParts = [
        announcement?.title || null,
        periodLabel ? `Period: ${periodLabel}` : null,
    ].filter(Boolean);

    const statusBreakdown = Object.entries(data?.statusBreakdown ?? {}).map(
        ([status, count]) => ({ status, count }),
    );

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container usage-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="announcement-usage-detail-modal-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 id="announcement-usage-detail-modal-title" className="modal-title">
                            Announcement Usage Detail
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
                            <p>Loading announcement usage detail…</p>
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
                    ) : data && announcement && metrics ? (
                        <>
                            {error ? <div className="error-message">{error}</div> : null}

                            <div className="form-section">
                                <h3 className="form-section-title">Announcement</h3>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Created</span>
                                        <span className="info-value">
                                            {formatMaybeDateTime(announcement.createdAt)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Pinned</span>
                                        <span className="info-value">
                                            {announcement.isPinned ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Active</span>
                                        <span className="info-value">
                                            {announcement.isActive ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Target</span>
                                        <span className="info-value">
                                            {formatTarget(
                                                announcement.targetType,
                                                announcement.eventTitle,
                                                announcement.projectTitle,
                                            )}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Created by</span>
                                        <span className="info-value">
                                            {announcement.createdByName || '—'}
                                        </span>
                                    </div>
                                </div>
                                {announcement.bodyPreview ? (
                                    <p className="dev-usage-period-meta">{announcement.bodyPreview}</p>
                                ) : null}
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Summary</h3>
                                <div className="dashboard-stats-grid">
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Responses</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.responseCount}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Available</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.availableCount}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Unavailable</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.unavailableCount}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">% available</p>
                                        <p className="dashboard-stat-value">
                                            {formatPercent(metrics.availablePercent)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Response periods</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.periodsCount}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {statusBreakdown.length > 0 ? (
                                <div className="form-section">
                                    <h3 className="form-section-title">Response status</h3>
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
                        </>
                    ) : (
                        <p className="empty-state">No announcement usage data available.</p>
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
