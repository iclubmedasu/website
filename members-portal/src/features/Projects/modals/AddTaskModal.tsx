'use client';

import { useState, type ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { tasksAPI } from '../../../services/api';
import { toTitleCase } from '../../../utils/titleCase';
import type {
    CreateTaskPayload,
    Difficulty,
    Id,
    MemberSummary,
    Priority,
    TaskStatus,
    TaskSummary,
} from '../../../types/backend-contracts';

const DIFFICULTIES: readonly Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const STATUSES: readonly TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED', 'ON_HOLD', 'CANCELLED'];

type LegacyTaskPriority = Priority | 'URGENT';
const PRIORITIES: readonly LegacyTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

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

interface TaskFormState {
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

interface AddTaskModalProps {
    projectId: Id;
    phaseId?: Id | null;
    parentTask?: TaskSummary | null;
    allMembers?: MemberSummary[];
    onClose: () => void;
    onTaskCreated: (task: TaskSummary) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to create task';
}

export default function AddTaskModal({
    projectId,
    phaseId,
    parentTask = null,
    allMembers = [],
    onClose,
    onTaskCreated,
}: AddTaskModalProps) {
    const [form, setForm] = useState<TaskFormState>({
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
    const [error, setError] = useState('');

    const setField =
        <K extends keyof Omit<TaskFormState, 'assigneeIds'>>(key: K) =>
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

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            setError('Title is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const normalizedPriority: Priority = form.priority === 'URGENT' ? 'CRITICAL' : form.priority;

            const payload: CreateTaskPayload = {
                projectId,
                phaseId: phaseId || null,
                parentTaskId: parentTask?.id || null,
                title: form.title.trim(),
                description: form.description.trim() || null,
                status: form.status,
                priority: normalizedPriority,
                difficulty: form.difficulty,
                startDate: form.startDate || null,
                dueDate: form.dueDate || null,
                estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
                assigneeIds: form.assigneeIds,
            };

            const created = await tasksAPI.create(payload);
            onTaskCreated(created);
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const heading = parentTask ? `Add Subtask to "${parentTask.title}"` : 'Add Task';

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

                    <div className="form-section">
                        <h3 className="form-section-title">Task Info</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="add-task-title">Title *</label>
                            <input
                                id="add-task-title"
                                className="form-input"
                                placeholder="Task title"
                                value={form.title}
                                onChange={setField('title')}
                                onBlur={(e) => setForm((current) => ({ ...current, title: toTitleCase(e.target.value) }))}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="add-task-description">Description</label>
                            <textarea
                                id="add-task-description"
                                className="form-input form-textarea"
                                placeholder="Optional description..."
                                value={form.description}
                                onChange={setField('description')}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-status">Status</label>
                                <select id="add-task-status" title="Task status" className="form-input" value={form.status} onChange={setField('status')}>
                                    {STATUSES.map((status) => (
                                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-priority">Priority</label>
                                <select id="add-task-priority" title="Task priority" className="form-input" value={form.priority} onChange={setField('priority')}>
                                    {PRIORITIES.map((priority) => (
                                        <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-difficulty">Difficulty</label>
                                <select id="add-task-difficulty" title="Task difficulty" className="form-input" value={form.difficulty} onChange={setField('difficulty')}>
                                    {DIFFICULTIES.map((difficulty) => (
                                        <option key={difficulty} value={difficulty}>{DIFFICULTY_LABELS[difficulty]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-start-date">Start Date</label>
                                <input
                                    id="add-task-start-date"
                                    type="date"
                                    title="Task start date"
                                    className="form-input"
                                    value={form.startDate}
                                    onChange={setField('startDate')}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-due-date">Due Date</label>
                                <input
                                    id="add-task-due-date"
                                    type="date"
                                    title="Task due date"
                                    className="form-input"
                                    value={form.dueDate}
                                    onChange={setField('dueDate')}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-estimated-hours">Estimated Hours</label>
                                <input
                                    id="add-task-estimated-hours"
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={form.estimatedHours}
                                    onChange={setField('estimatedHours')}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="add-task-actual-hours">Actual Hours</label>
                                <input
                                    id="add-task-actual-hours"
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={form.actualHours}
                                    onChange={setField('actualHours')}
                                />
                            </div>
                        </div>
                    </div>

                    {allMembers.length > 0 && (
                        <div className="form-section">
                            <h3 className="form-section-title">Assignees</h3>
                            <div className="team-badge-picker">
                                {allMembers.map((member) => {
                                    const selected = form.assigneeIds.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            type="button"
                                            className={`team-badge-option${selected ? ' team-badge-option--selected' : ''}`}
                                            onClick={() => toggleAssignee(member.id)}
                                        >
                                            {member.fullName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Creating...' : parentTask ? 'Add Subtask' : 'Add Task'}
                    </button>
                </div>
            </div>
        </>
    );
}
