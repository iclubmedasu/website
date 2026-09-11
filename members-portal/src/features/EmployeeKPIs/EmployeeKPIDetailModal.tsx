'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
    CLUB_TIMEZONE,
    formatDate,
    formatSessionRangeInTimezone,
} from '@iclub/shared/utils';
import { useEmployeeKPIDetail } from '@/hooks/useEmployeeKPIDetail';
import type { Id } from '@/types/backend-contracts';
import './EmployeeKPIsPage.css';

type KpiTab = 'project' | 'event';

type EmployeeKPIDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    memberId?: Id | null;
    startDate: string | null;
    endDate: string | null;
};

function formatRate(rate: number | null | undefined): string {
    if (rate == null || Number.isNaN(rate)) return '—';
    return `${Math.round(rate * 1000) / 10}%`;
}

function formatAvgDays(days: number | null | undefined): string {
    if (days == null || Number.isNaN(days)) return '—';
    const rounded = Math.round(days * 10) / 10;
    return `${rounded} day${rounded === 1 ? '' : 's'}`;
}

function formatHours(hours: number | null | undefined): string {
    if (hours == null || Number.isNaN(hours)) return '—';
    return String(Math.round(hours * 10) / 10);
}

function formatMaybeDate(value: string | null | undefined): string {
    if (!value) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return formatDate(`${value.trim()}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
    }
    return formatDate(value, { timeZone: CLUB_TIMEZONE });
}

function formatStatus(status: string | null | undefined): string {
    if (!status) return '—';
    return status
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

export default function EmployeeKPIDetailModal({
    isOpen,
    onClose,
    memberId,
    startDate,
    endDate,
}: EmployeeKPIDetailModalProps) {
    const [activeTab, setActiveTab] = useState<KpiTab>('event');

    const memberIdParam =
        isOpen && memberId != null ? String(memberId) : null;

    const { data, isLoading, error, refetch } = useEmployeeKPIDetail(
        memberIdParam,
        isOpen ? startDate : null,
        isOpen ? endDate : null,
    );

    if (!isOpen) return null;

    const periodLabel =
        startDate && endDate
            ? `${formatMaybeDate(startDate)} – ${formatMaybeDate(endDate)}`
            : null;

    const subtitleParts = [
        data?.fullName || null,
        periodLabel ? `Period: ${periodLabel}` : null,
    ].filter(Boolean);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container kpi-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="kpi-detail-modal-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 id="kpi-detail-modal-title" className="modal-title">
                            Employee KPI Detail
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
                            <p>Loading employee KPI detail…</p>
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
                    ) : data ? (
                        <>
                            {error ? <div className="error-message">{error}</div> : null}

                            <div className="form-section">
                                <h3 className="form-section-title">Summary</h3>
                                <div className="dashboard-stats-grid">
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Project Tasks Assigned</p>
                                        <p className="dashboard-stat-value">
                                            {data.projectTasks.assignedCount}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Project Tasks Completed</p>
                                        <p className="dashboard-stat-value">
                                            {data.projectTasks.completedCount}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Completion Rate</p>
                                        <p className="dashboard-stat-value">
                                            {formatRate(data.projectTasks.completionRate)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Event Days</p>
                                        <p className="dashboard-stat-value">
                                            {data.eventTasks.distinctDays}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Event Hours</p>
                                        <p className="dashboard-stat-value">
                                            {formatHours(data.eventTasks.totalHours)}
                                        </p>
                                    </div>
                                    <div className="dashboard-stat-tile">
                                        <p className="dashboard-stat-label">Event Tasks</p>
                                        <p className="dashboard-stat-value">
                                            {data.eventTasks.assignedCount}
                                        </p>
                                    </div>
                                </div>
                                <p className="form-hint">
                                    Overdue: {data.projectTasks.overdueCount}
                                    {' · '}
                                    Avg completion:{' '}
                                    {formatAvgDays(data.projectTasks.avgCompletionDays)}
                                </p>
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Tasks</h3>
                                <div
                                    className="certificates-tabs kpi-modal-tabs"
                                    role="tablist"
                                    aria-label="KPI task types"
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'event'}
                                        className={`certificates-tab-btn${activeTab === 'event' ? ' active' : ''}`}
                                        onClick={() => setActiveTab('event')}
                                    >
                                        Event Tasks
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'project'}
                                        className={`certificates-tab-btn${activeTab === 'project' ? ' active' : ''}`}
                                        onClick={() => setActiveTab('project')}
                                    >
                                        Project Tasks
                                    </button>
                                </div>

                                <div className="kpi-tab-panel">
                                    {activeTab === 'project' ? (
                                        !data.projectTasks.tasks?.length ? (
                                            <p className="empty-state">No project tasks in this period.</p>
                                        ) : (
                                            <div className="members-table-shell">
                                                <div className="table-container">
                                                    <table className="members-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Title</th>
                                                                <th>Project</th>
                                                                <th>Status</th>
                                                                <th>Due</th>
                                                                <th>Completed</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {data.projectTasks.tasks.map((task, index) => (
                                                                <tr
                                                                    key={task.assignmentId}
                                                                    className={
                                                                        index % 2 === 0
                                                                            ? 'even-row'
                                                                            : 'odd-row'
                                                                    }
                                                                >
                                                                    <td>{task.title || '—'}</td>
                                                                    <td>{task.project?.title || '—'}</td>
                                                                    <td>{formatStatus(task.status)}</td>
                                                                    <td>{formatMaybeDate(task.dueDate)}</td>
                                                                    <td>
                                                                        {formatMaybeDate(task.completedDate)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )
                                    ) : !data.eventTasks.tasks?.length ? (
                                        <p className="empty-state">No event tasks in this period.</p>
                                    ) : (
                                        <div className="members-table-shell">
                                            <div className="table-container">
                                                <table className="members-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Title</th>
                                                            <th>Event</th>
                                                            <th>Task date</th>
                                                            <th>Time slot</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.eventTasks.tasks.map((task, index) => (
                                                            <tr
                                                                key={task.assignmentId}
                                                                className={
                                                                    index % 2 === 0
                                                                        ? 'even-row'
                                                                        : 'odd-row'
                                                                }
                                                            >
                                                                <td>{task.title || '—'}</td>
                                                                <td>{task.event?.title || '—'}</td>
                                                                <td>{formatMaybeDate(task.taskDate)}</td>
                                                                <td>
                                                                    {task.startDateTime && task.endDateTime
                                                                        ? formatSessionRangeInTimezone(
                                                                              task.startDateTime,
                                                                              task.endDateTime,
                                                                              CLUB_TIMEZONE,
                                                                          )
                                                                        : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="empty-state">No KPI data available.</p>
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
