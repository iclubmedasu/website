import { useState, useCallback } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
} from 'lucide-react';
import { tasksAPI, phasesAPI, getProfilePhotoUrl } from '../../../services/api';
import ConfirmModal from '../modals/ConfirmModal';
import './PhaseRow.css';

const STATUS_LABELS = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const PRIORITY_LABELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

const DIFFICULTY_LABELS = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
};

const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtDateInput(d) {
    if (!d) return '';
    return new Date(d).toISOString().split('T')[0];
}

/* ── Inline select for status/priority/difficulty ── */
function InlineSelect({ taskId, field, current, options, labels, canEdit, onChanged, colorClass }) {
    const [busy, setBusy] = useState(false);

    const handleChange = async (e) => {
        const next = e.target.value;
        if (next === current || !canEdit) return;
        // optimistic update
        onChanged(taskId, field, next);
        setBusy(true);
        try {
            await tasksAPI.update(taskId, { [field]: next });
        } catch {
            // revert on error
            onChanged(taskId, field, current);
        } finally {
            setBusy(false);
        }
    };

    if (!canEdit) {
        return (
            <span className={`phase-row-badge phase-row-badge--${field} phase-row-badge--${current}`}>
                {labels[current] ?? current}
            </span>
        );
    }

    return (
        <select
            className={`phase-row-select phase-row-select--${field} phase-row-select--${current}`}
            value={current}
            onChange={handleChange}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
        >
            {options.map((o) => (
                <option key={o} value={o}>{labels[o]}</option>
            ))}
        </select>
    );
}

/* ── Avatar stack ── */
function AvatarStack({ assignments }) {
    if (!assignments?.length) return <span className="phase-row-no-assignee">—</span>;
    const shown = assignments.slice(0, 3);
    const extra = assignments.length - 3;
    return (
        <div className="phase-row-avatar-stack">
            {shown.map((a) => (
                <span
                    key={a.id}
                    className="phase-row-avatar"
                    title={a.member?.fullName}
                >
                    {a.member?.profilePhotoUrl ? (
                        <img src={getProfilePhotoUrl(a.member.id)} alt="" className="phase-row-avatar-img" />
                    ) : (
                        (a.member?.fullName ?? '?').charAt(0).toUpperCase()
                    )}
                </span>
            ))}
            {extra > 0 && <span className="phase-row-avatar phase-row-avatar--extra">+{extra}</span>}
        </div>
    );
}

/* ── Mini progress bar ── */
function MiniProgress({ completed, total }) {
    if (total === 0) return <span className="phase-row-no-assignee">—</span>;
    const pct = Math.round((completed / total) * 100);
    return (
        <div className="phase-row-mini-progress" title={`${completed}/${total} subtasks done`}>
            <div className="phase-row-mini-progress-bar">
                <div className="phase-row-mini-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="phase-row-mini-progress-text">{pct}%</span>
        </div>
    );
}

