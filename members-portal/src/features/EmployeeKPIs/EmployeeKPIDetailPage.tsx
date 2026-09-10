'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
    CLUB_TIMEZONE,
    formatDate,
    formatSessionRangeInTimezone,
} from '@iclub/shared/utils';
import { useAuth } from '@/context/AuthContext';
import { useEmployeeKPIDetail } from '@/hooks/useEmployeeKPIDetail';
import { getProfilePhotoUrl } from '@/services/api';
import PeriodControl from '@/components/PeriodControl/PeriodControl';
import {
    buildPeriodQuery,
    parsePeriodPreset,
    resolvePeriodRange,
    type PeriodPreset,
    type PeriodRange,
} from '@/components/PeriodControl/periodRange';
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

function formatMaybeDate(value: string | null | undefined): string {
    if (!value) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return formatDate(`${value.trim()}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
    }
    return formatDate(value, { timeZone: CLUB_TIMEZONE });
}

function canAccessKpis(user: ReturnType<typeof useAuth>['user']): boolean {
    return !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership);
}

function formatStatus(status: string | null | undefined): string {
    if (!status) return '—';
    return status
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

export default function EmployeeKPIDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const allowed = canAccessKpis(user);

    const memberId = typeof params.memberId === 'string' ? params.memberId : null;

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
    const [lastRange, setLastRange] = useState<PeriodRange | null>(null);

    // When landing with explicit dates but a named preset, prefer the query dates once.
    const [useQueryDates, setUseQueryDates] = useState(
        () =>
            Boolean(searchParams.get('startDate') && searchParams.get('endDate')) &&
            initialPreset !== 'custom',
    );

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

    const { data, isLoading, error, refetch } = useEmployeeKPIDetail(
        memberId,
        range?.startDate ?? null,
        range?.endDate ?? null,
    );

    useEffect(() => {
        if (!user) return;
        if (!allowed) {
            router.replace('/teams');
        }
    }, [user, allowed, router]);

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

    const listQuery = displayRange ? `?${buildPeriodQuery(displayRange, preset)}` : '';
    const avatar =
        data?.profilePhotoUrl && data.memberId != null
            ? getProfilePhotoUrl(data.memberId)
            : memberId
              ? getProfilePhotoUrl(memberId)
              : null;

    const periodLabel =
        displayRange != null
            ? `${formatMaybeDate(displayRange.startDate)} – ${formatMaybeDate(displayRange.endDate)}`
            : null;

    const showFatalError = Boolean(memberId && error && !isLoading && !data);

    return (
        <div className="members-page kpi-page">
            <Link href={`/kpis${listQuery}`} className="kpi-detail-back">
                <ArrowLeft size={16} aria-hidden />
                Back to Employee KPIs
            </Link>

            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Employee KPI Detail</h1>
            </div>
            <hr className="title-divider" />

            {!memberId ? (
                <p className="error-message">Invalid member.</p>
            ) : showFatalError ? (
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
                            <button
                                type="button"
                                className="btn btn-secondary finance-card-action"
                                onClick={() => void refetch()}
                                disabled={isLoading || !range}
                            >
                                {isLoading ? 'Refreshing…' : 'Refresh'}
                            </button>
                        </div>
                        <div className="card-body">
                            <PeriodControl
                                preset={preset}
                                customFrom={customFrom}
                                customTo={customTo}
                                disabled={isLoading}
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

                            <div className="kpi-detail-header">
                                <div className="kpi-detail-avatar">
                                    {isLoading && !data ? (
                                        '…'
                                    ) : avatar && data?.profilePhotoUrl ? (
                                        <img src={avatar} alt="" />
                                    ) : (
                                        (data?.fullName || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <h2 className="kpi-detail-name">
                                    {isLoading && !data
                                        ? 'Loading…'
                                        : data?.fullName || 'Unknown member'}
                                </h2>
                            </div>

                            {isLoading && !data ? (
                                <p className="loading-message">Loading employee KPI detail…</p>
                            ) : null}

                            {error && data ? <p className="error-message">{error}</p> : null}

                            {data ? (
                                <>
                                    {periodLabel ? (
                                        <p className="kpi-period-meta">Period: {periodLabel}</p>
                                    ) : null}
                                    <div className="dashboard-stats-grid">
                                        <div className="dashboard-stat-tile">
                                            <p className="dashboard-stat-label">
                                                Project Tasks Assigned
                                            </p>
                                            <p className="dashboard-stat-value">
                                                {data.projectTasks.assignedCount}
                                            </p>
                                        </div>
                                        <div className="dashboard-stat-tile">
                                            <p className="dashboard-stat-label">
                                                Project Tasks Completed
                                            </p>
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
                                            <p className="dashboard-stat-label">
                                                Event Task Assignments
                                            </p>
                                            <p className="dashboard-stat-value">
                                                {data.eventTasks.assignedCount}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="kpi-period-meta kpi-period-meta--secondary">
                                        Overdue: {data.projectTasks.overdueCount}
                                        {' · '}
                                        Avg completion:{' '}
                                        {formatAvgDays(data.projectTasks.avgCompletionDays)}
                                    </p>
                                </>
                            ) : null}
                        </div>
                    </div>

                    {data ? (
                        <div className="card members-table-card kpi-main-card">
                            <div
                                className="certificates-tabs"
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
                                        <p className="empty-state">
                                            No project tasks in this period.
                                        </p>
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
                    ) : null}
                </div>
            )}
        </div>
    );
}
