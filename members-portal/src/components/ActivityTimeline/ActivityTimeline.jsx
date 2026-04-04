import { Calendar, User } from 'lucide-react';
import { getProfilePhotoUrl } from '../../services/api';

function parseMaybeJson(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function toTitleCase(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateValue(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function truncateText(value, maxLength = 96) {
    const text = String(value ?? '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function serializeComparableValue(value) {
    if (value === undefined) return '__undefined__';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value) || isPlainObject(value)) {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

const TECHNICAL_KEYS = new Set([
    'id',
    'projectId',
    'taskId',
    'phaseId',
    'parentTaskId',
    'memberId',
    'createdByMemberId',
    'dependsOnTaskId',
    'teamId',
]);

const FIELD_LABELS = {
    title: 'Title',
    description: 'Description',
    status: 'Status',
    priority: 'Priority',
    difficulty: 'Difficulty',
    type: 'Type',
    order: 'Order',
    startDate: 'Start date',
    dueDate: 'Due date',
    completedDate: 'Completed date',
    estimatedHours: 'Estimated hours',
    actualHours: 'Actual hours',
    assigneeIds: 'Assignees',
    projectTeams: 'Teams',
    isActive: 'Active',
    isArchived: 'Archived',
    isFinalized: 'Finalized',
    notes: 'Notes',
    roleName: 'Role',
    teamName: 'Team',
    subteamName: 'Subteam',
    period: 'Period',
    changeReason: 'Reason',
};

const COMMENT_ACTION_TYPES = new Set(['COMMENTED', 'COMMENT_EDITED', 'COMMENT_DELETED']);

const ENTITY_LABEL_OVERRIDES = {
    project: 'Project',
    task: 'Task',
    subtask: 'Subtask',
    phase: 'Phase',
    file: 'File',
    member: 'Member',
    team: 'Team',
    'schedule slot': 'Schedule',
};

const BADGE_LABEL_OVERRIDES = {
    COMMENTED: 'Comment',
    COMMENT_EDITED: 'Comment Edited',
    COMMENT_DELETED: 'Comment Deleted',
};

function getFirstText(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }

    return '';
}

function normalizeEntityLabel(value) {
    const text = getFirstText(value);
    if (!text) return '';

    const normalized = text.replace(/_/g, ' ').trim();
    const override = ENTITY_LABEL_OVERRIDES[normalized.toLowerCase()];
    if (override) return override;

    return toTitleCase(normalized);
}

function extractFileNameFromDescription(description) {
    const text = getFirstText(description);
    if (!text) return '';

    const match = text.match(/\bfile\s+(.+)$/i);
    if (!match) return '';

    return match[1].trim().replace(/[)\]\},.!?;:]+$/g, '').trim();
}

function inferEntityLabelFromDescription(description) {
    const text = getFirstText(description).toLowerCase();
    if (!text) return '';
    if (text.startsWith('phase ') || text.includes(' phase "')) return 'Phase';
    if (text.startsWith('task ') || text.includes(' task "')) return 'Task';
    if (text.startsWith('subtask ') || text.includes(' subtask "')) return 'Subtask';
    if (text.startsWith('file ') || text.includes(' file "')) return 'File';
    if (text.includes('schedule slot') || text.includes('schedule-slot') || text.startsWith('schedule ')) return 'Schedule';
    if (text.startsWith('project ') || text.includes(' project "')) return 'Project';
    return '';
}

function normalizeContextEntity(contextEntity) {
    if (!isPlainObject(contextEntity)) return null;

    const label = normalizeEntityLabel(contextEntity.label || contextEntity.type || contextEntity.entityType || contextEntity.kind);
    const name = getFirstText(contextEntity.name, contextEntity.title, contextEntity.entityName, contextEntity.fullName, contextEntity.displayName, contextEntity.fileName);

    if (!label && !name) return null;

    return {
        label: label || 'Item',
        name: name || 'Unnamed item',
    };
}