/* ── Subtask row (indented, inside expanded task) ── */
function SubtaskRow({ task, canEdit, onFieldChange, onEditTask, onDeleteTask }) {
    return (
        <tr className="phase-row-subtask-tr">
            <td className="phase-row-td phase-row-td--title phase-row-td--subtask-title">
                <span className="phase-row-subtask-indent" />
                {task.title}
            </td>
            <td className="phase-row-td">
                <InlineSelect
                    taskId={task.id} field="status" current={task.status}
                    options={TASK_STATUSES} labels={STATUS_LABELS}
                    canEdit={canEdit} onChanged={onFieldChange}
                />
            </td>
            <td className="phase-row-td">
                <InlineSelect
                    taskId={task.id} field="priority" current={task.priority}
                    options={PRIORITIES} labels={PRIORITY_LABELS}
                    canEdit={canEdit} onChanged={onFieldChange}
                />
            </td>
            <td className="phase-row-td">
                <InlineSelect
                    taskId={task.id} field="difficulty" current={task.difficulty}
                    options={DIFFICULTIES} labels={DIFFICULTY_LABELS}
                    canEdit={canEdit} onChanged={onFieldChange}
                />
            </td>
            <td className="phase-row-td phase-row-td--date">{fmtDate(task.dueDate)}</td>
            <td className="phase-row-td"><AvatarStack assignments={task.assignments} /></td>
            <td className="phase-row-td">—</td>
            <td className="phase-row-td phase-row-td--actions">
                {canEdit && (
                    <div className="phase-row-actions">
                        <button
                            className="phase-row-action-btn phase-row-action-btn--edit"
                            title="Edit subtask"
                            onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                        >
                            <Pencil size={13} />
                        </button>
                        <button
                            className="phase-row-action-btn phase-row-action-btn--danger"
                            title="Delete subtask"
                            onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
}

/* ── Task row (top-level inside the table) ── */
function TaskRow({ task, canEdit, onFieldChange, onAddSubtask, onEditTask, onDeleteTask }) {
    const [expanded, setExpanded] = useState(false);
    const hasSubs = task.subtasks?.length > 0;
    const completedSubs = (task.subtasks || []).filter((s) => s.status === 'COMPLETED').length;
    const totalSubs = (task.subtasks || []).length;

    return (
        <>
            <tr className="phase-row-task-tr" onClick={() => hasSubs && setExpanded((o) => !o)}>
                <td className="phase-row-td phase-row-td--title">
                    <span className="phase-row-task-expand">
                        {hasSubs
                            ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                            : <span style={{ width: 14, display: 'inline-block' }} />}
                    </span>
                    <span className="phase-row-task-title-text">{task.title}</span>
                </td>
                <td className="phase-row-td">
                    <InlineSelect
                        taskId={task.id} field="status" current={task.status}
                        options={TASK_STATUSES} labels={STATUS_LABELS}
                        canEdit={canEdit} onChanged={onFieldChange}
                    />
                </td>
                <td className="phase-row-td">
                    <InlineSelect
                        taskId={task.id} field="priority" current={task.priority}
                        options={PRIORITIES} labels={PRIORITY_LABELS}
                        canEdit={canEdit} onChanged={onFieldChange}
                    />
                </td>
                <td className="phase-row-td">
                    <InlineSelect
                        taskId={task.id} field="difficulty" current={task.difficulty}
                        options={DIFFICULTIES} labels={DIFFICULTY_LABELS}
                        canEdit={canEdit} onChanged={onFieldChange}
                    />
                </td>
                <td className="phase-row-td phase-row-td--date">{fmtDate(task.dueDate)}</td>
                <td className="phase-row-td"><AvatarStack assignments={task.assignments} /></td>
                <td className="phase-row-td">
                    <MiniProgress completed={completedSubs} total={totalSubs} />
                </td>
                <td className="phase-row-td phase-row-td--actions">
                    {canEdit && (
                        <div className="phase-row-actions">
                            <button
                                className="phase-row-action-btn phase-row-action-btn--purple"
                                title="Add subtask"
                                onClick={(e) => { e.stopPropagation(); onAddSubtask(task); }}
                            >
                                <Plus size={13} />
                            </button>
                            <button
                                className="phase-row-action-btn phase-row-action-btn--edit"
                                title="Edit task"
                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                            >
                                <Pencil size={13} />
                            </button>
                            <button
                                className="phase-row-action-btn phase-row-action-btn--danger"
                                title="Delete task"
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    )}
                </td>
            </tr>
            {expanded && hasSubs && task.subtasks.map((s) => (
                <SubtaskRow key={s.id} task={s} canEdit={canEdit} onFieldChange={onFieldChange} onEditTask={onEditTask} onDeleteTask={(t) => onDeleteTask(t)} />
            ))}
        </>
    );
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PhaseRow — main export
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function PhaseRow({ phase, canEdit, allMembers, onPhaseUpdated, onTaskUpdated, onAddTask, onAddSubtask, onEditTask, onEditPhase, onDeletePhase }) {
    const [expanded, setExpanded] = useState(false);
    // Confirm modal state: { type: 'task'|'subtask', id, title } | null
    const [confirmDelete, setConfirmDelete] = useState(null);

    const tasks = phase.tasks || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    /* Update a field on a task or subtask in local state */
    const handleFieldChange = useCallback((taskId, field, value) => {
        onTaskUpdated(phase.id, taskId, field, value);
    }, [phase.id, onTaskUpdated]);

    const handleDeleteTask = useCallback(async (taskId) => {
        try {
            await tasksAPI.remove(taskId);
            onTaskUpdated(phase.id, taskId, '__delete', true);
        } catch {
            /* swallow */
        }
    }, [phase.id, onTaskUpdated]);

    // Ask for confirmation before deleting a task/subtask
    const requestDeleteTask = useCallback((task) => {
        setConfirmDelete({
            type: task.parentTaskId ? 'subtask' : 'task',
            id: task.id,
            title: task.title,
        });
    }, []);

    return (
        <div className="phase-row">
            {/* Confirm delete modal for tasks/subtasks */}
            {confirmDelete && (
                <ConfirmModal
                    title={`Delete ${confirmDelete.type === 'subtask' ? 'Subtask' : 'Task'}`}
                    itemName={confirmDelete.title}
                    message={confirmDelete.type === 'task'
                        ? 'All subtasks and assignees will be permanently removed. This action cannot be undone.'
                        : 'This subtask and all its assignees will be permanently removed. This action cannot be undone.'
                    }
                    confirmLabel="Delete"
                    onConfirm={() => handleDeleteTask(confirmDelete.id)}
                    onClose={() => setConfirmDelete(null)}
                />
            )}

            {/* Phase header */}
            <div
                className="phase-row-header"
                onClick={() => setExpanded((o) => !o)}
            >
                <div className="phase-row-header-left">
                    <span className="phase-row-chevron">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="phase-row-title">{phase.title}</span>
                    <span className="phase-row-task-count">
                        {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="phase-row-progress">
                    <div className="phase-row-progress-bar">
                        <div
                            className="phase-row-progress-fill"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <span className="phase-row-progress-text">{progressPct}%</span>
                </div>
                {canEdit && (
                    <div className="phase-row-header-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="phase-row-header-btn phase-row-header-btn--edit"
                            title="Edit phase"
                            onClick={() => onEditPhase(phase)}
                        >
                            <Pencil size={13} />
                        </button>
                        <button
                            className="phase-row-header-btn phase-row-header-btn--danger"
                            title="Delete phase"
                            onClick={() => onDeletePhase(phase)}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* Tasks table */}
            {expanded && (
                <div className="phase-row-table-wrapper">
                    {tasks.length > 0 ? (
                        <table className="phase-row-table">
                            <thead>
                                <tr>
                                    <th className="phase-row-th">Task</th>
                                    <th className="phase-row-th">Status</th>
                                    <th className="phase-row-th">Priority</th>
                                    <th className="phase-row-th">Difficulty</th>
                                    <th className="phase-row-th">Due</th>
                                    <th className="phase-row-th">Assignees</th>
                                    <th className="phase-row-th">Progress</th>
                                    <th className="phase-row-th" style={{ width: '4.5rem' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((t) => (
                                    <TaskRow
                                        key={t.id}
                                        task={t}
                                        canEdit={canEdit}
                                        onFieldChange={handleFieldChange}
                                        onAddSubtask={(parentTask) => onAddSubtask(phase, parentTask)}
                                        onEditTask={onEditTask}
                                        onDeleteTask={requestDeleteTask}
                                    />
                                ))}
                                {canEdit && (
                                    <tr
                                        className="phase-row-add-task-tr"
                                        onClick={() => onAddTask(phase)}
                                    >
                                        <td colSpan="8" className="phase-row-add-task-td">
                                            <Plus size={13} />
                                            <span>Add Task</span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="phase-row-empty">
                            No tasks in this phase yet.
                            {canEdit && (
                                <button
                                    className="phase-row-empty-btn"
                                    onClick={() => onAddTask(phase)}
                                >
                                    <Plus size={13} /> Add first task
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
