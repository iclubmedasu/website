'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import { CLUB_TIMEZONE, formatDate } from '@iclub/shared/utils';
import { useAuth } from '@/context/AuthContext';
import { useEmployeeKPIs } from '@/hooks/useEmployeeKPIs';
import { getProfilePhotoUrl } from '@/services/api';
import type { Id } from '@/types/backend-contracts';
import PeriodControl from '@/components/PeriodControl/PeriodControl';
import {
    parsePeriodPreset,
    resolvePeriodRange,
    type PeriodPreset,
    type PeriodRange,
} from '@/components/PeriodControl/periodRange';
import { exportEmployeeKpisExcel } from './exportEmployeeKpisExcel';
import EmployeeKPIDetailModal from './EmployeeKPIDetailModal';
import '@/components/page/page.css';
import '@/components/cards/universalcard.css';
import '@/components/buttons/buttons.css';
import '@/components/errormsg/errormsg.css';
import '@/components/table/table.css';
import '@/features/Finance/FinanceDashboardPage.css';
import './EmployeeKPIsPage.css';

type KpiTab = 'project' | 'event';

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

function canAccessKpis(user: ReturnType<typeof useAuth>['user']): boolean {
    return !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership);
}

function formatClubDay(day: string): string {
    return formatDate(`${day}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function EmployeeKPIsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const allowed = canAccessKpis(user);

    const initialPreset =
        parsePeriodPreset(searchParams.get('period')) ??
        (searchParams.get('startDate') && searchParams.get('endDate') ? 'custom' : 'this_month');
    const initialFrom = searchParams.get('startDate') ?? '';
    const initialTo = searchParams.get('endDate') ?? '';

    const [preset, setPreset] = useState<PeriodPreset>(initialPreset);
    const [customFrom, setCustomFrom] = useState(
        initialPreset === 'custom' ? initialFrom : '',
    );
    const [customTo, setCustomTo] = useState(initialPreset === 'custom' ? initialTo : '');
    const [activeTab, setActiveTab] = useState<KpiTab>('event');
    const [useQueryDates, setUseQueryDates] = useState(
        () =>
            Boolean(initialFrom && initialTo && initialFrom <= initialTo) &&
            initialPreset !== 'custom',
    );
    const [lastRange, setLastRange] = useState<PeriodRange | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState<Id | null>(null);

    const range = useMemo(() => {
        if (useQueryDates && initialFrom && initialTo && initialFrom <= initialTo) {
            return { startDate: initialFrom, endDate: initialTo };
        }
        return resolvePeriodRange(preset, customFrom, customTo);
    }, [useQueryDates, initialFrom, initialTo, preset, customFrom, customTo]);

    useEffect(() => {
        if (range) setLastRange(range);
    }, [range]);

    const displayRange = range ?? lastRange;

    const { data, summary, isLoading, error, refetch } = useEmployeeKPIs(
        range?.startDate ?? null,
        range?.endDate ?? null,
    );

    useEffect(() => {
        if (!user) return;
        if (!allowed) {
            router.replace('/teams');
        }
    }, [user, allowed, router]);

    const projectRows = useMemo(
        () =>
            [...data].sort(
                (a, b) => b.projectTasks.assignedCount - a.projectTasks.assignedCount,
            ),
        [data],
    );

    const eventRows = useMemo(
        () =>
            [...data].sort(
                (a, b) => b.eventTasks.assignedCount - a.eventTasks.assignedCount,
            ),
        [data],
    );

    const handleExport = useCallback(async () => {
        if (!summary || !displayRange) return;
        setExporting(true);
        setExportError('');
        try {
            await exportEmployeeKpisExcel({
                startDate: displayRange.startDate,
                endDate: displayRange.endDate,
                summary,
                employees: data,
            });
        } catch (err) {
            setExportError(getErrorMessage(err, 'Failed to export employee KPIs'));
        } finally {
            setExporting(false);
        }
    }, [summary, displayRange, data]);

    if (!user || !allowed) {
        return null;
    }

    const seedCustomFromRange = (seed: PeriodRange | null) => {
        if (!seed) return;
        setCustomFrom(seed.startDate);
        setCustomTo(seed.endDate);
    };

    const handlePresetChange = (next: PeriodPreset) => {
        setUseQueryDates(false);
        if (next === 'custom') {
            seedCustomFromRange(range ?? lastRange);
        }
        setPreset(next);
    };

    const openDetail = (memberId: Id) => {
        setViewingMemberId(memberId);
        setShowDetailModal(true);
    };

    const periodLabel =
        displayRange != null
            ? `${formatClubDay(displayRange.startDate)} – ${formatClubDay(displayRange.endDate)}`
            : null;

    const showFatalError = Boolean(error && !isLoading && !summary);

    return (
        <div className="members-page kpi-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Employee KPIs</h1>
            </div>
            <hr className="title-divider" />

            {exportError ? <p className="error-message">{exportError}</p> : null}

            {showFatalError ? (
                <div className="card">
                    <div className="card-body">
                        <p className="error-message">{error}</p>
                        <button type="button" className="btn btn-primary" onClick={() => void refetch()}>
                            Retry
                        </button>
                    </div>
                </div>
            ) : (
                <div className="finance-cards-stack">
                    <div className="card">
                        <div className="card-header card-header-with-action">
                            <div className="card-header-left">
                                <h3 className="card-title">Overview</h3>
                            </div>
                            <div className="kpi-card-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary finance-card-action"
                                    onClick={() => void refetch()}
                                    disabled={isLoading || !range || exporting}
                                >
                                    {isLoading ? 'Refreshing…' : 'Refresh'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary finance-card-action"
                                    onClick={() => void handleExport()}
                                    disabled={exporting || isLoading || !summary || !displayRange}
                                >
                                    {exporting ? 'Exporting…' : 'Export Excel'}
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                            <PeriodControl
                                preset={preset}
                                customFrom={customFrom}
                                customTo={customTo}
                                disabled={isLoading || exporting}
                                ariaLabel="KPI period"
                                onPresetChange={handlePresetChange}
                                onCustomFromChange={(value) => {
                                    setUseQueryDates(false);
                                    setCustomFrom(value);
                                    setPreset('custom');
                                }}
                                onCustomToChange={(value) => {
                                    setUseQueryDates(false);
                                    setCustomTo(value);
                                    setPreset('custom');
                                }}
                            />

                            {isLoading && !summary ? (
                                <p className="loading-message">Loading employee KPIs…</p>
                            ) : null}

                            {error && summary ? <p className="error-message">{error}</p> : null}

                            {summary ? (
                                <>
                                    {periodLabel ? (
                                        <p className="kpi-period-meta">Period: {periodLabel}</p>
                                    ) : null}
                                    <div className="dashboard-stats-grid">
                                        <div className="dashboard-stat-tile">
                                            <p className="dashboard-stat-label">Total Active Members</p>
                                            <p className="dashboard-stat-value">{summary.totalMembers}</p>
                                        </div>
                                        <div className="dashboard-stat-tile">
                                            <p className="dashboard-stat-label">
                                                Total Project Tasks Assigned
                                            </p>
                                            <p className="dashboard-stat-value">
                                                {summary.totalProjectTasksAssigned}
                                            </p>
                                        </div>
                                        <div className="dashboard-stat-tile">
                                            <p className="dashboard-stat-label">
                                                Total Event Task Assignments
                                            </p>
                                            <p className="dashboard-stat-value">
                                                {summary.totalEventTaskAssignments}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="card members-table-card kpi-main-card">
                        <div className="certificates-tabs" role="tablist" aria-label="KPI task types">
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
                            {isLoading && data.length === 0 ? (
                                <p className="loading-message">Loading table…</p>
                            ) : activeTab === 'project' ? (
                                projectRows.length === 0 ? (
                                    <p className="empty-state">No project task activity in this period.</p>
                                ) : (
                                    <div className="members-table-shell">
                                        <div className="table-container">
                                            <table className="members-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Assigned</th>
                                                        <th>Completed</th>
                                                        <th>Completion Rate</th>
                                                        <th>Overdue</th>
                                                        <th>Avg Completion Time</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {projectRows.map((row, index) => {
                                                        const avatar = row.profilePhotoUrl
                                                            ? getProfilePhotoUrl(row.memberId)
                                                            : null;
                                                        return (
                                                            <tr
                                                                key={row.memberId}
                                                                className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                                                            >
                                                                <td>
                                                                    <div className="table-member-cell">
                                                                        <div className="member-avatar-sm">
                                                                            {avatar ? (
                                                                                <img
                                                                                    src={avatar}
                                                                                    alt=""
                                                                                />
                                                                            ) : (
                                                                                <div className="avatar-placeholder-sm">
                                                                                    {(row.fullName || 'U')
                                                                                        .split(' ')
                                                                                        .map((p) => p[0])
                                                                                        .join('')}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <span className="member-name-text">
                                                                            {row.fullName || 'Unknown'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td>{row.projectTasks.assignedCount}</td>
                                                                <td>{row.projectTasks.completedCount}</td>
                                                                <td>
                                                                    {formatRate(row.projectTasks.completionRate)}
                                                                </td>
                                                                <td>{row.projectTasks.overdueCount}</td>
                                                                <td>
                                                                    {formatAvgDays(
                                                                        row.projectTasks.avgCompletionDays,
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <div className="action-buttons">
                                                                        <button
                                                                            type="button"
                                                                            className="table-action-btn view-btn"
                                                                            onClick={() => openDetail(row.memberId)}
                                                                            title="View employee KPIs"
                                                                        >
                                                                            <Eye />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            ) : eventRows.length === 0 ? (
                                <p className="empty-state">No event task activity in this period.</p>
                            ) : (
                                <div className="members-table-shell">
                                    <div className="table-container">
                                        <table className="members-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Days</th>
                                                    <th>Hours</th>
                                                    <th>Tasks</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {eventRows.map((row, index) => {
                                                    const avatar = row.profilePhotoUrl
                                                        ? getProfilePhotoUrl(row.memberId)
                                                        : null;
                                                    return (
                                                        <tr
                                                            key={row.memberId}
                                                            className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                                                        >
                                                            <td>
                                                                <div className="table-member-cell">
                                                                    <div className="member-avatar-sm">
                                                                        {avatar ? (
                                                                            <img src={avatar} alt="" />
                                                                        ) : (
                                                                            <div className="avatar-placeholder-sm">
                                                                                {(row.fullName || 'U')
                                                                                    .split(' ')
                                                                                    .map((p) => p[0])
                                                                                    .join('')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="member-name-text">
                                                                        {row.fullName || 'Unknown'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td>{row.eventTasks.distinctDays}</td>
                                                            <td>{formatHours(row.eventTasks.totalHours)}</td>
                                                            <td>{row.eventTasks.assignedCount}</td>
                                                            <td>
                                                                <div className="action-buttons">
                                                                    <button
                                                                        type="button"
                                                                        className="table-action-btn view-btn"
                                                                        onClick={() => openDetail(row.memberId)}
                                                                        title="View employee KPIs"
                                                                    >
                                                                        <Eye />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <EmployeeKPIDetailModal
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    setViewingMemberId(null);
                }}
                memberId={viewingMemberId}
                startDate={displayRange?.startDate ?? null}
                endDate={displayRange?.endDate ?? null}
            />
        </div>
    );
}
