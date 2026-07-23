'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { NotificationItem } from '@iclub/shared';
import { notificationsAPI } from '@/services/api';

export interface NotificationsFeedWidgetProps {
    notifications?: NotificationItem[] | null;
    error?: string | null;
}

export default function NotificationsFeedWidget({
    notifications: notificationsProp,
    error: errorProp,
}: NotificationsFeedWidgetProps = {}) {
    const hasProvidedData = notificationsProp != null;
    const hasProvidedError = !hasProvidedData && Boolean(errorProp);

    const [notifications, setNotifications] = useState<NotificationItem[]>(
        () => notificationsProp ?? [],
    );
    const [loading, setLoading] = useState(() => !hasProvidedData && !hasProvidedError);
    const [error, setError] = useState<string | null>(() =>
        hasProvidedData ? null : (errorProp ?? null),
    );

    useEffect(() => {
        if (notificationsProp != null) {
            setNotifications(notificationsProp);
            setLoading(false);
            setError(null);
            return;
        }

        if (errorProp) {
            setNotifications([]);
            setLoading(false);
            setError(errorProp);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);
                const result = await notificationsAPI.getAll({ limit: 5 });
                if (!cancelled) {
                    setNotifications(result.notifications);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load notifications');
                    setNotifications([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [notificationsProp, errorProp]);

    return (
        <div className="card dashboard-side-card">
            <div className="card-header">
                <div className="card-header-left">
                    <h3 className="card-title">Recent Notifications</h3>
                    <p className="card-subtitle">Latest updates from across the club</p>
                </div>
            </div>
            <div className="card-body">
                {loading ? (
                    <p className="loading-message">Loading…</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : notifications.length === 0 ? (
                    <p className="empty-message">No notifications yet.</p>
                ) : (
                    <div className="dashboard-list">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`dashboard-list-row dashboard-notification-row${notification.isRead ? ' is-read' : ''}`}
                            >
                                <h4 className="dashboard-list-row-title">{notification.title}</h4>
                                <p className="dashboard-list-row-meta">{notification.body}</p>
                                <time
                                    className="dashboard-list-row-meta dashboard-notification-time"
                                    dateTime={notification.createdAt}
                                >
                                    {formatDistanceToNow(parseISO(notification.createdAt), {
                                        addSuffix: true,
                                    })}
                                </time>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="card-footer">
                <Link href="/user#notifications" className="dashboard-view-all">
                    View all
                </Link>
            </div>
        </div>
    );
}
