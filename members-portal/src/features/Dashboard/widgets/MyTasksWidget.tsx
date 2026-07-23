'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { differenceInHours, format, isThisWeek, isToday, isTomorrow, parseISO } from 'date-fns';
import type {
    DashboardMyTaskItem,
    DashboardMyTasksResponse,
    DashboardTaskUrgency,
} from '@iclub/shared';
import { formatDate } from '@iclub/shared/utils';
import { dashboardAPI } from '@/services/api';
import './MyTasksWidget.css';

function urgencyBadgeClass(urgency: DashboardTaskUrgency): string {
    switch (urgency) {
        case 'OVERDUE':
            return 'my-tasks-badge--overdue';
        case 'DUE_SOON':
            return 'my-tasks-badge--due-soon';
        case 'DUE_THIS_WEEK':
            return 'my-tasks-badge--due-this-week';
        case 'LATER':
        default:
            return 'my-tasks-badge--later';
    }
}

/** Event tasks are schedules, not deadlines — never "Overdue" / "Due in Nh". */
function eventTaskScheduleLabel(item: DashboardMyTaskItem): string {
    if (!item.dueDate) return 'No date';
    const date = parseISO(item.dueDate);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date, { weekStartsOn: 0 })) return format(date, 'EEE');
    return formatDate(item.dueDate);
}

function urgencyBadgeLabel(item: DashboardMyTaskItem): string {
    if (item.kind === 'EVENT_TASK') {
        return eventTaskScheduleLabel(item);
    }

    const { urgency, dueDate } = item;

    if (urgency === 'OVERDUE') return 'Overdue';

    if (urgency === 'DUE_SOON') {
        if (!dueDate) return 'Due soon';
        const hours = differenceInHours(parseISO(dueDate), new Date());
        if (hours < 24) {
            const n = Math.max(hours, 1);
            return `Due in ${n}h`;
        }
        return 'Due tomorrow';
    }

    if (urgency === 'DUE_THIS_WEEK') {
        if (!dueDate) return 'Due this week';
        return `Due ${format(parseISO(dueDate), 'EEE')}`;
    }

    if (!dueDate) return 'No deadline';
    return formatDate(dueDate);
}

function taskHref(item: DashboardMyTaskItem): string {
    if (item.kind === 'EVENT_TASK') {
        return `/events?event=${item.parentId}`;
    }
    return '/projects';
}

export interface MyTasksWidgetProps {
    data?: DashboardMyTasksResponse | null;
    error?: string | null;
}

export default function MyTasksWidget({ data, error: errorProp }: MyTasksWidgetProps = {}) {
    const hasProvidedData = data != null;
    const hasProvidedError = !hasProvidedData && Boolean(errorProp);

    const [items, setItems] = useState<DashboardMyTaskItem[]>(() => data?.items ?? []);
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
                const response = await dashboardAPI.getMyTasks();
                if (!cancelled) {
                    setItems(response.items);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load tasks');
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
                    <h3 className="card-title">My Tasks</h3>
                    <p className="card-subtitle">Your assigned work across events and projects</p>
                </div>
            </div>
            <div className="card-body">
                {loading ? (
                    <p className="loading-message">Loading…</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : items.length === 0 ? (
                    <p className="empty-message">You&apos;re all caught up!</p>
                ) : (
                    <div className="dashboard-list">
                        {items.map((item) => (
                            <Link
                                key={item.id}
                                href={taskHref(item)}
                                className="dashboard-list-row dashboard-list-row--clickable dashboard-list-row--link"
                            >
                                <div className="dashboard-list-row-main">
                                    <h4 className="dashboard-list-row-title">{item.title}</h4>
                                    <p className="dashboard-list-row-meta">{item.parentTitle}</p>
                                </div>
                                <span className={`badge ${urgencyBadgeClass(item.urgency)}`}>
                                    {urgencyBadgeLabel(item)}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
