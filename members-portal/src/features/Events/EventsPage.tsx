'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CirclePlus, Filter, MapPin, Search, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI } from '@/services/api';
import CreateEventModal from './modals/CreateEventModal';
import EventFiltersModal from './modals/EventFiltersModal';
import type { EventQueryParams, EventSummary } from '@/types/backend-contracts';
import './EventsPage.css';

function formatDate(value?: string | null) {
    if (!value) return 'TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export default function EventsPage() {
    const { user } = useAuth();
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [status, setStatus] = useState<EventQueryParams['status'] | ''>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFiltersModal, setShowFiltersModal] = useState(false);

    // ── Permission helpers ──
    // Privileged roles: developer, officer, admin, leadership
    const eventPermissions = useMemo(() => {
        const isPrivileged = !!(user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership);
        const isElevatedWorkItemRole = isPrivileged || !!user?.isSpecial;

        return {
            isPrivileged,
            isElevatedWorkItemRole,
            // Only privileged roles with a real member identity can create/edit/manage events
            canCreateEvent: isPrivileged && !!user?.id,
            canEditEvent: (event: any) => isPrivileged && !!event?.isActive && !event?.isFinalized && event?.status !== 'CANCELLED',
            // canManageEvent: finalize, archive, hold, abort, publish, reactivate (NOT blocked by finalized)
            canManageEvent: () => isPrivileged,
            // Upload follows backend visibility scope: if an event is visible to the user, upload is allowed.
            canUploadToEvent: () => !!user?.id,
        };
    }, [user?.id, user?.isAdmin, user?.isDeveloper, user?.isLeadership, user?.isOfficer, user?.isSpecial]);

    const canCreateEvent = eventPermissions.canCreateEvent;

    const filters = useMemo(() => ({
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        scope: eventPermissions.canManageEvent() ? 'all' as const : 'published' as const,
    }), [dateFrom, dateTo, eventPermissions, status]);

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

    const filteredEvents = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return events.filter((event) => {
            if (!query) return true;
            return [event.title, event.venue, event.description].some((value) => String(value || '').toLowerCase().includes(query));
        });
    }, [events, searchQuery]);

    const hasActiveFilters = status !== '' || dateFrom !== '' || dateTo !== '';
    const statusClassName: Record<string, string> = {
        DRAFT: 'event-status-badge event-status-badge--draft',
        PUBLISHED: 'event-status-badge event-status-badge--published',
        COMPLETED: 'event-status-badge event-status-badge--completed',
        CANCELLED: 'event-status-badge event-status-badge--cancelled',
    };

    const handleOpenFilters = () => {
        setShowFiltersModal(true);
    };

    const handleApplyFilters = (nextFilters: {
        status: EventQueryParams['status'] | '';
        dateFrom: string;
        dateTo: string;
    }) => {
        setStatus(nextFilters.status);
        setDateFrom(nextFilters.dateFrom);
        setDateTo(nextFilters.dateTo);
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        setStatus('');
        setDateFrom('');
        setDateTo('');
    };

    return (
        <main className="events-page">
            <div className="page-header">
                <div>
                    <h1 className="projects-title">Event Management</h1>
                </div>
            </div>

            <hr className="title-divider" />

            <div className="page-search-row events-search-row">
                <div className="events-search-field page-search-field page-search-field--full">
                    <Search className="events-search-icon" size={16} />
                    <input
                        type="search"
                        className="events-search-input page-search-input"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search events"
                        aria-label="Search events"
                    />
                    <button
                        type="button"
                        className={`events-search-filter-btn${hasActiveFilters ? ' events-search-filter-btn--active' : ''}`}
                        onClick={handleOpenFilters}
                        aria-label="Open advanced filters"
                    >
                        <Filter size={16} />
                        <span className="events-search-filter-label">Advanced Filters</span>
                    </button>
                </div>
            </div>

            {error ? (
                <div className="events-error">{error}</div>
            ) : null}

            {loading ? (
                <div className="empty-message">Loading events…</div>
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
                            <CirclePlus />
                            New Event
                        </button>
                    ) : null}
                </div>
            ) : (
                <div className="events-grid">
                    {filteredEvents.map((event) => {
                        const registrationCount = event._count?.registrations ?? event.registrationCount ?? 0;
                        const capacity = event.capacity ?? null;

                        return (
                            <Link
                                key={event.id}
                                href={`/events/${event.id}`}
                                className="event-card"
                            >
                                <div className="event-card-collapsed-content">
                                    <div>
                                        <span className={statusClassName[event.status] ?? 'event-status-badge'}>
                                            {event.status.replaceAll('_', ' ')}
                                        </span>
                                        <h2 className="event-card-title">{event.title}</h2>
                                        {event.createdBy?.fullName ? (
                                            <div className="event-meta-row event-meta-row--compact">
                                                <Users size={14} />
                                                <span>Created by {event.createdBy.fullName}</span>
                                            </div>
                                        ) : null}
                                        <p className="event-card-description">
                                            {event.description || 'No description yet'}
                                        </p>
                                        <div className="event-meta-row">
                                            <Calendar size={14} />
                                            <span>{formatDate(event.eventDate)}</span>
                                        </div>
                                        {event.venue ? (
                                            <div className="event-meta-row">
                                                <MapPin size={14} />
                                                <span>{event.venue}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="event-card-bottom-bar">
                                    <div className="event-meta-row event-meta-row--compact">
                                        <Users size={14} />
                                        <span>
                                            {registrationCount} registered
                                            {capacity != null ? ` / ${capacity}` : ''}
                                        </span>
                                    </div>
                                    {capacity != null ? (
                                        <strong className="event-card-availability">{Math.max(capacity - registrationCount, 0)} left</strong>
                                    ) : (
                                        <strong className="event-card-availability">Unlimited</strong>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                    {canCreateEvent ? (
                        <div
                            className="event-add-card"
                            onClick={() => setShowCreateModal(true)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => event.key === 'Enter' && setShowCreateModal(true)}
                        >
                            <CirclePlus className="event-add-card-icon" />
                            <span className="event-add-card-text">New Event</span>
                        </div>
                    ) : null}
                </div>
            )}

            {showFiltersModal ? (
                <EventFiltersModal
                    status={status}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyFilters}
                    onClear={handleResetFilters}
                />
            ) : null}

            {showCreateModal && (
                <CreateEventModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        setShowCreateModal(false);
                        void loadEvents();
                    }}
                />
            )}
        </main>
    );
}
