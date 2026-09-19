'use client';

import { X } from 'lucide-react';
import { CLUB_TIMEZONE, formatDate, formatDateTime } from '@iclub/shared/utils';
import { useUsageProjectDetail } from '@/hooks/useUsageProjectDetail';
import type { Id } from '@/types/backend-contracts';
import './DevUsageDashboardPage.css';

type ProjectUsageDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId?: Id | null;
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

export default function ProjectUsageDetailModal({
    isOpen,
    onClose,
    projectId,
    from,
    to,
}: ProjectUsageDetailModalProps) {
    const projectIdParam = isOpen && projectId != null ? String(projectId) : null;

    const { data, isLoading, error, refetch } = useUsageProjectDetail(
        projectIdParam,
        isOpen ? from : null,
        isOpen ? to : null,
    );

    if (!isOpen) return null;

    const periodLabel =
        from && to ? `${formatMaybeDate(from)} – ${formatMaybeDate(to)}` : null;

    const project = data?.project;
    const metrics = data?.metrics;

    const subtitleParts = [
        project?.title || null,
        periodLabel ? `Period: ${periodLabel}` : null,
    ].filter(Boolean);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container usage-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="project-usage-detail-modal-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 id="project-usage-detail-modal-title" className="modal-title">
                            Project Usage Detail
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
                            <p>Loading project usage detail…</p>
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
                    ) : data && project && metrics ? (
                        <>
                            {error ? <div className="error-message">{error}</div> : null}

                            <div className="form-section">
                                <h3 className="form-section-title">Project</h3>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Status</span>
                                        <span className="info-value">
                                            {formatStatus(project.status)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Start</span>
                                        <span className="info-value">
                                            {formatMaybeDate(project.startDate)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Due</span>
                                        <span className="info-value">
                                            {formatMaybeDate(project.dueDate)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Completed</span>
                                        <span className="info-value">
                                            {formatMaybeDate(project.completedDate)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Created</span>
                                        <span className="info-value">
                                            {formatMaybeDateTime(project.createdAt)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Created by</span>
                                        <span className="info-value">
                                            {project.createdBy?.fullName || '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Summary</h3>
                                <div className="dashboard-stats-grid">
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Tasks</p>
                                        <p className="dashboard-stat-value">{metrics.tasks}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Subtasks</p>
                                        <p className="dashboard-stat-value">{metrics.subtasks}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Phases</p>
                                        <p className="dashboard-stat-value">{metrics.phases}</p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">People worked</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.peopleWorked}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Completion rate</p>
                                        <p className="dashboard-stat-value">
                                            {formatPercent(metrics.taskCompletionRate)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">
                                            Assignment completion
                                        </p>
                                        <p className="dashboard-stat-value">
                                            {formatPercent(metrics.assignmentCompletionRate)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Schedule-slot hours</p>
                                        <p className="dashboard-stat-value">
                                            {formatHours(metrics.scheduleSlotHours)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Estimated hours</p>
                                        <p className="dashboard-stat-value">
                                            {formatHours(metrics.estimatedHours)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Actual hours</p>
                                        <p className="dashboard-stat-value">
                                            {formatHours(metrics.actualHours)}
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
                                        <p className="dashboard-stat-label">Certificates</p>
                                        <p className="dashboard-stat-value">
                                            {metrics.certificates}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="empty-state">No project usage data available.</p>
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
