'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatDateTime } from '@iclub/shared/utils';
import type { NotificationItem } from '@iclub/shared';
import { formatNotificationEventLabel } from './notificationLabels';
import './NotificationListItem.css';

export type NotificationListItemTimeMode = 'absolute' | 'relative';

export interface NotificationListItemProps {
    notification: NotificationItem;
    marking?: boolean;
    timeMode?: NotificationListItemTimeMode;
    onMarkRead?: (notificationId: NotificationItem['id']) => void;
}

export function NotificationListItem({
    notification,
    marking = false,
    timeMode = 'absolute',
    onMarkRead,
}: NotificationListItemProps) {
    const timeLabel =
        timeMode === 'relative'
            ? formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })
            : formatDateTime(notification.createdAt);

    const body = notification.body?.trim();

    return (
        <article
            className={`notification-list-item${notification.isRead ? ' is-read' : ''}`}
        >
            <div className="notification-list-item__content">
                <div className="notification-list-item__meta">
                    <span className="notification-list-item__event">
                        {formatNotificationEventLabel(notification.eventType)}
                    </span>
                    <time
                        className="notification-list-item__time"
                        dateTime={notification.createdAt}
                    >
                        {timeLabel}
                    </time>
                </div>
                <h4 className="notification-list-item__title">{notification.title}</h4>
                {body ? <p className="notification-list-item__body">{body}</p> : null}
            </div>

            {!notification.isRead && onMarkRead ? (
                <button
                    type="button"
                    className="btn btn-secondary notification-list-item__read-btn"
                    disabled={marking}
                    onClick={() => onMarkRead(notification.id)}
                >
                    {marking ? 'Saving...' : 'Mark as read'}
                </button>
            ) : null}
        </article>
    );
}
