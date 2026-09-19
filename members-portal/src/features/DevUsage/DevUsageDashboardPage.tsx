'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { CLUB_TIMEZONE, formatDate, formatDateTime } from '@iclub/shared/utils';
import {
    usageDashboardAPI,
    type UsageAnnouncementTargetType,
    type UsageAnnouncementsOrgSummary,
    type UsageDashboardSummary,
    type UsageEventsOrgSummary,
    type UsageProjectsOrgSummary,
} from '@/services/usageDashboardAPI';
import type { Id } from '@/types/backend-contracts';
import { useUsageAnnouncements } from '@/hooks/useUsageAnnouncements';
import { useUsageEvents } from '@/hooks/useUsageEvents';
import { useUsageProjects } from '@/hooks/useUsageProjects';
import PeriodControl from '@/components/PeriodControl/PeriodControl';
import {
    resolvePeriodRange,
    type PeriodPreset,
    type PeriodRange,
} from '@/components/PeriodControl/periodRange';
import { exportUsageExcel } from './exportUsageExcel';
import AnnouncementUsageDetailModal from './AnnouncementUsageDetailModal';
import EventUsageDetailModal from './EventUsageDetailModal';
import ProjectUsageDetailModal from './ProjectUsageDetailModal';
import '@/components/page/page.css';
import '@/components/cards/universalcard.css';
import '@/components/buttons/buttons.css';
import '@/components/errormsg/errormsg.css';
import '@/components/table/table.css';
import '@/features/Finance/FinanceDashboardPage.css';
import './DevUsageDashboardPage.css';

type UsageTab = 'events' | 'projects' | 'announcements' | 'platform';

const PLATFORM_STATS: { key: keyof UsageDashboardSummary['counts']; label: string }[] = [
    { key: 'eventsCreated', label: 'Events created' },
    { key: 'certificatesIssued', label: 'Certificates issued' },
    { key: 'checkInsScanned', label: 'Check-ins scanned' },
    { key: 'registrationsCreated', label: 'Registrations created' },
    { key: 'dataExports', label: 'Data exports' },
    { key: 'logins', label: 'Logins' },
    { key: 'activeMembers', label: 'Active members (logins)' },
];

const EVENT_SUMMARY_STATS: { key: keyof UsageEventsOrgSummary; label: string }[] = [
    { key: 'eventsCreated', label: 'Events created' },
    { key: 'eventTasks', label: 'Event tasks' },
    { key: 'eventTaskAssignments', label: 'Assignments' },
    { key: 'tasksPerEvent', label: 'Tasks per event' },
    { key: 'peopleWorked', label: 'People worked' },
    { key: 'totalAssignmentHours', label: 'Assignment hours' },
    { key: 'totalEventDurationHours', label: 'Event duration hours' },
    { key: 'registrations', label: 'Registrations' },
    { key: 'ticketsSent', label: 'Tickets sent' },
    { key: 'remindersSent', label: 'Reminders sent' },
    { key: 'certificatesIssued', label: 'Certificates' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'filesUploaded', label: 'Files uploaded' },
    { key: 'photosUploaded', label: 'Photos uploaded' },
    { key: 'checkIns', label: 'Check-ins' },
];

const PROJECT_SUMMARY_STATS: { key: keyof UsageProjectsOrgSummary; label: string }[] = [
    { key: 'projectsCreated', label: 'Projects created' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'subtasks', label: 'Subtasks' },
    { key: 'phases', label: 'Phases' },
    { key: 'peopleWorked', label: 'People worked' },
    { key: 'totalPlannedDurationDays', label: 'Planned duration (days)' },
    { key: 'files', label: 'Files' },
    { key: 'photos', label: 'Photos' },
    { key: 'certificates', label: 'Certificates' },
];