function toSearchText(...values) {
    return values
        .flat()
        .map((value) => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (value instanceof Date) return value.toISOString();

            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        })
        .join(' ')
        .toLowerCase();
}

function textIncludesAny(text, terms = []) {
    return terms.some((term) => text.includes(term));
}

function getObjectStatus(value) {
    if (typeof value === 'string') return value.trim().toUpperCase();
    if (isPlainObject(value) && typeof value.status === 'string') return value.status.trim().toUpperCase();
    return '';
}

function getEntityTypeForTone(event, contextEntity) {
    const explicitType = String(event.entityType || '').trim().toUpperCase();
    if (explicitType) return explicitType;

    if (event.phase || event.phaseId) return 'PHASE';
    if (event.task?.parentTaskId || event.parentTaskId) return 'SUBTASK';
    if (event.task || event.taskId) return 'TASK';

    const contextLabel = normalizeEntityLabel(contextEntity?.label || contextEntity?.type).toUpperCase();
    if (contextLabel) return contextLabel;

    const inferredLabel = inferEntityLabelFromDescription(event.description).toUpperCase();
    if (inferredLabel) return inferredLabel;

    return '';
}

function getEntityNameForLabel(event, entityLabel, fallbackEntity, fileNameFromDescription) {
    const fallbackName = fallbackEntity && fallbackEntity.label === entityLabel ? fallbackEntity.name : '';

    switch (entityLabel) {
        case 'Project':
            return getFirstText(
                event.entity?.title,
                event.entity?.name,
                event.entity?.displayName,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Unnamed project',
            );
        case 'Phase':
            return getFirstText(
                event.phase?.title,
                event.phase?.name,
                event.entity?.title,
                event.entity?.name,
                event.entity?.displayName,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Untitled phase',
            );
        case 'Subtask':
            return getFirstText(
                event.task?.title,
                event.task?.name,
                event.entity?.title,
                event.entity?.name,
                event.entity?.displayName,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Untitled subtask',
            );
        case 'Task':
            return getFirstText(
                event.task?.title,
                event.task?.name,
                event.entity?.title,
                event.entity?.name,
                event.entity?.displayName,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Untitled task',
            );
        case 'File':
            return getFirstText(
                event.file?.title,
                event.file?.name,
                event.file?.fileName,
                fileNameFromDescription,
                event.entity?.title,
                event.entity?.name,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Untitled file',
            );
        case 'Schedule':
            return getFirstText(
                event.entity?.title,
                event.entity?.name,
                event.entity?.displayName,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Scheduled item',
            );
        default:
            return getFirstText(
                event.entity?.title,
                event.entity?.name,
                event.entity?.displayName,
                event.entityName,
                event.title,
                event.name,
                fallbackName,
                'Unnamed item',
            );
    }
}

function formatValueForField(key, value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') {
        if (key.toLowerCase().includes('date')) return formatDateValue(value);
        if (key === 'status' || key === 'priority' || key === 'difficulty' || key === 'type') return toTitleCase(value);
        return value;
    }
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (key === 'assigneeIds' || key.endsWith('Ids') || key === 'projectTeams') {
            if (key === 'projectTeams') {
                return `${value.length} ${value.length === 1 ? 'team' : 'teams'}`;
            }
            return `${value.length} ${value.length === 1 ? 'member' : 'members'}`;
        }
        if (value.some((item) => isPlainObject(item))) {
            return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
        }
        return value.map((item) => formatValueForField(key, item)).join(', ');
    }

    if (value instanceof Date) return formatDateValue(value);

    if (isPlainObject(value)) {
        if (value.title) return value.title;
        if (value.name) return value.name;
        if (value.fileName) return value.fileName;
        if (value.fullName) return value.fullName;
        if (value.displayName) return value.displayName;
        if (value.roleName) return value.roleName;
        if (value.teamName) return value.teamName;
        if (value.subteamName) return value.subteamName;

        const entries = Object.entries(value)
            .filter(([subKey, subValue]) => !TECHNICAL_KEYS.has(subKey) && subValue !== null && subValue !== undefined && subValue !== '')
            .slice(0, 3)
            .map(([subKey, subValue]) => `${FIELD_LABELS[subKey] || toTitleCase(subKey)}: ${formatValueForField(subKey, subValue)}`);

        if (entries.length > 0) return entries.join(' · ');
        return 'Updated details';
    }

    return String(value);
}

