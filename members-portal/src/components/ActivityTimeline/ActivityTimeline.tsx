'use client';

import { Calendar, User } from 'lucide-react';
import { getProfilePhotoUrl } from '@/services/api';
import {
    collectReadableChanges,
    getBadgeLabel,
    getEntityDetails,
    getSupportingNote,
    getToneClass,
    parseMaybeJson,
    type ActivityTimelineContextEntity,
    type ActivityTimelineEvent,
} from './activityTimelineFormatters';

export type { ActivityTimelineContextEntity, ActivityTimelineEvent };

export interface ActivityTimelineMember {
    id?: number | string | null;
    fullName?: string | null;
    profilePhotoUrl?: string | null;
}

export interface ActivityTimelineProps {
    events?: ActivityTimelineEvent[];
    title?: string;
    emptyMessage?: string;
    chronology?: 'ascending' | 'descending';
    contextEntity?: ActivityTimelineContextEntity | null;
}

export default function ActivityTimeline({
    events = [],
    title = 'Activity',
    emptyMessage = 'No activity yet.',
    chronology = 'descending',
    contextEntity = null,
}: ActivityTimelineProps) {
    const lineClassName = chronology === 'ascending'
        ? 'timeline-line timeline-line--ascending'
        : 'timeline-line timeline-line--descending';

    return (
        <div className="timeline-section">
            <h4 className="timeline-title">{title}</h4>

            {events.length > 0 ? (
                <div className="vertical-timeline">
                    {events.map((event, index) => {
                        const oldValue = parseMaybeJson(event.oldValue);
                        const newValue = parseMaybeJson(event.newValue);
                        const label = getBadgeLabel(event);
                        const toneClass = getToneClass(event, contextEntity);
                        const changeRows = collectReadableChanges(oldValue, newValue, event);
                        const entityDetails = getEntityDetails(event, contextEntity);
                        const supportingNote = getSupportingNote(event, changeRows);
                        const isLast = index === events.length - 1;

                        return (
                            <div key={event.id ?? `${event.createdAt}-${index}`} className="timeline-item">
                                <div className="timeline-marker">
                                    <div className={`timeline-dot ${toneClass}`} />
                                    {!isLast && <div className={lineClassName} />}
                                </div>

                                <div className="timeline-content">
                                    <div className="timeline-header">
                                        <span className={`change-type-badge ${toneClass}`}>{label}</span>
                                        <span className="timeline-date">
                                            <Calendar size={12} style={{ marginRight: '0.35rem' }} />
                                            {new Date(event.createdAt ?? Date.now()).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="activity-actor-row">
                                        <div className="activity-actor">
                                            <span className="activity-actor-avatar">
                                                {event.member?.profilePhotoUrl ? (
                                                    <img src={getProfilePhotoUrl(event.member.id as any) ?? undefined} alt={event.member.fullName ?? undefined} />
                                                ) : (
                                                    <User size={12} />
                                                )}
                                            </span>
                                            <span className="activity-actor-name">{event.member?.fullName ?? 'System'}</span>
                                        </div>
                                    </div>

                                    {entityDetails && (
                                        <div className="activity-entity-row">
                                            <span className="activity-entity-label">{entityDetails.label}:</span>
                                            <span className="activity-entity-name">{entityDetails.name}</span>
                                        </div>
                                    )}

                                    {supportingNote && <p className="activity-description">{supportingNote}</p>}

                                    {changeRows.length > 0 && (
                                        <div className="activity-change-list">
                                            {changeRows.map((change) => (
                                                <div key={change.label} className="activity-change-row">
                                                    <div className="activity-change-label">{change.label}</div>
                                                    <div className="activity-change-value">
                                                        {change.afterOnly ? (
                                                            <span className="activity-change-after">{change.after}</span>
                                                        ) : (
                                                            <>
                                                                <span className="activity-change-before">{change.before}</span>
                                                                <span className="activity-change-arrow">→</span>
                                                                <span className="activity-change-after">{change.after}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <p>{emptyMessage}</p>
                </div>
            )}
        </div>
    );
}
