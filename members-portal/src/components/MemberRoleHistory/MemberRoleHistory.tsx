'use client';

import { Briefcase, MapPin, MessageCircle } from 'lucide-react';
import type { MemberRoleHistoryTimelineEntry } from '@iclub/shared';
import {
    formatRoleHistoryDate,
    getChangeTypeColor,
    getDurationText,
    getTimelineLineClass,
} from './memberRoleHistoryUtils';
import '@/components/modal/modal.css';

interface MemberRoleHistoryProps {
    entries: MemberRoleHistoryTimelineEntry[];
    emptyTitle?: string;
    emptySubtitle?: string;
}

export function MemberRoleHistory({
    entries,
    emptyTitle = 'No Role History Yet',
    emptySubtitle = 'Role changes and team assignments will appear here over time.',
}: MemberRoleHistoryProps) {
    if (entries.length === 0) {
        return (
            <div className="user-tab-empty-state">
                <Briefcase size={40} strokeWidth={1.5} />
                <h3 className="user-tab-empty-title">{emptyTitle}</h3>
                <p className="user-tab-empty-sub">{emptySubtitle}</p>
            </div>
        );
    }

    const timelineLineClass = getTimelineLineClass(entries);

    return (
        <div className="vertical-timeline">
            {entries.map((entry, index) => (
                <div key={entry.id} className="timeline-item">
                    <div className="timeline-marker">
                        <div className={`timeline-dot ${getChangeTypeColor(entry.changeType)}`} />
                        {index < entries.length - 1 && (
                            <div className={`timeline-line ${timelineLineClass}`} />
                        )}
                    </div>

                    <div className="timeline-content">
                        <div className="timeline-header">
                            <span className={`change-type-badge ${getChangeTypeColor(entry.changeType)}`}>
                                {entry.changeType}
                            </span>
                            <span className="timeline-date">{formatRoleHistoryDate(entry.period.start)}</span>
                        </div>

                        <div className="role-info">
                            <div className="role-item">
                                <Briefcase size={14} />
                                <span className="role-item-label">Role:</span>
                                <span className="role-name">{entry.roleName || 'N/A'}</span>
                            </div>
                            <div className="role-item">
                                <MapPin size={14} />
                                <span className="role-item-label">Team:</span>
                                <span className="team-name">{entry.teamName || 'N/A'}</span>
                            </div>
                            {entry.subteamName && (
                                <div className="role-item">
                                    <Briefcase size={14} />
                                    <span className="role-item-label">Subteam:</span>
                                    <span className="team-name">{entry.subteamName}</span>
                                </div>
                            )}
                        </div>

                        <div className="period-info">
                            <span className="period-text">
                                {entry.period.end
                                    ? `${formatRoleHistoryDate(entry.period.start)} – ${formatRoleHistoryDate(entry.period.end)} (${getDurationText(entry.period.duration)})`
                                    : `${formatRoleHistoryDate(entry.period.start)} – Present (${getDurationText(entry.period.duration)})`}
                            </span>
                        </div>

                        {entry.changeReason && (
                            <div className="reason-info">
                                <MessageCircle size={14} />
                                <span className="reason-text">{entry.changeReason}</span>
                            </div>
                        )}

                        {entry.notes && (
                            <div className="notes-info">
                                <p className="notes-label">Notes:</p>
                                <p className="notes-text">{entry.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
