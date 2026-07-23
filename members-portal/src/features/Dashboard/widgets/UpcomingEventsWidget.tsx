'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DashboardMyActivitiesResponse, DashboardMyActivityItem } from '@iclub/shared';
import { formatEventDuration } from '@/features/Events/components/eventDateUtils';
import { formatDate } from '@iclub/shared/utils';
import { dashboardAPI } from '@/services/api';
import './UpcomingEventsWidget.css';

export interface UpcomingEventsWidgetProps {
    data?: DashboardMyActivitiesResponse | null;
    error?: string | null;
}

function activityHref(item: DashboardMyActivityItem): string {
    if (item.kind === 'event') {
        return `/events?event=${item.id}`;
    }
    return '/projects';
}

function activityMeta(item: DashboardMyActivityItem): string {
    if (item.kind === 'event') {
        const venue = item.venue?.trim();
        return [formatEventDuration(item.date, item.endDate), venue || null]
            .filter(Boolean)
            .join(' · ');
    }
    if (!item.date) return 'Project';
    return `Project · ${formatDate(item.date)}`;
}

export default function UpcomingEventsWidget({
    data,
    error: errorProp,
}: UpcomingEventsWidgetProps = {}) {
    const hasProvidedData = data != null;
    const hasProvidedError = !hasProvidedData && Boolean(errorProp);

    const [items, setItems] = useState<DashboardMyActivityItem[]>(() => data?.items ?? []);
    const [loading, setLoading] = useState(() => !hasProvidedData && !hasProvidedError);
    const [error, setError] = useState<string | null>(() =>
        hasProvidedData ? null : (errorProp ?? null),
    );

    useEffect(() => {
        if (data != null) {
            setItems(data.items);
            setLoading(false);
            setError(null);
            return;
        }

        if (errorProp) {
            setItems([]);
            setLoading(false);
            setError(errorProp);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await dashboardAPI.getMyActivities({ limit: 20 });
                if (!cancelled) {
                    setItems(response.items);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load activities');
                    setItems([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [data, errorProp]);

    return (
        <div className="card dashboard-side-card">
            <div className="card-header">
                <div className="card-header-left">
                    <h3 className="card-title">Activities</h3>
                    <p className="card-subtitle">
                        Events and projects you participate in
                    </p>
                </div>
            </div>
            <div className="card-body">
                {loading ? (
                    <p className="loading-message">Loading…</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : items.length === 0 ? (
                    <p className="empty-message">No upcoming activities right now.</p>
                ) : (
                    <div className="dashboard-list">
                        {items.map((item) => {
                            const meta = activityMeta(item);
                            const showBadges =
                                item.viaRegistration ||
                                item.viaTaskAssignment ||
                                item.viaCreated ||
                                item.viaTeam;

                            return (
                                <Link
                                    key={`${item.kind}-${item.id}`}
                                    href={activityHref(item)}
                                    className="dashboard-list-row dashboard-list-row--clickable dashboard-list-row--link"
                                >
                                    <div className="dashboard-list-row-main">
                                        <h4 className="dashboard-list-row-title">{item.title}</h4>
                                        <p className="dashboard-list-row-meta">{meta}</p>
                                    </div>
                                    {showBadges ? (
                                        <div className="dashboard-list-row-badges">
                                            {item.viaRegistration ? (
                                                <span className="badge upcoming-events-badge--registered">
                                                    Registered
                                                </span>
                                            ) : null}
                                            {item.viaTaskAssignment ? (
                                                <span className="badge upcoming-events-badge--assigned">
                                                    Assigned
                                                </span>
                                            ) : null}
                                            {item.viaCreated ? (
                                                <span className="badge upcoming-events-badge--created">
                                                    Created
                                                </span>
                                            ) : null}
                                            {item.viaTeam ? (
                                                <span className="badge upcoming-events-badge--team">
                                                    Team
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
