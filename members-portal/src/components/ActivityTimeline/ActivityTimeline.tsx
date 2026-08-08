'use client';

import { useMemo, useState } from 'react';
import { Calendar, User } from 'lucide-react';
import { formatDateTime } from '@iclub/shared/utils';
import { DateInput } from '@/components/input/DateInput';
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

const SYSTEM_ACTOR_VALUE = '__system__';

function toLocalDayStart(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function toLocalDayEnd(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function getActorKey(event: ActivityTimelineEvent): string {
    if (event.member?.id != null && event.member.id !== '') {
        return String(event.member.id);
    }
    return SYSTEM_ACTOR_VALUE;
}

export default function ActivityTimeline({
    events = [],
    title = 'Activity',
    emptyMessage = 'No activity yet.',
    chronology = 'descending',
    contextEntity = null,
}: ActivityTimelineProps) {
    const [actionTypeFilter, setActionTypeFilter] = useState('');
    const [actorFilter, setActorFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const lineClassName = chronology === 'ascending'
        ? 'timeline-line timeline-line--ascending'
        : 'timeline-line timeline-line--descending';

    const actionTypeOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const event of events) {
            const actionType = String(event.actionType || '').trim();
            if (!actionType) continue;
            const key = actionType.toUpperCase();
            if (!seen.has(key)) {
                seen.set(key, getBadgeLabel({ actionType }));
            }
        }
        return Array.from(seen.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [events]);

    const actorOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const event of events) {
            const key = getActorKey(event);
            if (seen.has(key)) continue;
            seen.set(key, key === SYSTEM_ACTOR_VALUE ? 'System' : (event.member?.fullName || 'Unknown'));
        }
        return Array.from(seen.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => {
                if (a.value === SYSTEM_ACTOR_VALUE) return 1;
                if (b.value === SYSTEM_ACTOR_VALUE) return -1;
                return a.label.localeCompare(b.label);
            });
    }, [events]);

    const hasActiveFilters = Boolean(actionTypeFilter || actorFilter || dateFrom || dateTo);

    const filteredEvents = useMemo(() => {
        const fromMs = dateFrom ? toLocalDayStart(dateFrom) : null;
        const toMs = dateTo ? toLocalDayEnd(dateTo) : null;

        return events.filter((event) => {
            if (actionTypeFilter) {
                const actionType = String(event.actionType || '').toUpperCase();
                if (actionType !== actionTypeFilter) return false;
            }

            if (actorFilter && getActorKey(event) !== actorFilter) {
                return false;
            }

            if (fromMs != null || toMs != null) {
                if (event.createdAt == null) return false;
                const createdMs = new Date(event.createdAt).getTime();
                if (Number.isNaN(createdMs)) return false;
                if (fromMs != null && createdMs < fromMs) return false;
                if (toMs != null && createdMs > toMs) return false;
            }

            return true;
        });
    }, [events, actionTypeFilter, actorFilter, dateFrom, dateTo]);

    const clearFilters = () => {
        setActionTypeFilter('');
        setActorFilter('');
        setDateFrom('');
        setDateTo('');
    };

    return (
        <div className="timeline-section">
            <h4 className="timeline-title">{title}</h4>

            {events.length > 0 && (
                <div className="timeline-filters">
                    <div className="timeline-filters-row">
                        <div className="modal-form-group timeline-filter-field">
                            <label className="modal-label" htmlFor="timeline-filter-action">Action</label>
                            <select
                                id="timeline-filter-action"
                                className="modal-select"
                                value={actionTypeFilter}
                                onChange={(e) => setActionTypeFilter(e.target.value)}
                            >
                                <option value="">All actions</option>
                                {actionTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="modal-form-group timeline-filter-field">
                            <label className="modal-label" htmlFor="timeline-filter-actor">Who</label>
                            <select
                                id="timeline-filter-actor"
                                className="modal-select"
                                value={actorFilter}
                                onChange={(e) => setActorFilter(e.target.value)}
                            >
                                <option value="">Anyone</option>
                                {actorOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="modal-form-group timeline-filter-field">
                            <label className="modal-label" htmlFor="timeline-filter-from">From</label>
                            <DateInput
                                id="timeline-filter-from"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                max={dateTo || undefined}
                            />
                        </div>

                        <div className="modal-form-group timeline-filter-field">
                            <label className="modal-label" htmlFor="timeline-filter-to">To</label>
                            <DateInput
                                id="timeline-filter-to"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                min={dateFrom || undefined}
                            />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            )}

            {events.length > 0 ? (
                filteredEvents.length > 0 ? (
                    <div className="vertical-timeline">
                        {filteredEvents.map((event, index) => {
                            const oldValue = parseMaybeJson(event.oldValue);
                            const newValue = parseMaybeJson(event.newValue);
                            const label = getBadgeLabel(event);
                            const toneClass = getToneClass(event, contextEntity);
                            const changeRows = collectReadableChanges(oldValue, newValue, event);
                            const entityDetails = getEntityDetails(event, contextEntity);
                            const supportingNote = getSupportingNote(event, changeRows);
                            const isLast = index === filteredEvents.length - 1;

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
                                                {formatDateTime(event.createdAt != null ? new Date(event.createdAt) : new Date())}
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
                        <p>No activity matches these filters.</p>
                    </div>
                )
            ) : (
                <div className="empty-state">
                    <p>{emptyMessage}</p>
                </div>
            )}
        </div>
    );
}
