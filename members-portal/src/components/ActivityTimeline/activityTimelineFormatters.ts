export interface ActivityTimelineContextEntity {
    label?: string | null;
    type?: string | null;
    entityType?: string | null;
    kind?: string | null;
    name?: string | null;
    title?: string | null;
    entityName?: string | null;
    fullName?: string | null;
    displayName?: string | null;
    fileName?: string | null;
}

export interface ActivityTimelineEvent {
    id?: number | string | null;
    createdAt?: string | null;
    actionType?: string | null;
    entityType?: string | null;
    entityName?: string | null;
    description?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    member?: { id?: number | string | null; fullName?: string | null; profilePhotoUrl?: string | null } | null;
    phase?: Record<string, unknown> | null;
    phaseId?: number | string | null;
    task?: Record<string, unknown> | null;
    taskId?: number | string | null;
    eventTask?: Record<string, unknown> | null;
    eventTaskId?: number | string | null;
    parentTaskId?: number | string | null;
    file?: Record<string, unknown> | null;
    entity?: Record<string, unknown> | null;
    title?: string | null;
    name?: string | null;
}

export type ChangeRow = {
    label: string;
    before: string;
    after: string;
    afterOnly?: boolean;
};

type LooseRecord = Record<string, unknown>;

export const ASSIGNMENT_ACTION_TYPES = new Set(['ASSIGNED', 'SELF_ASSIGNED', 'UNASSIGNED']);
export const COMMENT_ACTION_TYPES = new Set(['COMMENTED', 'COMMENT_EDITED', 'COMMENT_DELETED']);

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
    'eventId',
    'eventTaskId',
    'tierId',
    'registrationId',
    'fileId',
    'projectTypeId',
    'leaderId',
]);

export const FIELD_LABELS: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    status: 'Status',
    priority: 'Priority',
    difficulty: 'Difficulty',
    type: 'Type',
    order: 'Order',
    startDate: 'Start date',
    dueDate: 'Due date',
    startDateTime: 'Start time',
    endDateTime: 'End time',
    taskDate: 'Task date',
    eventDate: 'Event date',
    eventEndDate: 'End date',
    registrationDeadline: 'Registration deadline',
    memberName: 'Member',
    completedDate: 'Completed date',
    estimatedHours: 'Estimated hours',
    actualHours: 'Actual hours',
    assigneeIds: 'Assignees',
    projectTeams: 'Teams',
    isActive: 'Active',
    isArchived: 'Archived',
    isFinalized: 'Finalized',
    isCertifiable: 'Certifiable',
    allowWalkIns: 'Allow walk-ins',
    showOnPublic: 'Show on public',
    isLocked: 'Locked',
    isWalkIn: 'Walk-in',
    notes: 'Notes',
    roleName: 'Role',
    teamName: 'Team',
    subteamName: 'Subteam',
    period: 'Period',
    changeReason: 'Reason',
    location: 'Location',
    venue: 'Venue',
    capacity: 'Capacity',
    progressStatus: 'Progress',
    currency: 'Currency',
    price: 'Price',
    maxCapacity: 'Max capacity',
    label: 'Label',
    fullName: 'Name',
    email: 'Email',
    phoneNumber: 'Phone',
    source: 'Source',
    dependencyType: 'Dependency type',
    dependsOnTaskTitle: 'Depends on',
    taskTitle: 'Task',
    customFieldValues: 'Custom fields',
    tierId: 'Tier',
};

export const ENTITY_LABEL_OVERRIDES: Record<string, string> = {
    project: 'Project',
    event: 'Event',
    task: 'Task',
    subtask: 'Subtask',
    phase: 'Phase',
    file: 'File',
    member: 'Member',
    team: 'Team',
    tier: 'Tier',
    registration: 'Registration',
    'custom field': 'Custom Field',
    assignment: 'Assignment',
    'schedule slot': 'Schedule',
    schedule: 'Schedule',
};