const ANNOUNCEMENT_SUMMARY_STATS: {
    key: keyof UsageAnnouncementsOrgSummary;
    label: string;
}[] = [
    { key: 'announcementsCreated', label: 'Announcements created' },
    { key: 'totalResponses', label: 'Total responses' },
    { key: 'availableCount', label: 'Available' },
    { key: 'unavailableCount', label: 'Unavailable' },
    { key: 'avgResponsesPerAnnouncement', label: 'Avg responses / announcement' },
];

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function formatClubDay(day: string): string {
    return formatDate(`${day}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
}

function formatMaybeDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    return formatDateTime(value, { timeZone: CLUB_TIMEZONE });
}

function formatMaybeDate(value: string | null | undefined): string {
    if (!value) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return formatDate(`${value.trim()}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
    }
    return formatDate(value, { timeZone: CLUB_TIMEZONE });
}

function formatHours(hours: number | null | undefined): string {
    if (hours == null || Number.isNaN(hours)) return '—';
    return String(Math.round(hours * 10) / 10);
}

function formatAvg(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return String(Math.round(value * 10) / 10);
}

function formatStatus(status: string | null | undefined): string {
    if (!status) return '—';
    return status
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

function formatAnnouncementTarget(
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

export default function DevUsageDashboardPage() {
    const [activeTab, setActiveTab] = useState<UsageTab>('events');
    const [platformSummary, setPlatformSummary] = useState<UsageDashboardSummary | null>(null);
    const [platformError, setPlatformError] = useState('');
    const [platformLoading, setPlatformLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const [preset, setPreset] = useState<PeriodPreset>('this_month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [lastRange, setLastRange] = useState<PeriodRange | null>(null);

    const [showEventModal, setShowEventModal] = useState(false);
    const [viewingEventId, setViewingEventId] = useState<Id | null>(null);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [viewingProjectId, setViewingProjectId] = useState<Id | null>(null);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [viewingAnnouncementId, setViewingAnnouncementId] = useState<Id | null>(null);

    const range = useMemo(
        () => resolvePeriodRange(preset, customFrom, customTo),
        [preset, customFrom, customTo],
    );

    useEffect(() => {
        if (range) setLastRange(range);
    }, [range]);

    const displayRange = range ?? lastRange;
    const from = range?.startDate ?? null;
    const to = range?.endDate ?? null;

    const {
        events,
        summary: eventsSummary,
        isLoading: eventsLoading,
        error: eventsError,
        refetch: refetchEvents,
    } = useUsageEvents(from, to, activeTab === 'events');

    const {
        projects,
        summary: projectsSummary,
        isLoading: projectsLoading,
        error: projectsError,
        refetch: refetchProjects,
    } = useUsageProjects(from, to, activeTab === 'projects');

    const {
        announcements,
        summary: announcementsSummary,
        isLoading: announcementsLoading,
        error: announcementsError,
        refetch: refetchAnnouncements,
    } = useUsageAnnouncements(from, to, activeTab === 'announcements');

    const loadPlatform = useCallback(async (nextRange: PeriodRange) => {
        setPlatformLoading(true);
        setPlatformError('');
        try {
            const data = await usageDashboardAPI.getSummary({
                from: nextRange.startDate,
                to: nextRange.endDate,
            });
            setPlatformSummary(data);
        } catch (err) {
            setPlatformSummary(null);
            setPlatformError(getErrorMessage(err, 'Failed to load usage summary'));
        } finally {
            setPlatformLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'platform') return;
        if (!range) {
            setPlatformLoading(false);
            return;
        }
        void loadPlatform(range);
    }, [activeTab, range, loadPlatform]);

    const isLoading =
        activeTab === 'events'
            ? eventsLoading
            : activeTab === 'projects'
              ? projectsLoading
              : activeTab === 'announcements'
                ? announcementsLoading
                : platformLoading;

    const tabError =
        activeTab === 'events'
            ? eventsError
            : activeTab === 'projects'
              ? projectsError
              : activeTab === 'announcements'
                ? announcementsError
                : platformError || null;

    const hasTabData =
        activeTab === 'events'
            ? Boolean(eventsSummary)
            : activeTab === 'projects'
              ? Boolean(projectsSummary)
              : activeTab === 'announcements'
                ? Boolean(announcementsSummary)
                : Boolean(platformSummary);

    const handleExport = useCallback(async () => {
        if (!displayRange) return;
        setExporting(true);
        setExportError('');
        try {
            if (activeTab === 'platform') {
                if (!platformSummary) return;
                await exportUsageExcel({
                    tab: 'platform',
                    from: displayRange.startDate,
                    to: displayRange.endDate,
                    platform: platformSummary,
                });
            } else if (activeTab === 'events') {
                if (!eventsSummary) return;
                await exportUsageExcel({
                    tab: 'events',
                    from: displayRange.startDate,
                    to: displayRange.endDate,
                    eventsSummary,
                    events,
                });
            } else if (activeTab === 'projects') {
                if (!projectsSummary) return;
                await exportUsageExcel({
                    tab: 'projects',
                    from: displayRange.startDate,
                    to: displayRange.endDate,
                    projectsSummary,
                    projects,
                });
            } else {
                if (!announcementsSummary) return;
                await exportUsageExcel({
                    tab: 'announcements',
                    from: displayRange.startDate,
                    to: displayRange.endDate,
                    announcementsSummary,
                    announcements,
                });
            }
        } catch (err) {
            setExportError(getErrorMessage(err, 'Failed to export usage analytics'));
        } finally {
            setExporting(false);
        }
    }, [
        activeTab,
        displayRange,
        platformSummary,
        eventsSummary,
        events,
        projectsSummary,
        projects,
        announcementsSummary,
        announcements,
    ]);

    const seedCustomFromRange = (seed: PeriodRange | null) => {
        if (!seed) return;
        setCustomFrom(seed.startDate);
        setCustomTo(seed.endDate);
    };

    const handlePresetChange = (next: PeriodPreset) => {
        if (next === 'custom') {
            seedCustomFromRange(range ?? lastRange);
        }
        setPreset(next);
    };

    const retry = () => {
        const nextRange = range ?? lastRange ?? resolvePeriodRange('this_month');
        if (!nextRange) return;
        if (activeTab === 'events') {
            void refetchEvents();
        } else if (activeTab === 'projects') {
            void refetchProjects();
        } else if (activeTab === 'announcements') {
            void refetchAnnouncements();
        } else {
            void loadPlatform(nextRange);
        }
    };

    const canExport =
        activeTab === 'platform'
            ? Boolean(platformSummary)
            : activeTab === 'events'
              ? Boolean(eventsSummary)
              : activeTab === 'projects'
                ? Boolean(projectsSummary)
                : Boolean(announcementsSummary);

    const periodLabel =
        displayRange != null
            ? `${formatClubDay(displayRange.startDate)} – ${formatClubDay(displayRange.endDate)}`
            : platformSummary
              ? `${formatDate(platformSummary.since, { timeZone: CLUB_TIMEZONE })} – ${formatDate(platformSummary.until, { timeZone: CLUB_TIMEZONE })}`
              : null;

    const openEventDetail = (eventId: Id) => {
        setViewingEventId(eventId);
        setShowEventModal(true);
    };

    const openProjectDetail = (projectId: Id) => {
        setViewingProjectId(projectId);
        setShowProjectModal(true);
    };

    const openAnnouncementDetail = (announcementId: Id) => {
        setViewingAnnouncementId(announcementId);
        setShowAnnouncementModal(true);
    };

    const tabFatalError = Boolean(tabError && !isLoading && !hasTabData);

    return (
        <div className="members-page dev-usage-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Usage analytics</h1>
            </div>
            <hr className="title-divider" />

            {exportError ? <p className="error-message">{exportError}</p> : null}

            <div className="finance-cards-stack">
                <div className="card">
                    <div className="card-header card-header-with-action">
                        <div className="card-header-left">
                            <h3 className="card-title">Overview</h3>
                        </div>
                        <div className="dev-usage-card-actions">
                            <button
                                type="button"
                                className="btn btn-secondary finance-card-action"
                                onClick={retry}
                                disabled={isLoading || exporting || !displayRange}
                            >
                                {isLoading ? 'Refreshing…' : 'Refresh'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary finance-card-action"
                                onClick={() => void handleExport()}
                                disabled={exporting || isLoading || !canExport}
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
                            ariaLabel="Usage period"
                            onPresetChange={handlePresetChange}
                            onCustomFromChange={(value) => {
                                setCustomFrom(value);
                                setPreset('custom');
                            }}
                            onCustomToChange={(value) => {
                                setCustomTo(value);
                                setPreset('custom');
                            }}
                        />

                        {isLoading && !hasTabData ? (
                            <p className="loading-message">Loading usage analytics…</p>
                        ) : null}

                        {tabError && hasTabData ? (
                            <p className="error-message">{tabError}</p>
                        ) : null}

                        {periodLabel && hasTabData ? (
                            <p className="dev-usage-period-meta">
                                Period: {periodLabel}
                                {activeTab === 'platform' && platformSummary?.windowDays != null
                                    ? ` (${platformSummary.windowDays} day${platformSummary.windowDays === 1 ? '' : 's'})`
                                    : ''}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="card members-table-card usage-main-card">
                    <div className="certificates-tabs" role="tablist" aria-label="Usage sections">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'events'}
                            className={`certificates-tab-btn${activeTab === 'events' ? ' active' : ''}`}
                            onClick={() => setActiveTab('events')}
                        >
                            Events
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'projects'}
                            className={`certificates-tab-btn${activeTab === 'projects' ? ' active' : ''}`}
                            onClick={() => setActiveTab('projects')}
                        >
                            Projects
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'announcements'}
                            className={`certificates-tab-btn${activeTab === 'announcements' ? ' active' : ''}`}
                            onClick={() => setActiveTab('announcements')}
                        >
                            Announcements
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'platform'}
                            className={`certificates-tab-btn${activeTab === 'platform' ? ' active' : ''}`}
                            onClick={() => setActiveTab('platform')}
                        >
                            Platform
                        </button>
                    </div>

                    <div className="usage-tab-panel">
                        {tabFatalError ? (
                            <div>
                                <p className="error-message">{tabError}</p>
                                <button type="button" className="btn btn-primary" onClick={retry}>
                                    Retry
                                </button>
                            </div>
                        ) : null}

                        {!tabFatalError && activeTab === 'events' ? (
                            <>
                                {eventsSummary ? (
                                    <div className="dashboard-stats-grid">
                                        {EVENT_SUMMARY_STATS.map((stat) => (
                                            <div key={stat.key} className="dashboard-stat-tile">
                                                <p className="dashboard-stat-label">{stat.label}</p>
                                                <p className="dashboard-stat-value">
                                                    {stat.key === 'tasksPerEvent' ||
                                                    stat.key === 'totalAssignmentHours' ||
                                                    stat.key === 'totalEventDurationHours'
                                                        ? formatAvg(eventsSummary[stat.key])
                                                        : eventsSummary[stat.key]}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {eventsLoading && events.length === 0 ? (
                                    <p className="loading-message">Loading events…</p>
                                ) : events.length === 0 && eventsSummary ? (
                                    <p className="empty-state">No events created in this period.</p>
                                ) : events.length > 0 ? (
                                    <div className="members-table-shell">
                                        <div className="table-container">
                                            <table className="members-table">
                                                <thead>
                                                    <tr>
                                                        <th>Title</th>
                                                        <th>Venue</th>
                                                        <th>Date</th>
                                                        <th>Status</th>
                                                        <th>Regs</th>
                                                        <th>Sessions</th>
                                                        <th>Tickets</th>
                                                        <th>Reminders</th>
                                                        <th>Certs</th>
                                                        <th>Files</th>
                                                        <th>Photos</th>
                                                        <th>People</th>
                                                        <th>Hours</th>
                                                        <th>Tasks</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {events.map((row, index) => (
                                                        <tr
                                                            key={String(row.id)}
                                                            className={
                                                                index % 2 === 0
                                                                    ? 'even-row'
                                                                    : 'odd-row'
                                                            }
                                                        >
                                                            <td>{row.title || '—'}</td>
                                                            <td>{row.venue || '—'}</td>
                                                            <td>
                                                                {formatMaybeDateTime(row.eventDate)}
                                                            </td>
                                                            <td>{formatStatus(row.status)}</td>
                                                            <td>{row.registrations}</td>
                                                            <td>{row.sessions}</td>
                                                            <td>{row.ticketsSent}</td>
                                                            <td>{row.remindersSent}</td>
                                                            <td>{row.certificatesIssued}</td>
                                                            <td>{row.files}</td>
                                                            <td>{row.photos}</td>
                                                            <td>{row.peopleWorked}</td>
                                                            <td>{formatHours(row.assignmentHours)}</td>
                                                            <td>{row.tasks}</td>
                                                            <td>
                                                                <div className="action-buttons">
                                                                    <button
                                                                        type="button"
                                                                        className="table-action-btn view-btn"
                                                                        onClick={() =>
                                                                            openEventDetail(row.id)
                                                                        }
                                                                        title="View event usage"
                                                                    >
                                                                        <Eye />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {!tabFatalError && activeTab === 'projects' ? (
                            <>
                                {projectsSummary ? (
                                    <div className="dashboard-stats-grid">
                                        {PROJECT_SUMMARY_STATS.map((stat) => (
                                            <div key={stat.key} className="dashboard-stat-tile">
                                                <p className="dashboard-stat-label">{stat.label}</p>
                                                <p className="dashboard-stat-value">
                                                    {stat.key === 'totalPlannedDurationDays'
                                                        ? formatAvg(projectsSummary[stat.key])
                                                        : projectsSummary[stat.key]}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {projectsLoading && projects.length === 0 ? (
                                    <p className="loading-message">Loading projects…</p>
                                ) : projects.length === 0 && projectsSummary ? (
                                    <p className="empty-state">
                                        No projects created in this period.
                                    </p>
                                ) : projects.length > 0 ? (
                                    <div className="members-table-shell">
                                        <div className="table-container">
                                            <table className="members-table">
                                                <thead>
                                                    <tr>
                                                        <th>Title</th>
                                                        <th>Status</th>
                                                        <th>Start</th>
                                                        <th>Due</th>
                                                        <th>Completed</th>
                                                        <th>Tasks</th>
                                                        <th>Subtasks</th>
                                                        <th>Phases</th>
                                                        <th>People</th>
                                                        <th>Files</th>
                                                        <th>Photos</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {projects.map((row, index) => (
                                                        <tr
                                                            key={String(row.id)}
                                                            className={
                                                                index % 2 === 0
                                                                    ? 'even-row'
                                                                    : 'odd-row'
                                                            }
                                                        >
                                                            <td>{row.title || '—'}</td>
                                                            <td>{formatStatus(row.status)}</td>
                                                            <td>{formatMaybeDate(row.startDate)}</td>
                                                            <td>{formatMaybeDate(row.dueDate)}</td>
                                                            <td>
                                                                {formatMaybeDate(row.completedDate)}
                                                            </td>
                                                            <td>{row.tasks}</td>
                                                            <td>{row.subtasks}</td>
                                                            <td>{row.phases}</td>
                                                            <td>{row.peopleWorked}</td>
                                                            <td>{row.files}</td>
                                                            <td>{row.photos}</td>
                                                            <td>
                                                                <div className="action-buttons">
                                                                    <button
                                                                        type="button"
                                                                        className="table-action-btn view-btn"
                                                                        onClick={() =>
                                                                            openProjectDetail(row.id)
                                                                        }
                                                                        title="View project usage"
                                                                    >
                                                                        <Eye />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {!tabFatalError && activeTab === 'announcements' ? (
                            <>
                                {announcementsSummary ? (
                                    <div className="dashboard-stats-grid">
                                        {ANNOUNCEMENT_SUMMARY_STATS.map((stat) => (
                                            <div key={stat.key} className="dashboard-stat-tile">
                                                <p className="dashboard-stat-label">{stat.label}</p>
                                                <p className="dashboard-stat-value">
                                                    {stat.key === 'avgResponsesPerAnnouncement'
                                                        ? formatAvg(
                                                              announcementsSummary[stat.key],
                                                          )
                                                        : announcementsSummary[stat.key]}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {announcementsLoading && announcements.length === 0 ? (
                                    <p className="loading-message">Loading announcements…</p>
                                ) : announcements.length === 0 && announcementsSummary ? (
                                    <p className="empty-state">
                                        No announcements created in this period.
                                    </p>
                                ) : announcements.length > 0 ? (
                                    <div className="members-table-shell">
                                        <div className="table-container">
                                            <table className="members-table">
                                                <thead>
                                                    <tr>
                                                        <th>Title</th>
                                                        <th>Responses</th>
                                                        <th>Available</th>
                                                        <th>Unavailable</th>
                                                        <th>Target</th>
                                                        <th>Created</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {announcements.map((row, index) => (
                                                        <tr
                                                            key={String(row.id)}
                                                            className={
                                                                index % 2 === 0
                                                                    ? 'even-row'
                                                                    : 'odd-row'
                                                            }
                                                        >
                                                            <td>{row.title || '—'}</td>
                                                            <td>{row.responseCount}</td>
                                                            <td>{row.availableCount}</td>
                                                            <td>{row.unavailableCount}</td>
                                                            <td>
                                                                {formatAnnouncementTarget(
                                                                    row.targetType,
                                                                    row.eventTitle,
                                                                    row.projectTitle,
                                                                )}
                                                            </td>
                                                            <td>
                                                                {formatMaybeDateTime(row.createdAt)}
                                                            </td>
                                                            <td>
                                                                <div className="action-buttons">
                                                                    <button
                                                                        type="button"
                                                                        className="table-action-btn view-btn"
                                                                        onClick={() =>
                                                                            openAnnouncementDetail(
                                                                                row.id,
                                                                            )
                                                                        }
                                                                        title="View announcement usage"
                                                                    >
                                                                        <Eye />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {!tabFatalError && activeTab === 'platform' ? (
                            platformSummary ? (
                                <div className="dashboard-stats-grid">
                                    {PLATFORM_STATS.map((stat) => (
                                        <div key={stat.key} className="dashboard-stat-tile">
                                            <p className="dashboard-stat-label">{stat.label}</p>
                                            <p className="dashboard-stat-value">
                                                {platformSummary.counts[stat.key]}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : platformLoading ? (
                                <p className="loading-message">Loading platform usage…</p>
                            ) : null
                        ) : null}
                    </div>
                </div>
            </div>

            <EventUsageDetailModal
                isOpen={showEventModal}
                onClose={() => {
                    setShowEventModal(false);
                    setViewingEventId(null);
                }}
                eventId={viewingEventId}
                from={displayRange?.startDate ?? null}
                to={displayRange?.endDate ?? null}
            />

            <ProjectUsageDetailModal
                isOpen={showProjectModal}
                onClose={() => {
                    setShowProjectModal(false);
                    setViewingProjectId(null);
                }}
                projectId={viewingProjectId}
                from={displayRange?.startDate ?? null}
                to={displayRange?.endDate ?? null}
            />

            <AnnouncementUsageDetailModal
                isOpen={showAnnouncementModal}
                onClose={() => {
                    setShowAnnouncementModal(false);
                    setViewingAnnouncementId(null);
                }}
                announcementId={viewingAnnouncementId}
                from={displayRange?.startDate ?? null}
                to={displayRange?.endDate ?? null}
            />
        </div>
    );
}
