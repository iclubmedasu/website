'use client';

import './QuickStatsCards.css';

export interface QuickStatsCardsProps {
    dueThisWeekCount: number;
    overdueCount: number;
    activitiesCount: number;
    unreadNotificationsCount: number;
}

export default function QuickStatsCards({
    dueThisWeekCount,
    overdueCount,
    activitiesCount,
    unreadNotificationsCount,
}: QuickStatsCardsProps) {
    const overdueActive = overdueCount > 0;

    return (
        <div className="card">
            <div className="card-header">
                <div className="card-header-left">
                    <h3 className="card-title">Overview</h3>
                    <p className="card-subtitle">Your tasks, events, and notifications at a glance</p>
                </div>
            </div>
            <div className="card-body">
                <div className="dashboard-stats-grid">
                    <div className="dashboard-stat-tile">
                        <p className="dashboard-stat-label">Due this week</p>
                        <p className="dashboard-stat-value">{dueThisWeekCount}</p>
                    </div>

                    <div
                        className={`dashboard-stat-tile${overdueActive ? ' dashboard-stat-tile--overdue' : ''}`}
                    >
                        <p className="dashboard-stat-label">Overdue</p>
                        <p className="dashboard-stat-value">{overdueCount}</p>
                    </div>

                    <div className="dashboard-stat-tile">
                        <p className="dashboard-stat-label">Activities</p>
                        <p className="dashboard-stat-value">{activitiesCount}</p>
                    </div>

                    <div className="dashboard-stat-tile">
                        <p className="dashboard-stat-label">Unread notifications</p>
                        <p className="dashboard-stat-value">{unreadNotificationsCount}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
