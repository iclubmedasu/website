'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { X, Link2, Trash2 } from 'lucide-react';
import { tasksAPI } from '../../../services/api';
import { toTitleCase } from '../../../utils/titleCase';
import type {
    Difficulty,
    Id,
    MemberSummary,
    Priority,
    ProjectDetail,
    TaskStatus,
    TaskSummary,
    UpdateTaskPayload,
} from '../../../types/backend-contracts';

const DIFFICULTIES: readonly Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const STATUSES: readonly TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED', 'ON_HOLD', 'CANCELLED'];

type LegacyTaskPriority = Priority | 'URGENT';
const PRIORITIES: readonly LegacyTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

type DependencyType = 'FINISH_TO_START' | 'START_TO_START';

const PRIORITY_LABELS: Record<LegacyTaskPriority, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
    URGENT: 'Urgent',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
};

interface TaskRelationSummary {
    id?: Id;
    title?: string;
    status?: TaskStatus;
}

interface TaskDependencyWithRelations {
    id?: Id;
    dependencyType?: string;
    dependsOnTaskId?: Id;
    dependsOnTask?: TaskRelationSummary | null;
    task?: TaskRelationSummary | null;
}

type TaskSummaryWithRelations = Omit<TaskSummary, 'dependencies' | 'dependsOn'> & {
    dependencies?: TaskDependencyWithRelations[];
    dependsOn?: TaskDependencyWithRelations[];
    canEdit?: boolean;
    canEditStatus?: boolean;
    canCollaborate?: boolean;
};

interface EditTaskFormState {
    title: string;
    description: string;
    status: TaskStatus;
    priority: LegacyTaskPriority;
    difficulty: Difficulty;
    startDate: string;
    dueDate: string;
    estimatedHours: string;
    actualHours: string;
    assigneeIds: Id[];
}

interface EditTaskModalProps {
    task: TaskSummaryWithRelations | null;
    projectDetail?: ProjectDetail | null;
    allMembers?: MemberSummary[];
    onClose: () => void;
    onTaskUpdated: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function toLegacyPriority(priority?: Priority | null): LegacyTaskPriority {
    if (priority === 'CRITICAL') return 'URGENT';
    if (priority === 'LOW' || priority === 'MEDIUM' || priority === 'HIGH') return priority;
    return 'MEDIUM';
}

function flattenProjectTasks(projectDetail: ProjectDetail | null): TaskSummary[] {
    const flattened: TaskSummary[] = [];

    const visitTask = (taskNode: TaskSummary) => {
        flattened.push(taskNode);
        (taskNode.subtasks || []).forEach(visitTask);
    };

    (projectDetail?.phases || []).forEach((phase) => {
        (phase.tasks || []).forEach(visitTask);
    });

    return flattened;
}

export default function EditTaskModal({
    task,
    projectDetail = null,
    allMembers = [],
    onClose,
    onTaskUpdated,
}: EditTaskModalProps) {
    const [form, setForm] = useState<EditTaskFormState>({
        title: '',
        description: '',
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
        difficulty: 'MEDIUM',
        startDate: '',
        dueDate: '',
        estimatedHours: '',
        actualHours: '',
        assigneeIds: [],
    });
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [taskDetail, setTaskDetail] = useState<TaskSummaryWithRelations | null>(task);
    const [dependencyTaskId, setDependencyTaskId] = useState('');
    const [dependencyType, setDependencyType] = useState<DependencyType>('FINISH_TO_START');

    useEffect(() => {
        if (task) {
            setForm({
                title: task.title || '',
                description: task.description || '',
                status: task.status || 'NOT_STARTED',
                priority: toLegacyPriority(task.priority),
                difficulty: task.difficulty || 'MEDIUM',
                startDate: task.startDate ? task.startDate.slice(0, 10) : '',
                dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
                estimatedHours: task.estimatedHours != null ? String(task.estimatedHours) : '',
                actualHours: task.actualHours != null ? String(task.actualHours) : '',
                assigneeIds: (task.assignments || [])
                    .map((assignment) => assignment.member?.id ?? assignment.memberId)
                    .filter((memberId): memberId is Id => memberId != null),
            });
            setTaskDetail(task);
        }
    }, [task]);

    useEffect(() => {
        if (!task?.id) return;

        let cancelled = false;

        const loadTaskDetail = async () => {
            try {
                const detailedTask = await tasksAPI.getById(task.id);
                if (cancelled) return;
                setTaskDetail(detailedTask as TaskSummaryWithRelations);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err, 'Failed to load task details'));
                }
            }
        };

        void loadTaskDetail();

