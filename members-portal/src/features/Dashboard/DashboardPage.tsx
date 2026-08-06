'use client';

import { useEffect, useState } from 'react';
import type {
    DashboardMyActivitiesResponse,
    DashboardMyTasksResponse,
    NotificationItem,
    NotificationUnreadCountResponse,
} from '@iclub/shared';
import { dashboardAPI, notificationsAPI } from '@/services/api';
import { syncAppBadge } from '@/lib/appBadge';
import AnnouncementsFeed from '@/features/Announcements/AnnouncementsFeed';
import MyTasksWidget from './widgets/MyTasksWidget';
import UpcomingEventsWidget from './widgets/UpcomingEventsWidget';
import NotificationsFeedWidget from './widgets/NotificationsFeedWidget';
import QuickStatsCards from './widgets/QuickStatsCards';
import '@/components/cards/universalcard.css';
import '../Finance/FinanceDashboardPage.css';
import './dashboardWidgets.css';
import './DashboardPage.css';

type SourceState<T> = {
    data: T | null;
    error: string | null;
};

function settledSource<T>(result: PromiseSettledResult<T>, fallbackMessage: string): SourceState<T> {
    if (result.status === 'fulfilled') {
        return { data: result.value, error: null };
    }
    const reason = result.reason;
    return {
        data: null,
        error: reason instanceof Error && reason.message ? reason.message : fallbackMessage,
    };
}

function countDueThisWeek(tasks: DashboardMyTasksResponse | null): number {
    if (!tasks) return 0;
    return tasks.items.filter(
        (item) => item.urgency === 'DUE_SOON' || item.urgency === 'DUE_THIS_WEEK',
    ).length;
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<SourceState<DashboardMyTasksResponse>>({
        data: null,
        error: null,
    });
    const [activities, setActivities] = useState<SourceState<DashboardMyActivitiesResponse>>({
        data: null,
        error: null,
    });
    const [notifications, setNotifications] = useState<SourceState<NotificationItem[]>>({
        data: null,
        error: null,
    });
    const [unread, setUnread] = useState<SourceState<NotificationUnreadCountResponse>>({
        data: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);

            const [tasksResult, activitiesResult, notificationsResult, unreadResult] =
                await Promise.allSettled([
                    dashboardAPI.getMyTasks(20),
                    dashboardAPI.getMyActivities({ limit: 20 }),
                    notificationsAPI.getAll({ limit: 20 }),
                    notificationsAPI.getUnreadCount(),
                ]);

            if (cancelled) return;

            setTasks(settledSource(tasksResult, 'Failed to load tasks'));
            setActivities(settledSource(activitiesResult, 'Failed to load activities'));

            const notificationsSource = settledSource(
                notificationsResult,
                'Failed to load notifications',
            );
            setNotifications({
                data: notificationsSource.data?.notifications ?? null,
                error: notificationsSource.error,
            });

            setUnread(settledSource(unreadResult, 'Failed to load unread count'));
            if (unreadResult.status === 'fulfilled') {
                syncAppBadge(Math.max(0, Number(unreadResult.value.unreadCount || 0)));
            }
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleNotificationMarkedRead = async () => {
        try {
            const unreadCount = await notificationsAPI.getUnreadCount();
            setUnread({ data: unreadCount, error: null });
            syncAppBadge(Math.max(0, Number(unreadCount.unreadCount || 0)));
        } catch (err) {
            setUnread((previous) => ({
                data: previous.data,
                error:
                    err instanceof Error && err.message
                        ? err.message
                        : 'Failed to load unread count',
            }));
        }
    };

    return (
        <div className="members-page dashboard-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Dashboard</h1>
            </div>
            <hr className="title-divider" />

            <div className="dashboard-cards-stack">
                <AnnouncementsFeed />

                {loading ? (
                    <p className="loading-message">Loading dashboard…</p>
                ) : (
                    <div className="dashboard-main-grid">
                        <QuickStatsCards
                            dueThisWeekCount={countDueThisWeek(tasks.data)}
                            overdueCount={tasks.data?.overdueCount ?? 0}
                            activitiesCount={activities.data?.totalCount ?? 0}
                            unreadNotificationsCount={unread.data?.unreadCount ?? 0}
                        />
                        <MyTasksWidget data={tasks.data} error={tasks.error} />
                        <UpcomingEventsWidget data={activities.data} error={activities.error} />
                        <NotificationsFeedWidget
                            notifications={notifications.data}
                            error={notifications.error}
                            onMarkedRead={() => void handleNotificationMarkedRead()}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
