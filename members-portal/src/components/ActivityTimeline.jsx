import { Calendar, User, FileText, FolderTree, Link2 } from 'lucide-react';
import { getProfilePhotoUrl } from '../services/api';

function parseMaybeJson(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function formatValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return value.map((item) => formatValue(item)).join(', ');
    }

    if (value instanceof Date) return value.toLocaleString();

    return Object.entries(value)
        .map(([key, entryValue]) => `${key}: ${formatValue(entryValue)}`)
        .join(' · ');
}

function getBadgeLabel(event) {
    const pieces = [];
    if (event.entityType) pieces.push(event.entityType.replace(/_/g, ' '));
    if (event.actionType) pieces.push(event.actionType.replace(/_/g, ' '));
    return pieces.join(' • ');
}

function ActivityReference({ event }) {
    if (!event.task && !event.phase) return null;

    return (
        <div className="activity-ref-row">
            {event.task && (
                <span className="activity-ref-chip" title={event.task.parentTaskId ? 'Subtask' : 'Task'}>
                    <FileText size={12} />
                    {event.task.title}
                </span>
            )}
            {event.phase && (
                <span className="activity-ref-chip" title="Phase">
                    <FolderTree size={12} />
                    {event.phase.title}
                </span>
            )}
        </div>
    );
}

export default function ActivityTimeline({ events = [], title = 'Activity', emptyMessage = 'No activity yet.', chronology = 'descending' }) {
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
                        const label = getBadgeLabel(event) || 'Activity';
                        const isLast = index === events.length - 1;

                        return (
                            <div key={event.id ?? `${event.createdAt}-${index}`} className="timeline-item">
                                <div className="timeline-marker">
                                    <div className="timeline-dot change-type-default" />
                                    {!isLast && <div className={lineClassName} />}
                                </div>

                                <div className="timeline-content">
                                    <div className="timeline-header">
                                        <span className="change-type-badge change-type-default">{label}</span>
                                        <span className="timeline-date">
                                            <Calendar size={12} style={{ marginRight: '0.35rem' }} />
                                            {new Date(event.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="activity-actor-row">
                                        <div className="activity-actor">
                                            <span className="activity-actor-avatar">
                                                {event.member?.profilePhotoUrl ? (
                                                    <img src={getProfilePhotoUrl(event.member.id)} alt={event.member.fullName} />
                                                ) : (
                                                    <User size={12} />
                                                )}
                                            </span>
                                            <span className="activity-actor-name">{event.member?.fullName ?? 'System'}</span>
                                        </div>
                                        {event.entityType && (
                                            <span className="activity-entity-tag">{event.entityType.replace(/_/g, ' ')}</span>
                                        )}
                                    </div>

                                    <ActivityReference event={event} />

                                    {event.description && <p className="activity-description">{event.description}</p>}

                                    {(oldValue !== null || newValue !== null) && (
                                        <div className="activity-diff-grid">
                                            <div className="activity-diff-card activity-diff-card--old">
                                                <div className="activity-diff-label">Before</div>
                                                <div className="activity-diff-value">{formatValue(oldValue)}</div>
                                            </div>
                                            <div className="activity-diff-card activity-diff-card--new">
                                                <div className="activity-diff-label">After</div>
                                                <div className="activity-diff-value">{formatValue(newValue)}</div>
                                            </div>
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