        return () => {
            cancelled = true;
        };
    }, [task?.id]);

    const setField =
        <K extends keyof Omit<EditTaskFormState, 'assigneeIds'>>(key: K) =>
            (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                const value = e.target.value;
                setForm((current) => ({ ...current, [key]: value }));
            };

    const toggleAssignee = (memberId: Id) => {
        setForm((current) => {
            const exists = current.assigneeIds.includes(memberId);
            return {
                ...current,
                assigneeIds: exists
                    ? current.assigneeIds.filter((id) => id !== memberId)
                    : [...current.assigneeIds, memberId],
            };
        });
    };

    const refreshTaskDetail = async () => {
        if (!task?.id) return;
        const detailedTask = await tasksAPI.getById(task.id);
        setTaskDetail(detailedTask as TaskSummaryWithRelations);
        return detailedTask as TaskSummaryWithRelations;
    };

    const handleAddDependency = async () => {
        if (!task?.id || !dependencyTaskId) return;

        const parsedDependencyTaskId = parseInt(dependencyTaskId, 10);
        if (Number.isNaN(parsedDependencyTaskId)) {
            setError('Please select a valid dependency task');
            return;
        }

        setActionLoading(true);
        setError('');

        try {
            await tasksAPI.addDependency(task.id, parsedDependencyTaskId, dependencyType);
            setDependencyTaskId('');
            setDependencyType('FINISH_TO_START');
            await refreshTaskDetail();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to add dependency'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveDependency = async (dependsOnTaskId?: Id) => {
        if (!task?.id || !dependsOnTaskId) return;

        setActionLoading(true);
        setError('');

        try {
            await tasksAPI.removeDependency(task.id, dependsOnTaskId);
            await refreshTaskDetail();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to remove dependency'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!task?.id) return;

        if (!canManageTask && !canUpdateStatus) {
            setError('You do not have permission to update this task');
            return;
        }

        if (canManageTask && !form.title.trim()) {
            setError('Title is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (!canManageTask && canUpdateStatus) {
                await tasksAPI.updateStatus(task.id, form.status);
            } else {
                const normalizedPriority: Priority = form.priority === 'URGENT' ? 'CRITICAL' : form.priority;

                const payload: UpdateTaskPayload = {
                    title: form.title.trim(),
                    description: form.description.trim() || null,
                    status: form.status,
                    priority: normalizedPriority,
                    difficulty: form.difficulty,
                    startDate: form.startDate || null,
                    dueDate: form.dueDate || null,
                    estimatedHours: form.estimatedHours !== '' ? parseFloat(form.estimatedHours) : null,
                    actualHours: form.actualHours !== '' ? parseFloat(form.actualHours) : null,
                    assigneeIds: form.assigneeIds,
                };

                await tasksAPI.update(task.id, payload);
            }
            onTaskUpdated();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update task'));
        } finally {
            setLoading(false);
        }
    };

    const isSubtask = !!task?.parentTaskId;
    const heading = isSubtask ? 'Edit Subtask' : 'Edit Task';
    const currentTask = taskDetail || task;
    const projectTasks = flattenProjectTasks(projectDetail).filter((candidate) => candidate.id !== task?.id);
    const dependencies = currentTask?.dependencies || [];
    const dependsOn = currentTask?.dependsOn || [];
    const canManageTask = currentTask?.canEdit ?? task?.canEdit ?? true;
    const canUpdateStatus = currentTask?.canEditStatus ?? task?.canEditStatus ?? canManageTask;
    const isStatusOnlyMode = !canManageTask && canUpdateStatus;

    if (!task) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">{heading}</h2>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    {isStatusOnlyMode && (
                        <div className="form-hint">
                            You can update task status, but only project managers can change task structure, dependencies, or assignees.
                        </div>
                    )}

                    <div className="form-section">
                        <h3 className="form-section-title">Task Info</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-task-title">Title *</label>
                            <input
                                id="edit-task-title"
                                className="form-input"
                                placeholder="Task title"
                                value={form.title}
                                onChange={setField('title')}
                                onBlur={(e) => setForm((current) => ({ ...current, title: toTitleCase(e.target.value) }))}
                                autoFocus={!isStatusOnlyMode}
                                disabled={!canManageTask}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-task-description">Description</label>
                            <textarea
                                id="edit-task-description"
                                className="form-input form-textarea"
                                placeholder="Optional description..."
                                value={form.description}
                                onChange={setField('description')}
                                disabled={!canManageTask}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-status">Status</label>
                                <select
                                    id="edit-task-status"
                                    title="Task status"
                                    className="form-input"
                                    value={form.status}
                                    onChange={setField('status')}
                                    disabled={!canUpdateStatus}
                                    autoFocus={isStatusOnlyMode}
                                >
                                    {STATUSES.map((status) => (
                                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-priority">Priority</label>
                                <select id="edit-task-priority" title="Task priority" className="form-input" value={form.priority} onChange={setField('priority')} disabled={!canManageTask}>
                                    {PRIORITIES.map((priority) => (
                                        <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-difficulty">Difficulty</label>
                                <select id="edit-task-difficulty" title="Task difficulty" className="form-input" value={form.difficulty} onChange={setField('difficulty')} disabled={!canManageTask}>
                                    {DIFFICULTIES.map((difficulty) => (
                                        <option key={difficulty} value={difficulty}>{DIFFICULTY_LABELS[difficulty]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-start-date">Start Date</label>
                                <input
                                    id="edit-task-start-date"
                                    type="date"
                                    title="Task start date"
                                    className="form-input"
                                    value={form.startDate}
                                    onChange={setField('startDate')}
                                    disabled={!canManageTask}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-due-date">Due Date</label>
                                <input
                                    id="edit-task-due-date"
                                    type="date"
                                    title="Task due date"
                                    className="form-input"
                                    value={form.dueDate}
                                    onChange={setField('dueDate')}
                                    disabled={!canManageTask}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-estimated-hours">Estimated Hours</label>
                                <input
                                    id="edit-task-estimated-hours"
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={form.estimatedHours}
                                    onChange={setField('estimatedHours')}
                                    disabled={!canManageTask}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-actual-hours">Actual Hours</label>
                                <input
                                    id="edit-task-actual-hours"
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={form.actualHours}
                                    onChange={setField('actualHours')}
                                    disabled={!canManageTask}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Dependencies</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-dependency-target">Depends on</label>
                                {projectDetail ? (
                                    <select
                                        id="edit-task-dependency-target"
                                        title="Dependency task"
                                        className="form-input"
                                        value={dependencyTaskId}
                                        onChange={(e) => setDependencyTaskId(e.target.value)}
                                        disabled={!canManageTask}
                                    >
                                        <option value="">Select a task</option>
                                        {projectTasks.map((candidate) => (
                                            <option key={candidate.id} value={candidate.id}>
                                                {candidate.title}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        id="edit-task-dependency-target"
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        placeholder="Task ID"
                                        value={dependencyTaskId}
                                        onChange={(e) => setDependencyTaskId(e.target.value)}
                                        disabled={!canManageTask}
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="edit-task-dependency-type">Dependency Type</label>
                                <select
                                    id="edit-task-dependency-type"
                                    title="Dependency type"
                                    className="form-input"
                                    value={dependencyType}
                                    onChange={(e) => setDependencyType(e.target.value as DependencyType)}
                                    disabled={!canManageTask}
                                >
                                    <option value="FINISH_TO_START">Finish to Start</option>
                                    <option value="START_TO_START">Start to Start</option>
                                </select>
                            </div>
                        </div>

                        <button className="btn btn-secondary" type="button" onClick={handleAddDependency} disabled={!canManageTask || !dependencyTaskId || actionLoading}>
                            <Link2 size={14} />
                            Add Dependency
                        </button>

                        <div className="edit-task-dependency-columns">
                            <div>
                                <p className="form-hint edit-task-dependency-heading">This task depends on</p>
                                {dependencies.length > 0 ? dependencies.map((dependency) => {
                                    const dependsOnId = dependency.dependsOnTask?.id ?? dependency.dependsOnTaskId;
                                    const dependencyKey = dependency.id ?? `${dependsOnId ?? 'unknown'}-${dependency.dependencyType ?? 'type'}`;
                                    return (
                                        <div
                                            key={dependencyKey}
                                            className="edit-task-dependency-card"
                                        >
                                            <div>
                                                <strong>{dependency.dependsOnTask?.title ?? 'Unknown task'}</strong>
                                                <div className="form-hint edit-task-dependency-meta">{dependency.dependencyType}</div>
                                            </div>
                                            <button className="btn btn-secondary" type="button" onClick={() => handleRemoveDependency(dependsOnId)} disabled={!canManageTask || actionLoading}>
                                                <Trash2 size={13} />
                                                Remove
                                            </button>
                                        </div>
                                    );
                                }) : (
                                    <p className="form-hint">No prerequisites set.</p>
                                )}
                            </div>

                            <div>
                                <p className="form-hint edit-task-dependency-heading">Tasks depending on this task</p>
                                {dependsOn.length > 0 ? dependsOn.map((dependency) => {
                                    const reverseDependencyKey = dependency.id ?? `${dependency.task?.id ?? 'unknown'}-${dependency.dependencyType ?? 'type'}`;
                                    return (
                                        <div
                                            key={reverseDependencyKey}
                                            className="edit-task-dependency-card edit-task-dependency-card--compact"
                                        >
                                            <strong>{dependency.task?.title ?? 'Unknown task'}</strong>
                                            <div className="form-hint edit-task-dependency-meta">{dependency.dependencyType}</div>
                                        </div>
                                    );
                                }) : (
                                    <p className="form-hint">No tasks depend on this one yet.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Assignees</h3>
                        {allMembers.length > 0 ? (
                            <div className="team-badge-picker">
                                {allMembers.map((member) => {
                                    const selected = form.assigneeIds.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            type="button"
                                            className={`team-badge-option${selected ? ' team-badge-option--selected' : ''}`}
                                            onClick={() => toggleAssignee(member.id)}
                                            disabled={!canManageTask}
                                        >
                                            {member.fullName}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="form-hint">No members available.</p>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={loading || actionLoading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading || actionLoading || (!canManageTask && !canUpdateStatus)}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