export const BADGE_LABEL_OVERRIDES: Record<string, string> = {
    COMMENTED: 'Comment',
    COMMENT_EDITED: 'Comment Edited',
    COMMENT_DELETED: 'Comment Deleted',
    FINALIZED: 'Finalized',
    ARCHIVED: 'Archived',
    REACTIVATED: 'Reactivated',
    ABORTED: 'Aborted',
    PUBLISHED: 'Published',
    DEACTIVATED: 'On Hold',
    ACTIVATED: 'Activated',
    STATUS_CHANGED: 'Status Changed',
    CHECKED_IN: 'Checked In',
    CANCELLED: 'Cancelled',
    REORDERED: 'Reordered',
    DEPENDENCY_ADDED: 'Dependency Added',
    DEPENDENCY_REMOVED: 'Dependency Removed',
    ASSIGNMENT_STATUS_CHANGED: 'Assignment Status',
    SELF_ASSIGNED: 'Self Assigned',
};

export function parseMaybeJson(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function isPlainObject(value: unknown): value is LooseRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function toTitleCase(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/_/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateValue(value: unknown): string {
    if (!value) return '—';
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatDateTimeValue(value: unknown): string {
    if (!value) return '—';
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function isDateTimeFieldKey(key: string): boolean {
    return /datetime|time$/i.test(key) || key === 'startDateTime' || key === 'endDateTime';
}

function truncateText(value: unknown, maxLength = 96): string {
    const text = String(value ?? '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function serializeComparableValue(value: unknown): string {
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

function isEmptyFormattedValue(value: string): boolean {
    return value === '—' || value === '';
}

export function getFirstText(...values: unknown[]): string {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }

    return '';
}

export function normalizeEntityLabel(value: unknown): string {
    const text = getFirstText(value);
    if (!text) return '';

    const normalized = text.replace(/_/g, ' ').trim();
    const override = ENTITY_LABEL_OVERRIDES[normalized.toLowerCase()];
    if (override) return override;

    return toTitleCase(normalized);
}

export function extractFileNameFromDescription(description: unknown): string {
    const text = getFirstText(description);
    if (!text) return '';

    const match = text.match(/\bfile\s+(.+)$/i);
    if (!match) return '';

    return match[1].trim().replace(/[)\]\},.!?;:]+$/g, '').trim();
}

export function extractTaskTitleFromDescription(description: unknown): string {
    const text = getFirstText(description);
    if (!text) return '';

    const quotedMatch = text.match(/\btask\s+"([^"]+)"/i)
        || text.match(/to\s+"([^"]+)"/i)
        || text.match(/from\s+"([^"]+)"/i);
    return quotedMatch?.[1]?.trim() || '';
}

