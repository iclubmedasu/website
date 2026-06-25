'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Filter, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, projectTypesAPI, teamsAPI } from '@/services/api';
import EventCard from './components/EventCard/EventCard';
import AbortEventModal from './modals/AbortEventModal';
import ArchiveEventModal from './modals/ArchiveEventModal';
import EventActivityModal from './modals/EventActivityModal';
import EventFiltersModal from './modals/EventFiltersModal';
import FinalizeEventModal from './modals/FinalizeEventModal';
import ReactivateEventModal from './modals/ReactivateEventModal';
import type { EventDetail, EventQueryParams, EventSummary, Id, TeamRef } from '@/types/backend-contracts';
import './EventsPage.css';

const EVENTS_PER_PAGE = 10;

function getPageNumbers(current: number, total: number): Array<number | '...'> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | '...'> = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

export default function PastEventsPage() {
    const { user } = useAuth();
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [status, setStatus] = useState<EventQueryParams['status'] | ''>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterTeam, setFilterTeam] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [allTeams, setAllTeams] = useState<TeamRef[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);
    const [expandedEventId, setExpandedEventId] = useState<Id | null>(null);
    const [expandedEventDetail, setExpandedEventDetail] = useState<EventDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [reactivatingEvent, setReactivatingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [finalizingEvent, setFinalizingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [archivingEvent, setArchivingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [abortingEvent, setAbortingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [activityEvent, setActivityEvent] = useState<EventSummary | EventDetail | null>(null);

    const eventPermissions = useMemo(() => {
        const isLifecycleRole = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership);
        const canViewAllEvents = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
        const isElevatedWorkItemRole = isLifecycleRole || !!user?.isSpecial;

        return {
            isLifecycleRole,
            canViewAllEvents,
            isElevatedWorkItemRole,
            canManageLifecycle: isLifecycleRole,
            canManageTiers: isElevatedWorkItemRole,
            canManageTasks: isElevatedWorkItemRole,
            canManageFields: true,
            canUploadToEvent: () => !!user?.id,
        };
    }, [user?.id, user?.isAdmin, user?.isDeveloper, user?.isLeadership, user?.isOfficer, user?.isSpecial]);

    const canManageLifecycle = eventPermissions.canManageLifecycle;
    const hasActiveFilters = status !== '' || dateFrom !== '' || dateTo !== ''
        || filterTeam !== '' || filterCategory !== '' || filterPriority !== '';

    useEffect(() => {
        Promise.all([
            teamsAPI.getAll(undefined, 'all').catch(() => [] as TeamRef[]),
            projectTypesAPI.getAll().catch(() => []),
        ]).then(([teams, types]) => {
            setAllTeams(Array.isArray(teams) ? teams : []);
            const categories = [...new Set(
                (Array.isArray(types) ? types : [])
                    .map((typeItem) => typeItem.category)
                    .filter((category): category is string => typeof category === 'string' && category.length > 0),
            )];
            setAllCategories(categories);
        });
    }, []);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await eventsAPI.getAll({
                archived: true,
                scope: 'all',
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            });
            setEvents(result);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load past events');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => {
        void loadEvents();
    }, [loadEvents]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, status, dateFrom, dateTo, filterTeam, filterCategory, filterPriority]);

    const filteredEvents = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return events.filter((event) => {
            if (status && event.status !== status) return false;
            if (filterTeam && !event.eventTeams?.some((entry) => String(entry.teamId) === filterTeam)) return false;
            if (filterCategory && event.projectType?.category !== filterCategory) return false;
            if (filterPriority && event.priority !== filterPriority) return false;
            if (!query) return true;
            return [event.title, event.venue, event.description].some((value) => String(value || '').toLowerCase().includes(query));
        });
    }, [events, searchQuery, status, filterTeam, filterCategory, filterPriority]);

    const totalPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
    const paginatedEvents = useMemo(() => {
        const start = (currentPage - 1) * EVENTS_PER_PAGE;
        return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
    }, [filteredEvents, currentPage]);

    const handleToggleExpand = useCallback(async (event: EventSummary | null) => {
        if (!event) {
            setExpandedEventId(null);
            setExpandedEventDetail(null);
            return;
        }

        if (expandedEventId === event.id) {
            setExpandedEventId(null);
            setExpandedEventDetail(null);
            return;
        }

        setExpandedEventId(event.id);
        setDetailLoading(true);
        try {
            const detail = await eventsAPI.getById(event.id);
            setExpandedEventDetail(detail);
        } catch {
            setExpandedEventDetail(null);
        } finally {
            setDetailLoading(false);
        }
    }, [expandedEventId]);

    const handleLifecycleRefresh = useCallback(() => {
        void loadEvents();
        if (expandedEventId) {
            void eventsAPI.getById(expandedEventId).then(setExpandedEventDetail).catch(() => {});
        }
    }, [expandedEventId, loadEvents]);

    const handleToggleDisclose = useCallback(async (event: EventSummary | EventDetail) => {
        try {
            await eventsAPI.setDisclosed(event.id, !event.isDisclosed);
            handleLifecycleRefresh();
        } catch (discloseError) {
            setError(discloseError instanceof Error ? discloseError.message : 'Failed to update website visibility');
        }
    }, [handleLifecycleRefresh]);

    const handleApplyFilters = (nextFilters: {
        status: EventQueryParams['status'] | '';
        dateFrom: string;
        dateTo: string;
        filterTeam: string;
        filterCategory: string;
        filterPriority: string;
    }) => {
        setStatus(nextFilters.status);
        setDateFrom(nextFilters.dateFrom);
        setDateTo(nextFilters.dateTo);
        setFilterTeam(nextFilters.filterTeam);
        setFilterCategory(nextFilters.filterCategory);
        setFilterPriority(nextFilters.filterPriority);
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        setStatus('');
        setDateFrom('');
        setDateTo('');
        setFilterTeam('');
        setFilterCategory('');
        setFilterPriority('');
    };

    return (
        <main className="events-page">
            <div className="page-header">
                <h1 className="events-title">Past Events</h1>
            </div>
            <hr className="title-divider" />

            <div className="page-search-row">
                <div className="page-search-field page-search-field--full">
                    <Search className="page-search-icon" size={16} />
                    <input
                        type="search"
                        className="page-search-input"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search archived events"
                        aria-label="Search archived events"
                    />
                    <button
                        type="button"
                        className={`page-search-filter-btn${hasActiveFilters ? ' page-search-filter-btn--active' : ''}`}
                        onClick={() => setShowFiltersModal(true)}
                        aria-label="Open advanced filters"
                    >
                        <Filter size={16} />
                        <span className="page-search-filter-label">Advanced Filters</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="empty-message">Loading past events…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : filteredEvents.length === 0 ? (
                <div className="empty-state">
                    <Archive className="empty-state-icon" />
                    <h4 className="empty-state-title">{searchQuery || hasActiveFilters ? 'No archived events found' : 'No archived events'}</h4>
                    <p className="empty-state-text">
                        {searchQuery || hasActiveFilters ? 'Try a different search or adjust the filters.' : 'Events that have been archived will appear here.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="events-grid">
                        {paginatedEvents.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                expanded={expandedEventId === event.id}
                                fullDetail={expandedEventId === event.id ? expandedEventDetail : null}
                                detailLoading={expandedEventId === event.id && detailLoading}
                                canEdit={false}
                                canManage={canManageLifecycle}
                                canUpload={eventPermissions.canUploadToEvent()}
                                canManageTiers={eventPermissions.canManageTiers}
                                canManageTasks={eventPermissions.canManageTasks}
                                canManageFields={eventPermissions.canManageFields}
                                archivedView
                                onToggle={handleToggleExpand}
                                onEdit={() => {}}
                                onDeactivate={() => {}}
                                onFinalize={setFinalizingEvent}
                                onArchive={setArchivingEvent}
                                onReactivate={setReactivatingEvent}
                                onAbort={setAbortingEvent}
                                onToggleDisclose={canManageLifecycle ? handleToggleDisclose : undefined}
                                onViewActivity={setActivityEvent}
                            />
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button className="pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} type="button">Previous</button>
                            <div className="pagination-pages">
                                {getPageNumbers(currentPage, totalPages).map((p, i) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                                    ) : (
                                        <button key={p} type="button" className={`pagination-page-btn${p === currentPage ? ' pagination-page-btn--active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                                    ),
                                )}
                            </div>
                            <button className="pagination-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} type="button">Next</button>
                        </div>
                    )}
                </>
            )}

            {expandedEventId && detailLoading && !expandedEventDetail && (
                <div className="project-detail-loading-indicator">Loading details…</div>
            )}

            {canManageLifecycle && reactivatingEvent && (
                <ReactivateEventModal
                    event={reactivatingEvent}
                    onClose={() => setReactivatingEvent(null)}
                    onReactivated={() => {
                        setReactivatingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {canManageLifecycle && finalizingEvent && (
                <FinalizeEventModal
                    event={finalizingEvent}
                    onClose={() => setFinalizingEvent(null)}
                    onFinalized={() => {
                        setFinalizingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {canManageLifecycle && archivingEvent && (
                <ArchiveEventModal
                    event={archivingEvent}
                    onClose={() => setArchivingEvent(null)}
                    onArchived={() => {
                        setArchivingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {canManageLifecycle && abortingEvent && (
                <AbortEventModal
                    event={abortingEvent}
                    onClose={() => setAbortingEvent(null)}
                    onAborted={() => {
                        setAbortingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {activityEvent && (
                <EventActivityModal
                    event={activityEvent}
                    onClose={() => setActivityEvent(null)}
                />
            )}

            {showFiltersModal && (
                <EventFiltersModal
                    status={status}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    filterTeam={filterTeam}
                    filterCategory={filterCategory}
                    filterPriority={filterPriority}
                    allTeams={allTeams}
                    allCategories={allCategories}
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyFilters}
                    onClear={handleResetFilters}
                />
            )}
        </main>
    );
}
