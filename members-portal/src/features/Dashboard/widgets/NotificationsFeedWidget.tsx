'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Id, NotificationItem } from '@iclub/shared';
import { notificationsAPI } from '@/services/api';
import { NotificationListItem } from '@/features/Notifications/NotificationListItem';

export interface NotificationsFeedWidgetProps {
    notifications?: NotificationItem[] | null;
    error?: string | null;
    onMarkedRead?: () => void;
}

export default function NotificationsFeedWidget({
    notifications: notificationsProp,
    error: errorProp,
    onMarkedRead,
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
    const [markingIds, setMarkingIds] = useState<Set<Id>>(new Set());

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

    const handleMarkRead = async (notificationId: Id) => {
        setMarkingIds((previous) => new Set(previous).add(notificationId));
        try {
            await notificationsAPI.markRead(notificationId);
            setNotifications((previous) =>
                previous.map((notification) =>
                    notification.id === notificationId
                        ? { ...notification, isRead: true, readAt: new Date().toISOString() }
                        : notification,
                ),
            );
            onMarkedRead?.();
        } finally {
            setMarkingIds((previous) => {
                const next = new Set(previous);
                next.delete(notificationId);
                return next;
            });
        }
    };

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
                    <div className="notification-list">
                        {notifications.map((notification) => (
                            <NotificationListItem
                                key={notification.id}
                                notification={notification}
                                timeMode="relative"
                                marking={markingIds.has(notification.id)}
                                onMarkRead={(id) => void handleMarkRead(id)}
                            />
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