export function extractMemberNameFromDescription(description: unknown): string {
    const text = getFirstText(description);
    if (!text) return '';

    const assignedMatch = text.match(/^Assigned\s+(.+?)\s+to\s+"/i)
        || text.match(/^Unassigned\s+(.+?)\s+from\s+"/i);
    if (assignedMatch?.[1]) return assignedMatch[1].trim();

    return '';
}

function inferEntityLabelFromDescription(description: unknown): string {
    const text = getFirstText(description).toLowerCase();
    if (!text) return '';
    if (text.startsWith('phase ') || text.includes(' phase "')) return 'Phase';
    if (text.startsWith('task ') || text.includes(' task "')) return 'Task';
    if (text.startsWith('subtask ') || text.includes(' subtask "')) return 'Subtask';
    if (text.startsWith('file ') || text.includes(' file "')) return 'File';
    if (text.includes('schedule slot') || text.includes('schedule-slot') || text.startsWith('schedule ')) return 'Schedule';
    if (text.startsWith('project ') || text.includes(' project "')) return 'Project';
    if (text.startsWith('event ') || text.includes(' event "')) return 'Event';
    if (text.includes('tier "') || text.startsWith('tier ')) return 'Tier';
    if (text.includes('registration') || text.includes('walk-in')) return 'Registration';
    if (text.includes('custom field')) return 'Custom Field';
    return '';
}

function normalizeContextEntity(contextEntity: ActivityTimelineContextEntity | LooseRecord | null | undefined): { label: string; name: string } | null {
    if (!isPlainObject(contextEntity)) return null;

    const label = normalizeEntityLabel(contextEntity.label || contextEntity.type || contextEntity.entityType || contextEntity.kind);
    const name = getFirstText(contextEntity.name, contextEntity.title, contextEntity.entityName, contextEntity.fullName, contextEntity.displayName, contextEntity.fileName);

    if (!label && !name) return null;

    return {
        label: label || 'Item',
        name: name || 'Unnamed item',
    };
}

function toSearchText(...values: unknown[]): string {
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

function textIncludesAny(text: string, terms: string[] = []): boolean {
    return terms.some((term) => text.includes(term));
}

function getObjectStatus(value: unknown): string {
    if (typeof value === 'string') return value.trim().toUpperCase();
    if (isPlainObject(value) && typeof value.status === 'string') return value.status.trim().toUpperCase();
    return '';
}

function normalizeAssignmentPayload(oldValue: unknown, newValue: unknown, description?: string | null): { oldObject: LooseRecord; newObject: LooseRecord } {
    let oldObject: LooseRecord = isPlainObject(oldValue) ? oldValue : {};
    let newObject: LooseRecord = isPlainObject(newValue) ? newValue : {};

    if (typeof newValue === 'number') {
        newObject = { memberId: newValue, memberName: extractMemberNameFromDescription(description) || `Member #${newValue}` };
    }
    if (typeof oldValue === 'number') {
        oldObject = { memberId: oldValue, memberName: extractMemberNameFromDescription(description) || `Member #${oldValue}` };
    }

    return { oldObject, newObject };
}

function formatValueForField(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') {
        if (isDateTimeFieldKey(key)) return formatDateTimeValue(value);
        if (key.toLowerCase().includes('date')) return formatDateValue(value);
        if (key === 'status' || key === 'priority' || key === 'difficulty' || key === 'type' || key === 'progressStatus') return toTitleCase(value);
        return value;
    }
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (Array.isArray(value)) {
        if (value.length === 0) return 'None';
        if (key === 'assigneeIds' || key.endsWith('Ids') || key === 'projectTeams' || key === 'eventTeams') {
            if (key === 'projectTeams' || key === 'eventTeams') {
                return `${value.length} ${value.length === 1 ? 'team' : 'teams'}`;
            }
            return `${value.length} ${value.length === 1 ? 'member' : 'members'}`;
        }
        if (value.some((item) => isPlainObject(item))) {
            return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
        }
        return value.map((item) => formatValueForField(key, item)).join(', ');
    }

    if (value instanceof Date) {
        return isDateTimeFieldKey(key) ? formatDateTimeValue(value) : formatDateValue(value);
    }

    if (isPlainObject(value)) {
        if (value.title) return String(value.title);
        if (value.name) return String(value.name);
        if (value.fileName) return String(value.fileName);
        if (value.fullName) return String(value.fullName);
        if (value.displayName) return String(value.displayName);
        if (value.roleName) return String(value.roleName);
        if (value.teamName) return String(value.teamName);
        if (value.subteamName) return String(value.subteamName);
        if (value.label) return String(value.label);

        const entries = Object.entries(value)
            .filter(([subKey, subValue]) => !TECHNICAL_KEYS.has(subKey) && subValue !== null && subValue !== undefined && subValue !== '')
            .slice(0, 3)
            .map(([subKey, subValue]) => `${FIELD_LABELS[subKey] || toTitleCase(subKey)}: ${formatValueForField(subKey, subValue)}`);

        if (entries.length > 0) return entries.join(' · ');
        return 'Updated details';
    }

    return String(value);
}

function pushAfterOnlyRow(changes: ChangeRow[], label: string, after: string) {
    if (!isEmptyFormattedValue(after)) {
        changes.push({ label, before: '—', after, afterOnly: true });
    }
}

function collectAssignmentChanges(actionType: string, oldValue: unknown, newValue: unknown, description?: string | null): ChangeRow[] {
    const { oldObject, newObject } = normalizeAssignmentPayload(oldValue, newValue, description);
    const source = actionType === 'UNASSIGNED' ? oldObject : newObject;
    const changes: ChangeRow[] = [];

    const memberName = getFirstText(
        source.memberName,
        newObject.memberName,
        oldObject.memberName,
        extractMemberNameFromDescription(description),
    );

    if (memberName) {
        if (actionType === 'UNASSIGNED') {
            changes.push({ label: 'Member', before: memberName, after: '—' });
        } else {
            pushAfterOnlyRow(changes, 'Member', memberName);
        }
    }

    const taskTitle = getFirstText(source.taskTitle, newObject.taskTitle, oldObject.taskTitle, extractTaskTitleFromDescription(description));
    if (taskTitle && actionType !== 'UNASSIGNED') {
        pushAfterOnlyRow(changes, 'Task', taskTitle);
    }

    const startValue = source.startDateTime ?? newObject.startDateTime ?? oldObject.startDateTime;
    const endValue = source.endDateTime ?? newObject.endDateTime ?? oldObject.endDateTime;

    if (startValue) {
        const formatted = formatDateTimeValue(startValue);
        if (actionType === 'UNASSIGNED') {
            changes.push({ label: 'Start time', before: formatted, after: '—' });
        } else {
            pushAfterOnlyRow(changes, 'Start time', formatted);
        }
    }

    if (endValue) {
        const formatted = formatDateTimeValue(endValue);
        if (actionType === 'UNASSIGNED') {
            changes.push({ label: 'End time', before: formatted, after: '—' });
        } else {
            pushAfterOnlyRow(changes, 'End time', formatted);
        }
    }

    return changes;
}

function collectScheduleSlotChanges(actionType: string, oldValue: unknown, newValue: unknown): ChangeRow[] {
    const oldObject: LooseRecord = isPlainObject(oldValue) ? oldValue : {};
    const newObject: LooseRecord = isPlainObject(newValue) ? newValue : {};
    const source = actionType === 'DELETED' ? oldObject : newObject;
    const changes: ChangeRow[] = [];

    const memberName = getFirstText(source.memberName, newObject.memberName, oldObject.memberName);
    if (memberName) {
        if (actionType === 'DELETED') {
            changes.push({ label: 'Member', before: memberName, after: '—' });
        } else {
            pushAfterOnlyRow(changes, 'Member', memberName);
        }
    }

    const title = getFirstText(source.title, newObject.title, oldObject.title, source.taskTitle, newObject.taskTitle);
    if (title) {
        if (actionType === 'DELETED') {
            changes.push({ label: 'Title', before: title, after: '—' });
        } else {
            pushAfterOnlyRow(changes, 'Title', title);
        }
    }

    for (const [key, label] of [['startDateTime', 'Start time'], ['endDateTime', 'End time']] as const) {
        const value = source[key] ?? newObject[key] ?? oldObject[key];
        if (!value) continue;
        const formatted = formatDateTimeValue(value);
        if (actionType === 'DELETED') {
            changes.push({ label, before: formatted, after: '—' });
        } else {
            pushAfterOnlyRow(changes, label, formatted);
        }
    }

    return changes;
}

function collectRegistrationChanges(actionType: string, oldValue: unknown, newValue: unknown): ChangeRow[] {
    const oldObject: LooseRecord = isPlainObject(oldValue) ? oldValue : {};
    const newObject: LooseRecord = isPlainObject(newValue) ? newValue : {};
    const changes: ChangeRow[] = [];

    const name = getFirstText(newObject.fullName, oldObject.fullName);
    if (name) pushAfterOnlyRow(changes, 'Name', name);

    const oldStatus = getFirstText(oldObject.status);
    const newStatus = getFirstText(newObject.status);
    if (actionType === 'CHECKED_IN' && newStatus) {
        pushAfterOnlyRow(changes, 'Status', toTitleCase(newStatus));
    } else if (actionType === 'CANCELLED') {
        changes.push({ label: 'Status', before: toTitleCase(oldStatus) || 'Registered', after: 'Cancelled' });
    } else if (oldStatus || newStatus) {
        changes.push({
            label: 'Status',
            before: oldStatus ? toTitleCase(oldStatus) : '—',
            after: newStatus ? toTitleCase(newStatus) : '—',
        });
    }

    return changes;
}

function collectDependencyChanges(actionType: string, oldValue: unknown, newValue: unknown): ChangeRow[] {
    const payload = actionType === 'DEPENDENCY_REMOVED'
        ? (isPlainObject(oldValue) ? oldValue : {})
        : (isPlainObject(newValue) ? newValue : {});
    const title = getFirstText(payload.dependsOnTaskTitle);
    if (title) {
        return [{ label: 'Depends on', before: actionType === 'DEPENDENCY_REMOVED' ? title : '—', after: actionType === 'DEPENDENCY_REMOVED' ? '—' : title, afterOnly: actionType === 'DEPENDENCY_ADDED' }];
    }
    return [];
}

function collectGenericChanges(oldValue: unknown, newValue: unknown, actionType: string): ChangeRow[] {
    const oldObject: LooseRecord = isPlainObject(oldValue) ? oldValue : {};
    const newObject: LooseRecord = isPlainObject(newValue) ? newValue : {};
    const keys = [...new Set([...Object.keys(oldObject), ...Object.keys(newObject)])];
    const useAfterOnly = actionType === 'CREATED';
    const changes: ChangeRow[] = [];

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

        if (useAfterOnly || isEmptyFormattedValue(beforeValue)) {
            pushAfterOnlyRow(changes, label, afterValue);
        } else if (isEmptyFormattedValue(afterValue)) {
            changes.push({ label, before: beforeValue, after: '—' });
        } else {
            changes.push({ label, before: beforeValue, after: afterValue });
        }
    }

    return changes;
}

export function collectReadableChanges(oldValue: unknown, newValue: unknown, event: ActivityTimelineEvent = {}): ChangeRow[] {
    const actionType = String(event.actionType || '').toUpperCase();
    const entityType = String(event.entityType || '').trim().toUpperCase();

    if (ASSIGNMENT_ACTION_TYPES.has(actionType)) {
        return collectAssignmentChanges(actionType, oldValue, newValue, event.description);
    }

    if (actionType === 'COMMENT_EDITED') {
        const before = truncateText(oldValue, 96);
        const after = truncateText(newValue, 96);
        if (before === after) return [];
        return [{ label: 'Comment', before, after }];
    }

    if (actionType === 'COMMENTED') {
        const comment = truncateText(typeof newValue === 'string' ? newValue : (isPlainObject(newValue) ? newValue.comment : newValue), 120);
        if (comment) return [{ label: 'Comment', before: '—', after: comment, afterOnly: true }];
        return [];
    }

    if (actionType === 'COMMENT_DELETED') {
        const comment = truncateText(typeof oldValue === 'string' ? oldValue : (isPlainObject(oldValue) ? oldValue.comment : oldValue), 120);
        if (comment) return [{ label: 'Comment', before: comment, after: '—' }];
        return [];
    }

    if (actionType === 'DEPENDENCY_ADDED' || actionType === 'DEPENDENCY_REMOVED') {
        return collectDependencyChanges(actionType, oldValue, newValue);
    }

    if (entityType === 'SCHEDULE_SLOT' || entityType === 'SCHEDULE') {
        return collectScheduleSlotChanges(actionType, oldValue, newValue);
    }

    if (entityType === 'REGISTRATION' && (actionType === 'CHECKED_IN' || actionType === 'CANCELLED' || actionType === 'CREATED')) {
        return collectRegistrationChanges(actionType, oldValue, newValue);
    }

    return collectGenericChanges(oldValue, newValue, actionType);
}

function getEntityTypeForTone(event: ActivityTimelineEvent, contextEntity: ActivityTimelineContextEntity | null): string {
    const explicitType = String(event.entityType || '').trim().toUpperCase();
    if (explicitType) return explicitType;

    if (event.phase || event.phaseId) return 'PHASE';
    if (event.task?.parentTaskId || event.parentTaskId) return 'SUBTASK';
    if (event.task || event.taskId || event.eventTask || event.eventTaskId) return 'TASK';

    const contextLabel = normalizeEntityLabel(contextEntity?.label || contextEntity?.type).toUpperCase();
    if (contextLabel) return contextLabel;

    return inferEntityLabelFromDescription(event.description).toUpperCase();
}

function getLifecycleToneClass(actionType: string, oldValue: unknown, newValue: unknown, searchText: string): string | null {
    const oldStatus = getObjectStatus(oldValue);
    const newStatus = getObjectStatus(newValue);

    if (actionType === 'ABORTED' || oldStatus === 'CANCELLED' || newStatus === 'CANCELLED') {
        return 'activity-tone-deleted';
    }

    if (actionType === 'ARCHIVED' || (isPlainObject(newValue) && newValue.isArchived === true) || (isPlainObject(oldValue) && oldValue.isArchived === true)) {
        return 'activity-tone-muted';
    }

    if (actionType === 'CREATED' || actionType === 'FINALIZED' || (isPlainObject(newValue) && newValue.isFinalized === true)) {
        return 'activity-tone-success';
    }

    if (actionType === 'REACTIVATED' || actionType === 'ACTIVATED') {
        return 'activity-tone-updated';
    }

    if (
        actionType === 'DEACTIVATED'
        || oldStatus === 'ON_HOLD'
        || newStatus === 'ON_HOLD'
        || (isPlainObject(oldValue) && oldValue.isActive === false)
        || (isPlainObject(newValue) && newValue.isActive === false)
        || textIncludesAny(searchText, ['deactivated', 'deactivate', 'on hold', 'held'])
    ) {
        return 'activity-tone-warning';
    }

    return null;
}

export function getToneClass(event: ActivityTimelineEvent, contextEntity: ActivityTimelineContextEntity | null = null): string {
    const actionType = String(event.actionType || '').toUpperCase();
    const oldValue = parseMaybeJson(event.oldValue);
    const newValue = parseMaybeJson(event.newValue);
    const entityType = getEntityTypeForTone(event, contextEntity);
    const searchText = toSearchText(actionType, event.description, event.entityType, event.entityName);

    if (COMMENT_ACTION_TYPES.has(actionType) || actionType.includes('COMMENT')) {
        return 'activity-tone-comment';
    }

    if (entityType === 'SCHEDULE_SLOT' || entityType === 'SCHEDULE' || textIncludesAny(searchText, ['schedule slot', 'schedule'])) {
        return 'activity-tone-schedule';
    }

    if (entityType === 'PROJECT' || entityType === 'EVENT') {
        const lifecycleTone = getLifecycleToneClass(actionType, oldValue, newValue, searchText);
        if (lifecycleTone) return lifecycleTone;
        return 'activity-tone-default';
    }

    if (actionType === 'DELETED' || actionType === 'ABORTED' || actionType === 'CANCELLED') {
        return 'activity-tone-deleted';
    }

    if (actionType === 'CREATED' || actionType === 'CHECKED_IN') {
        return 'activity-tone-created';
    }

    if (
        actionType === 'UPDATED'
        || actionType === 'STATUS_CHANGED'
        || actionType === 'ASSIGNMENT_STATUS_CHANGED'
        || ASSIGNMENT_ACTION_TYPES.has(actionType)
        || actionType.includes('UPDATED')
        || actionType.includes('CHANGED')
        || actionType.includes('EDITED')
        || actionType === 'REORDERED'
    ) {
        return 'activity-tone-updated';
    }

    if (getObjectStatus(oldValue) || getObjectStatus(newValue)) {
        return 'activity-tone-updated';
    }

    return 'activity-tone-default';
}

export function getBadgeLabel(event: ActivityTimelineEvent): string {
    const actionType = String(event.actionType || '').toUpperCase();
    if (actionType && BADGE_LABEL_OVERRIDES[actionType]) return BADGE_LABEL_OVERRIDES[actionType];
    if (actionType) return toTitleCase(actionType.replace(/_/g, ' '));
    return 'Activity';
}

function getEntityNameForLabel(
    event: ActivityTimelineEvent,
    entityLabel: string,
    fallbackEntity: { label: string; name: string } | null,
    fileNameFromDescription: string,
): string {
    const fallbackName = fallbackEntity && fallbackEntity.label === entityLabel ? fallbackEntity.name : '';
    const taskTitleFromDescription = extractTaskTitleFromDescription(event.description);
    const parsedNew = parseMaybeJson(event.newValue) as LooseRecord | null;
    const parsedOld = parseMaybeJson(event.oldValue) as LooseRecord | null;

    switch (entityLabel) {
        case 'Project':
            return getFirstText(event.entity?.title, event.entity?.name, event.entityName, event.title, event.name, fallbackName, 'Unnamed project');
        case 'Event':
            return getFirstText(parsedNew?.title, event.entity?.title, event.entityName, event.title, fallbackName, 'Untitled event');
        case 'Tier':
            return getFirstText(parsedNew?.name, parsedOld?.name, extractQuotedNameFromDescription(event.description), fallbackName, 'Untitled tier');
        case 'Registration':
            return getFirstText(parsedNew?.fullName, parsedOld?.fullName, fallbackName, 'Registration');
        case 'Custom Field':
            return getFirstText(parsedNew?.label, parsedOld?.label, fallbackName, 'Custom field');
        case 'Phase':
            return getFirstText(event.phase?.title, event.phase?.name, event.entityName, fallbackName, 'Untitled phase');
        case 'Subtask':
            return getFirstText(event.task?.title, event.task?.name, event.entityName, fallbackName, 'Untitled subtask');
        case 'Task':
            return getFirstText(event.eventTask?.title, event.task?.title, event.task?.name, parsedNew?.title, taskTitleFromDescription, event.entityName, fallbackName, 'Untitled task');
        case 'Assignment':
            return getFirstText(event.eventTask?.title, event.task?.title, taskTitleFromDescription, parsedNew?.memberName, fallbackName, 'Assignment');
        case 'File':
            return getFirstText(event.file?.fileName, event.file?.title, fileNameFromDescription, fallbackName, 'Untitled file');
        case 'Schedule':
            return getFirstText(parsedNew?.title, parsedOld?.title, parsedNew?.memberName, event.entityName, fallbackName, 'Scheduled item');
        default:
            return getFirstText(event.entity?.title, event.entity?.name, event.entityName, event.title, event.name, fallbackName, 'Unnamed item');
    }
}

function extractQuotedNameFromDescription(description: unknown): string {
    const text = getFirstText(description);
    const match = text.match(/"([^"]+)"/);
    return match?.[1]?.trim() || '';
}

