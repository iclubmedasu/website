'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Plus, Filter, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, projectTypesAPI, teamsAPI } from '@/services/api';
import CreateEventModal from './modals/CreateEventModal';
import EventFiltersModal from './modals/EventFiltersModal';
import EventCard from './components/EventCard/EventCard';
import HoldEventModal from './modals/HoldEventModal';
import AbortEventModal from './modals/AbortEventModal';
import FinalizeEventModal from './modals/FinalizeEventModal';
import ArchiveEventModal from './modals/ArchiveEventModal';
import ReactivateEventModal from './modals/ReactivateEventModal';
import EventActivityModal from './modals/EventActivityModal';
import { parseEventTab, type EventTabKey } from './components/eventUtils';
import type { EventDetail, EventQueryParams, EventSummary, Id, TeamRef } from '@/types/backend-contracts';
import './EventsPage.css';
import '../../features/Projects/ProjectsPage.css';

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

export default function EventsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pendingExpandRef = useRef<{ eventId: string; tab: EventTabKey | null } | null>(null);
    const deepLinkHandledRef = useRef(false);

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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EventDetail | null>(null);
    const [holdingEvent, setHoldingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [finalizingEvent, setFinalizingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [archivingEvent, setArchivingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [reactivatingEvent, setReactivatingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [abortingEvent, setAbortingEvent] = useState<EventSummary | EventDetail | null>(null);
    const [activityEvent, setActivityEvent] = useState<EventSummary | EventDetail | null>(null);

    const [expandedEventId, setExpandedEventId] = useState<Id | null>(null);
    const [expandedEventDetail, setExpandedEventDetail] = useState<EventDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [initialTab, setInitialTab] = useState<EventTabKey | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [allTeams, setAllTeams] = useState<TeamRef[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);

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

    const eventPermissions = useMemo(() => {
        const isPrivileged = !!(user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership);

        return {
            isPrivileged,
            canCreateEvent: isPrivileged && !!user?.id,
            canEditEvent: (event: EventSummary | EventDetail) => (
                isPrivileged
                && !!event?.isActive
                && !event?.isFinalized
                && !event?.isArchived
                && event?.status !== 'CANCELLED'
            ),
            canManageEvent: () => isPrivileged,
            canUploadToEvent: () => !!user?.id,
        };
    }, [user?.id, user?.isAdmin, user?.isDeveloper, user?.isLeadership, user?.isOfficer]);

    const canCreateEvent = eventPermissions.canCreateEvent;

    const filters = useMemo(() => ({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        scope: eventPermissions.canManageEvent() ? 'all' as const : 'published' as const,
    }), [dateFrom, dateTo, eventPermissions]);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await eventsAPI.getAll(filters);
            setEvents(result);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load events');
        } finally {
            setLoading(false);
        }
    }, [filters]);

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

    const handleToggleExpand = useCallback(async (event: EventSummary | EventDetail | null, tabOverride?: EventTabKey | null) => {
        if (!event) {
            setExpandedEventId(null);
            setExpandedEventDetail(null);
            setInitialTab(null);
            return;
        }

        if (expandedEventId === event.id) {
            setExpandedEventId(null);
            setExpandedEventDetail(null);
            setInitialTab(null);
            return;
        }

        if (tabOverride) setInitialTab(tabOverride);

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

    const handleRefreshDetail = useCallback(async () => {
        if (!expandedEventId) return;
        try {
            const detail = await eventsAPI.getById(expandedEventId);
            setExpandedEventDetail(detail);
            void loadEvents();
        } catch {
            /* swallow */
        }
    }, [expandedEventId, loadEvents]);

    const handleLifecycleRefresh = useCallback(() => {
        void loadEvents();
        if (expandedEventId) {
            void eventsAPI.getById(expandedEventId).then(setExpandedEventDetail).catch(() => {});
        }
    }, [expandedEventId, loadEvents]);

    const expandEventById = useCallback(async (eventId: string, tab: EventTabKey | null) => {
        const index = filteredEvents.findIndex((item) => String(item.id) === String(eventId));
        if (index >= 0) {
            setCurrentPage(Math.floor(index / EVENTS_PER_PAGE) + 1);
            await handleToggleExpand(filteredEvents[index], tab);
            return;
        }

        const summary = events.find((item) => String(item.id) === String(eventId));
        if (summary) {
            await handleToggleExpand(summary, tab);
            return;
        }

        setDetailLoading(true);
        try {
            const detail = await eventsAPI.getById(eventId);
            if (tab) setInitialTab(tab);
            setExpandedEventId(detail.id);
            setExpandedEventDetail(detail);
        } catch {
            setExpandedEventId(null);
            setExpandedEventDetail(null);
        } finally {
            setDetailLoading(false);
        }
    }, [events, filteredEvents, handleToggleExpand]);

    useEffect(() => {
        const eventId = searchParams.get('event');
        const tab = parseEventTab(searchParams.get('tab'));
        const create = searchParams.get('create');

        if (create === '1' || create === 'true') {
            setShowCreateModal(true);
        }

        if (eventId) {
            pendingExpandRef.current = { eventId, tab };
            deepLinkHandledRef.current = false;
        }

        if (eventId || create) {
            router.replace('/events', { scroll: false });
        }
    }, [searchParams, router]);

    useEffect(() => {
        if (loading || deepLinkHandledRef.current || !pendingExpandRef.current) return;

        const { eventId, tab } = pendingExpandRef.current;
        pendingExpandRef.current = null;
        deepLinkHandledRef.current = true;
        void expandEventById(eventId, tab);
    }, [loading, events, expandEventById]);

    const handleEventCreated = useCallback(async (saved: EventDetail) => {
        setShowCreateModal(false);
        await loadEvents();
        setCurrentPage(1);
        await handleToggleExpand(saved, 'statistics');
    }, [loadEvents, handleToggleExpand]);

    const hasActiveFilters = status !== '' || dateFrom !== '' || dateTo !== ''
        || filterTeam !== '' || filterCategory !== '' || filterPriority !== '';

    const handleOpenFilters = () => {
        setShowFiltersModal(true);
    };

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

    const expandedEventSummary = useMemo((): EventSummary | null => {
        if (!expandedEventId) return null;
        const inPage = paginatedEvents.find((item) => item.id === expandedEventId);
        if (inPage) return inPage;
        const inList = events.find((item) => item.id === expandedEventId);
        if (inList) return inList;
        if (expandedEventDetail) return expandedEventDetail as EventSummary;
        return null;
    }, [expandedEventId, paginatedEvents, events, expandedEventDetail]);

    const showOrphanExpandedCard = expandedEventSummary
        && !paginatedEvents.some((item) => item.id === expandedEventId);

    return (
        <main className="events-page">
            <div className="page-header">
                <div>
                    <h1 className="projects-title">Event Management</h1>
                </div>
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
                        placeholder="Search events"
                        aria-label="Search events"
                    />
                    <button
                        type="button"
                        className={`page-search-filter-btn${hasActiveFilters ? ' page-search-filter-btn--active' : ''}`}
                        onClick={handleOpenFilters}
                        aria-label="Open advanced filters"
                    >
                        <Filter size={16} />
                        <span className="page-search-filter-label">Advanced Filters</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="empty-message">Loading events…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : filteredEvents.length === 0 ? (
                <div className="empty-state">
                    <Calendar className="empty-state-icon" />
                    <h4 className="empty-state-title">{searchQuery || hasActiveFilters ? 'No events found' : 'No events yet'}</h4>
                    <p className="empty-state-text">
                        {searchQuery || hasActiveFilters
                            ? 'Try a different search or adjust the filters.'
                            : 'Create your first event to get started.'}
                    </p>
                    {canCreateEvent ? (
                        <button className="empty-state-btn" onClick={() => setShowCreateModal(true)}>
                            <Plus />
                            New Event
                        </button>
                    ) : null}
                </div>
            ) : (
                <>
                    <div className="projects-grid">
                        {paginatedEvents.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                expanded={expandedEventId === event.id}
                                fullDetail={expandedEventId === event.id ? expandedEventDetail : null}
                                detailLoading={expandedEventId === event.id && detailLoading}
                                initialTab={expandedEventId === event.id ? initialTab : null}
                                canEdit={eventPermissions.canEditEvent(event)}
                                canManage={eventPermissions.canManageEvent()}
                                canUpload={eventPermissions.canUploadToEvent()}
                                onToggle={handleToggleExpand}
                                onEdit={(target) => setEditingEvent(target as EventDetail)}
                                onDeactivate={setHoldingEvent}
                                onFinalize={setFinalizingEvent}
                                onArchive={setArchivingEvent}
                                onReactivate={setReactivatingEvent}
                                onAbort={setAbortingEvent}
                                onViewActivity={setActivityEvent}
                                onReloadDetail={() => void handleRefreshDetail()}
                            />
                        ))}
                        {canCreateEvent && currentPage === 1 ? (
                            <div
                                className="project-add-card"
                                onClick={() => setShowCreateModal(true)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => event.key === 'Enter' && setShowCreateModal(true)}
                            >
                                <Plus className="project-add-card-icon" />
                                <span className="project-add-card-text">New Event</span>
                            </div>
                        ) : null}
                    </div>
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="pagination-btn"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                type="button"
                            >
                                Previous
                            </button>
                            <div className="pagination-pages">
                                {getPageNumbers(currentPage, totalPages).map((p, i) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            className={`pagination-page-btn${p === currentPage ? ' pagination-page-btn--active' : ''}`}
                                            onClick={() => setCurrentPage(p)}
                                        >
                                            {p}
                                        </button>
                                    ),
                                )}
                            </div>
                            <button
                                className="pagination-btn"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                type="button"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {expandedEventId && detailLoading && !expandedEventDetail && (
                <div className="project-detail-loading-indicator">
                    Loading details…
                </div>
            )}

            {showOrphanExpandedCard && expandedEventSummary ? (
                <EventCard
                    event={expandedEventSummary}
                    expanded
                    fullDetail={expandedEventDetail}
                    detailLoading={detailLoading}
                    initialTab={initialTab}
                    canEdit={eventPermissions.canEditEvent(expandedEventSummary)}
                    canManage={eventPermissions.canManageEvent()}
                    canUpload={eventPermissions.canUploadToEvent()}
                    onToggle={handleToggleExpand}
                    onEdit={(target) => setEditingEvent(target as EventDetail)}
                    onDeactivate={setHoldingEvent}
                    onFinalize={setFinalizingEvent}
                    onArchive={setArchivingEvent}
                    onReactivate={setReactivatingEvent}
                    onAbort={setAbortingEvent}
                    onViewActivity={setActivityEvent}
                    onReloadDetail={() => void handleRefreshDetail()}
                />
            ) : null}

            {showFiltersModal ? (
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
            ) : null}

            {showCreateModal && (
                <CreateEventModal
                    allTeams={allTeams}
                    userTeamIds={user?.teamIds ?? []}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleEventCreated}
                />
            )}

            {editingEvent && (
                <CreateEventModal
                    mode="edit"
                    initial={editingEvent}
                    allTeams={allTeams}
                    userTeamIds={user?.teamIds ?? []}
                    onClose={() => setEditingEvent(null)}
                    onSaved={(saved) => {
                        setEditingEvent(null);
                        void handleLifecycleRefresh();
                        if (expandedEventId === saved.id) {
                            setExpandedEventDetail(saved);
                        }
                    }}
                />
            )}

            {holdingEvent && (
                <HoldEventModal
                    event={holdingEvent}
                    onClose={() => setHoldingEvent(null)}
                    onHeld={() => {
                        setHoldingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {finalizingEvent && (
                <FinalizeEventModal
                    event={finalizingEvent}
                    onClose={() => setFinalizingEvent(null)}
                    onFinalized={() => {
                        setFinalizingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {archivingEvent && (
                <ArchiveEventModal
                    event={archivingEvent}
                    onClose={() => setArchivingEvent(null)}
                    onArchived={() => {
                        setArchivingEvent(null);
                        if (expandedEventId === archivingEvent.id) {
                            setExpandedEventId(null);
                            setExpandedEventDetail(null);
                        }
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {reactivatingEvent && (
                <ReactivateEventModal
                    event={reactivatingEvent}
                    onClose={() => setReactivatingEvent(null)}
                    onReactivated={() => {
                        setReactivatingEvent(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {abortingEvent && (
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
        </main>
    );
}