function collectReadableChanges(oldValue, newValue, event = {}) {
    const actionType = event.actionType || '';

    if (actionType === 'COMMENT_EDITED') {
        const before = truncateText(oldValue, 96);
        const after = truncateText(newValue, 96);
        if (before === after) return [];
        return [{ label: 'Comment', before, after }];
    }

    if (actionType === 'COMMENTED' || actionType === 'COMMENT_DELETED' || actionType === 'DEPENDENCY_ADDED' || actionType === 'DEPENDENCY_REMOVED') {
        return [];
    }

    const oldObject = isPlainObject(oldValue) ? oldValue : {};
    const newObject = isPlainObject(newValue) ? newValue : {};
    const keys = [...new Set([...Object.keys(oldObject), ...Object.keys(newObject)])];

    const changes = [];
    for (const key of keys) {
        if (TECHNICAL_KEYS.has(key)) continue;
        if (key === 'changeReason') continue;

        const before = oldObject[key];
        const after = newObject[key];
        if (serializeComparableValue(before) === serializeComparableValue(after)) continue;
        const beforeValue = formatValueForField(key, before);
        const afterValue = formatValueForField(key, after);

        if (beforeValue === afterValue) continue;

        const label = FIELD_LABELS[key] || toTitleCase(key);
        changes.push({ label, before: beforeValue, after: afterValue });
    }

    return changes;
}

function getToneClass(event, contextEntity = null) {
    const actionType = String(event.actionType || '').toUpperCase();
    const oldValue = parseMaybeJson(event.oldValue);
    const newValue = parseMaybeJson(event.newValue);
    const oldStatus = getObjectStatus(oldValue);
    const newStatus = getObjectStatus(newValue);
    const entityType = getEntityTypeForTone(event, contextEntity);
    const searchText = toSearchText(actionType, event.description, oldStatus, newStatus, event.entityType, event.entityName);

    if (COMMENT_ACTION_TYPES.has(actionType) || actionType.includes('COMMENT')) {
        return 'activity-tone-comment';
    }

    if (
        entityType === 'SCHEDULE_SLOT'
        || entityType === 'SCHEDULE'
        || textIncludesAny(searchText, ['schedule', 'timeline'])
    ) {
        return 'activity-tone-schedule';
    }

    if (entityType === 'PROJECT') {
        if (actionType === 'ABORTED' || oldStatus === 'CANCELLED' || newStatus === 'CANCELLED') {
            return 'activity-tone-deleted';
        }

        if (actionType === 'ARCHIVED' || newValue?.isArchived === true || oldValue?.isArchived === true) {
            return 'activity-tone-muted';
        }

        if (actionType === 'CREATED' || actionType === 'FINALIZED' || newValue?.isFinalized === true || oldValue?.isFinalized === true) {
            return 'activity-tone-success';
        }

        if (actionType === 'REACTIVATED' || actionType === 'ACTIVATED') {
            return 'activity-tone-updated';
        }

        if (
            actionType === 'DEACTIVATED'
            || oldStatus === 'ON_HOLD'
            || newStatus === 'ON_HOLD'
            || oldValue?.isActive === false
            || newValue?.isActive === false
            || textIncludesAny(searchText, ['deactivated', 'deactivate', 'on hold', 'hold'])
        ) {
            return 'activity-tone-warning';
        }

        return 'activity-tone-default';
    }

    if (actionType === 'DELETED' || actionType === 'ABORTED') {
        return 'activity-tone-deleted';
    }

    if (actionType === 'CREATED') {
        return 'activity-tone-created';
    }

    if (
        actionType === 'UPDATED'
        || actionType === 'STATUS_CHANGED'
        || actionType === 'ASSIGNMENT_STATUS_CHANGED'
        || actionType === 'ASSIGNED'
        || actionType === 'SELF_ASSIGNED'
        || actionType === 'UNASSIGNED'
        || actionType.includes('UPDATED')
        || actionType.includes('CHANGED')
        || actionType.includes('EDITED')
    ) {
        return 'activity-tone-updated';
    }

    if (oldStatus || newStatus) {
        return 'activity-tone-updated';
    }

    return 'activity-tone-default';
}