export function getEntityDetails(event: ActivityTimelineEvent, contextEntity: ActivityTimelineContextEntity | null): { label: string; name: string } | null {
    const fallbackEntity = normalizeContextEntity(contextEntity);
    const fileNameFromDescription = extractFileNameFromDescription(event.description);
    const inferredLabel = inferEntityLabelFromDescription(event.description);
    const taskTitleFromDescription = extractTaskTitleFromDescription(event.description);
    const entityType = String(event.entityType || '').trim().toUpperCase();

    if (entityType === 'ASSIGNMENT' && (event.eventTask || event.task || taskTitleFromDescription)) {
        return {
            label: 'Task',
            name: getFirstText(event.eventTask?.title, event.task?.title, taskTitleFromDescription, 'Untitled task'),
        };
    }

    if (entityType === 'SCHEDULE_SLOT' || entityType === 'SCHEDULE') {
        const parsed = parseMaybeJson(event.newValue) as LooseRecord | null;
        const parsedOld = parseMaybeJson(event.oldValue) as LooseRecord | null;
        return {
            label: 'Schedule',
            name: getFirstText(parsed?.title, parsedOld?.title, parsed?.memberName, parsedOld?.memberName, event.task?.title, 'Scheduled slot'),
        };
    }

    if (event.entityType) {
        const entityLabel = normalizeEntityLabel(event.entityType);
        return {
            label: entityLabel || 'Item',
            name: getEntityNameForLabel(event, entityLabel || 'Item', fallbackEntity, fileNameFromDescription),
        };
    }

    if (event.phase) {
        return { label: 'Phase', name: getFirstText(event.phase.title, event.phase.name, 'Untitled phase') };
    }

    if (event.task) {
        const taskLabel = event.task.parentTaskId ? 'Subtask' : 'Task';
        return { label: taskLabel, name: getFirstText(event.task.title, event.task.name, 'Untitled task') };
    }

    if (event.eventTask) {
        return { label: 'Task', name: getFirstText(event.eventTask.title, event.eventTask.name, taskTitleFromDescription, 'Untitled task') };
    }

    if (inferredLabel) {
        return {
            label: inferredLabel,
            name: getEntityNameForLabel(event, inferredLabel, fallbackEntity, fileNameFromDescription),
        };
    }

    if (event.file || fileNameFromDescription) {
        return { label: 'File', name: getFirstText(event.file?.fileName, fileNameFromDescription, 'Untitled file') };
    }

    if (event.entityName || event.title || event.name || fallbackEntity) {
        return {
            label: fallbackEntity?.label || 'Item',
            name: getFirstText(event.entityName, event.title, event.name, fallbackEntity?.name, 'Unnamed item'),
        };
    }

    return null;
}

export function getSupportingNote(event: ActivityTimelineEvent, changeRows: ChangeRow[]): string {
    if (COMMENT_ACTION_TYPES.has(String(event.actionType || ''))) return '';
    if (!event.description) return '';

    const text = String(event.description).trim();
    if (!text) return '';

    if (changeRows.length > 0) return '';

    return text;
}
