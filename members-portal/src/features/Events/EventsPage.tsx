'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CirclePlus, MapPin, Search, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI } from '@/services/api';
import EventCreatePage from '@/features/Events/EventCreatePage';
import type { EventQueryParams, EventSummary } from '@/types/backend-contracts';
import '../Projects/ProjectsPage.css';

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

    const filters = useMemo(() => ({
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        scope: (user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership) ? 'all' as const : 'published' as const,
    }), [dateFrom, dateTo, status, user?.isAdmin, user?.isDeveloper, user?.isLeadership, user?.isOfficer]);

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

    const activeEventCount = events.filter((event) => event.status !== 'CANCELLED').length;
    const filteredEvents = events.filter((event) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return [event.title, event.venue, event.description].some((value) => String(value || '').toLowerCase().includes(query));
    });

    return (
        <main style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div>
                    <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.35rem' }}>Events</p>
                    <h1 style={{ fontSize: '2rem', lineHeight: 1.1, margin: 0 }}>Event Management</h1>
                    <p style={{ marginTop: '0.5rem', color: '#4b5563', maxWidth: '60ch' }}>
                        Create, publish, and manage club events from one place.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#111827',
                        color: '#fff',
                        padding: '0.8rem 1rem',
                        borderRadius: '999px',
                        fontWeight: 600,
                        border: 'none',
                    }}
                >
                    <CirclePlus size={18} />
                    New Event
                </button>
            </div>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={summaryCardStyle}>
                    <span style={summaryLabelStyle}>Total Events</span>
                    <strong style={summaryValueStyle}>{events.length}</strong>
                </div>
                <div style={summaryCardStyle}>
                    <span style={summaryLabelStyle}>Active Events</span>
                    <strong style={summaryValueStyle}>{activeEventCount}</strong>
                </div>
                <div style={summaryCardStyle}>
                    <span style={summaryLabelStyle}>Drafts</span>
                    <strong style={summaryValueStyle}>{events.filter((event) => event.status === 'DRAFT').length}</strong>
                </div>
                <div style={summaryCardStyle}>
                    <span style={summaryLabelStyle}>Published</span>
                    <strong style={summaryValueStyle}>{events.filter((event) => event.status === 'PUBLISHED').length}</strong>
                </div>
            </section>

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
                </div>
            </div>

            <section style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <select value={status} onChange={(event) => setStatus(event.target.value as EventQueryParams['status'] | '')} style={filterStyle}>
                    <option value="">All statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={filterStyle} />
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={filterStyle} />
            </section>

            {error ? (
                <div style={errorStyle}>{error}</div>
            ) : null}

            {loading ? (
                <div style={emptyStateStyle}>Loading events…</div>
            ) : filteredEvents.length === 0 ? (
                <div style={emptyStateStyle}>No events match the current filters.</div>
            ) : (
                <section className="projects-grid">
                    {filteredEvents.map((event) => {
                        const registrationCount = event._count?.registrations ?? event.registrationCount ?? 0;
                        const capacity = event.capacity ?? null;
                        const remaining = capacity == null ? null : Math.max(capacity - registrationCount, 0);
                        const statusColor = statusPalette[event.status] ?? '#475569';

                        return (
                            <Link
                                key={event.id}
                                href={`/events/${event.id}`}
                                className="project-card"
                            >
                                <div className="project-card-collapsed-content">
                                    <div>
                                        <span style={{ ...statusBadgeStyle, background: `${statusColor}18`, color: statusColor }}>
                                            {event.status.replaceAll('_', ' ')}
                                        </span>
                                        <h2 className="project-card-title" style={{ margin: '0.75rem 0 0.35rem' }}>{event.title}</h2>
                                        <p className="project-card-description" style={{ marginTop: 0 }}>
                                            {event.description || 'No description yet'}
                                        </p>
                                        <div style={metaRowStyle}>
                                            <Calendar size={14} />
                                            <span>{formatDate(event.eventDate)}</span>
                                        </div>
                                        {event.venue ? (
                                            <div style={metaRowStyle}>
                                                <MapPin size={14} />
                                                <span>{event.venue}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="project-card-bottom-bar">
                                    <div className="project-card-footer-trailing" style={{ alignItems: 'center' }}>
                                        <Users size={14} />
                                        <span>
                                            {registrationCount} registered
                                            {capacity != null ? ` / ${capacity}` : ''}
                                        </span>
                                    </div>
                                    {remaining != null ? (
                                        <strong style={{ color: '#0f172a' }}>{remaining} left</strong>
                                    ) : (
                                        <strong style={{ color: '#0f172a' }}>Unlimited</strong>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </section>
            )}

            {showCreateModal && (
                <EventCreatePage
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

const summaryCardStyle: React.CSSProperties = {
    borderRadius: '1rem',
    background: '#fff',
    padding: '1rem',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
    display: 'grid',
    gap: '0.25rem',
};

const summaryLabelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#64748b',
};

const summaryValueStyle: React.CSSProperties = {
    fontSize: '1.8rem',
    color: '#0f172a',
};

const filterStyle: React.CSSProperties = {
    minHeight: '46px',
    borderRadius: '0.85rem',
    border: '1px solid rgba(15, 23, 42, 0.14)',
    background: '#fff',
    padding: '0 0.9rem',
    color: '#0f172a',
};

const errorStyle: React.CSSProperties = {
    marginBottom: '1rem',
    borderRadius: '1rem',
    background: '#fef2f2',
    color: '#991b1b',
    padding: '1rem',
    border: '1px solid #fecaca',
};

const emptyStateStyle: React.CSSProperties = {
    borderRadius: '1rem',
    background: 'rgba(255, 255, 255, 0.75)',
    border: '1px dashed rgba(15, 23, 42, 0.14)',
    padding: '1.5rem',
    color: '#475569',
};

const statusBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
};

const metaRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    color: '#475569',
    marginTop: '0.3rem',
};

const statusPalette: Record<string, string> = {
    DRAFT: '#64748b',
    PUBLISHED: '#0f766e',
    COMPLETED: '#2563eb',
    CANCELLED: '#b91c1c',
};