function getBadgeLabel(event) {
    if (event.actionType && BADGE_LABEL_OVERRIDES[event.actionType]) return BADGE_LABEL_OVERRIDES[event.actionType];
    if (event.actionType) return toTitleCase(event.actionType.replace(/_/g, ' '));
    return 'Activity';
}

function getEntityDetails(event, contextEntity) {
    const fallbackEntity = normalizeContextEntity(contextEntity);
    const fileNameFromDescription = extractFileNameFromDescription(event.description);
    const inferredLabel = inferEntityLabelFromDescription(event.description);

    if (event.entityType) {
        const entityLabel = normalizeEntityLabel(event.entityType);

        return {
            label: entityLabel || 'Item',
            name: getEntityNameForLabel(event, entityLabel || 'Item', fallbackEntity, fileNameFromDescription),
        };
    }

    if (event.phase) {
        return {
            label: 'Phase',
            name: getFirstText(event.phase.title, event.phase.name, fallbackEntity && fallbackEntity.label === 'Phase' ? fallbackEntity.name : '', 'Untitled phase'),
        };
    }

    if (inferredLabel === 'Phase') {
        return {
            label: 'Phase',
            name: getFirstText(event.entityName, event.title, event.name, fallbackEntity?.name, 'Untitled phase'),
        };
    }

    if (event.task) {
        const taskLabel = event.task.parentTaskId ? 'Subtask' : 'Task';
        return {
            label: taskLabel,
            name: getFirstText(event.task.title, event.task.name, fallbackEntity && fallbackEntity.label === taskLabel ? fallbackEntity.name : '', 'Untitled task'),
        };
    }

    if (inferredLabel === 'Task' || inferredLabel === 'Subtask') {
        return {
            label: inferredLabel,
            name: getFirstText(event.entityName, event.title, event.name, fallbackEntity?.name, inferredLabel === 'Subtask' ? 'Untitled subtask' : 'Untitled task'),
        };
    }

    if (event.file || fileNameFromDescription || inferredLabel === 'File') {
        return {
            label: 'File',
            name: getFirstText(event.file?.title, event.file?.name, event.file?.fileName, fileNameFromDescription, 'Untitled file'),
        };
    }

    if (event.entityName || event.title || event.name || fallbackEntity) {
        return {
            label: fallbackEntity?.label || 'Item',
            name: getFirstText(event.entityName, event.title, event.name, fallbackEntity?.name, 'Unnamed item'),
        };
    }

    return null;
}

function getSupportingNote(event, changeRows) {
    if (changeRows.length > 0) return '';
    if (COMMENT_ACTION_TYPES.has(event.actionType)) return '';
    if (!event.description) return '';

    const text = String(event.description).trim();
    if (!text) return '';

    return text;
}

export default function ActivityTimeline({ events = [], title = 'Activity', emptyMessage = 'No activity yet.', chronology = 'descending', contextEntity = null }) {
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
                                                        <span className="activity-change-before">{change.before}</span>
                                                        <span className="activity-change-arrow">→</span>
                                                        <span className="activity-change-after">{change.after}</span>
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