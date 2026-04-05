import { useState, useCallback, useMemo, useRef } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
    GripVertical,
} from 'lucide-react';
import { tasksAPI, getProfilePhotoUrl } from '../../../../services/api';
import DeletePhaseTaskModal from '../../modals/DeletePhaseTaskModal';
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

function fmtDate(d: string | null | undefined) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ── Inline select for status/priority/difficulty ── */
function InlineSelect({ taskId, field, current, options, labels, canEdit, onChanged }: any) {
    const [busy, setBusy] = useState(false);
    const effectiveCurrent = current ?? options?.[0] ?? '';

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        if (next === effectiveCurrent || !canEdit) return;
        // optimistic update
        onChanged(taskId, field, next);
        setBusy(true);
        try {
            // Use updateStatus for status field (allows assigned members)
            if (field === 'status') {
                await tasksAPI.updateStatus(taskId, next as any);
            } else {
                await tasksAPI.update(taskId, { [field]: next });
            }
        } catch {
            // revert on error
            onChanged(taskId, field, effectiveCurrent);
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
            value={effectiveCurrent}
            onChange={handleChange}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
        >
            {options.map((o: string) => (
                <option key={o} value={o}>{labels[o]}</option>
            ))}
        </select>
    );
}

/* ── Avatar stack ── */
function AvatarStack({ assignments }: any) {
    if (!assignments?.length) return <span className="phase-row-no-assignee">—</span>;
    const shown = assignments.slice(0, 3);
    const extra = assignments.length - 3;
    return (
        <div className="phase-row-avatar-stack">
            {shown.map((a: any) => (
                <span
                    key={a.id}
                    className="phase-row-avatar"
                    title={a.member?.fullName}
                >
                    {a.member?.profilePhotoUrl && a.member?.id ? (
                        <img src={getProfilePhotoUrl(a.member.id) || undefined} alt={a.member?.fullName || 'Member avatar'} className="phase-row-avatar-img" />
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
function MiniProgress({ completed, total }: any) {
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
function SubtaskRow({ task, canEdit, canEditStatus, onFieldChange, onEditTask, onDeleteTask,
    onSubDragStart, onSubDragOver, onSubDrop, onSubDragEnd, isDragging }: any) {
    return (
        <tr
            className={`phase-row-subtask-tr${isDragging ? ' phase-row-dragging' : ''}`}
            onDragOver={(e: React.DragEvent<HTMLTableRowElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSubDragOver && onSubDragOver(e); }}
            onDrop={(e: React.DragEvent<HTMLTableRowElement>) => { e.preventDefault(); e.stopPropagation(); onSubDrop && onSubDrop(task.id); }}
        >
            {canEdit && (
                <td className="phase-row-td phase-row-td--drag" style={{ padding: 0 }}>
                    <span
                        className="drag-handle"
                        draggable
                        onDragStart={(e: React.DragEvent<HTMLSpanElement>) => {
                            e.stopPropagation();
                            const tr = (e.currentTarget.closest('tr') as HTMLElement | null);
                            if (tr) e.dataTransfer.setDragImage(tr, 0, 0);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(task.id));
                            onSubDragStart && onSubDragStart(task.id);
                        }}
                        onDragEnd={() => onSubDragEnd && onSubDragEnd()}
                    >
                        <GripVertical size={12} />
                    </span>
                </td>
            )}
            <td className="phase-row-td phase-row-td--title phase-row-td--subtask-title">
                <span className="phase-row-subtask-indent" />
                {task.title}
            </td>
            <td className="phase-row-td">
                <InlineSelect
                    taskId={task.id} field="status" current={task.status}
                    options={TASK_STATUSES} labels={STATUS_LABELS}
                    canEdit={canEditStatus || canEdit} onChanged={onFieldChange}
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
function TaskRow({ task, canEdit, canEditStatus, onFieldChange, onAddSubtask, onEditTask, onDeleteTask,
    dragTaskId, onTaskDragStart, onTaskDragEnd, onTaskDrop }: any) {
    const [expanded, setExpanded] = useState(false);
    const hasSubs = task.subtasks?.length > 0;
    const taskSubtasks = (task.subtasks || []) as any[];
    const completedSubs = taskSubtasks.filter((s: any) => s.status === 'COMPLETED').length;
    const totalSubs = taskSubtasks.length;

    // Subtask drag-and-drop reorder (local state)
    const [subDragOrder, setSubDragOrder] = useState<number[] | null>(null);
    const [dragSubId, setDragSubId] = useState<number | null>(null);
    const dragSubIdRef = useRef<number | null>(null);
    const propSubtasks = (task.subtasks || []) as any[];
    const orderedSubtasks = useMemo(() => {
        if (!subDragOrder) return propSubtasks;
        const subMap = new Map(propSubtasks.map((s: any) => [s.id, s]));
        const ordered = subDragOrder.map((id: number) => subMap.get(id)).filter(Boolean);
        const orderedIds = new Set(subDragOrder);
        const newSubs = propSubtasks.filter((s: any) => !orderedIds.has(s.id));
        return [...ordered, ...newSubs];
    }, [subDragOrder, propSubtasks]);

    const handleSubDragStart = useCallback((subtaskId: number) => { setDragSubId(subtaskId); dragSubIdRef.current = subtaskId; }, []);
    const handleSubDragEnd = useCallback(() => { setDragSubId(null); dragSubIdRef.current = null; }, []);
    const handleSubDrop = useCallback((targetId: number) => {
        const currentDragId = dragSubIdRef.current;
        if (currentDragId == null || currentDragId === targetId) return;
        setSubDragOrder((prev) => {
            const currentOrder = (prev || propSubtasks.map((s: any) => s.id));
            const fromIdx = currentOrder.indexOf(currentDragId);
            const toIdx = currentOrder.indexOf(targetId);
            if (fromIdx < 0 || toIdx < 0) return prev;
            const newOrder = [...currentOrder];
            const [moved] = newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, moved);
            return newOrder;
        });
        setDragSubId(null);
        dragSubIdRef.current = null;
    }, [propSubtasks]);

    const isDragging = dragTaskId === task.id;

    return (
        <>
            <tr
                className={`phase-row-task-tr${isDragging ? ' phase-row-dragging' : ''}`}
                onClick={() => hasSubs && setExpanded((o) => !o)}
                onDragOver={(e: React.DragEvent<HTMLTableRowElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e: React.DragEvent<HTMLTableRowElement>) => { e.preventDefault(); e.stopPropagation(); onTaskDrop && onTaskDrop(task.id); }}
            >
                {canEdit && (
                    <td className="phase-row-td phase-row-td--drag" style={{ padding: 0 }}>
                        <span
                            className="drag-handle"
                            draggable
                            onDragStart={(e: React.DragEvent<HTMLSpanElement>) => {
                                e.stopPropagation();
                                const tr = (e.currentTarget.closest('tr') as HTMLElement | null);
                                if (tr) e.dataTransfer.setDragImage(tr, 0, 0);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', String(task.id));
                                onTaskDragStart && onTaskDragStart(task.id);
                            }}
                            onDragEnd={() => onTaskDragEnd && onTaskDragEnd()}
                        >
                            <GripVertical size={12} />
                        </span>
                    </td>
                )}
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
                        canEdit={canEditStatus || canEdit} onChanged={onFieldChange}
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
            {expanded && hasSubs && orderedSubtasks.map((s: any) => (
                <SubtaskRow
                    key={s.id}
                    task={s}
                    canEdit={canEdit}
                    canEditStatus={canEditStatus}
                    onFieldChange={onFieldChange}
                    onEditTask={onEditTask}
                    onDeleteTask={(t: any) => onDeleteTask(t)}
                    onSubDragStart={handleSubDragStart}
                    onSubDragOver={() => { }}
                    onSubDrop={handleSubDrop}
                    onSubDragEnd={handleSubDragEnd}
                    isDragging={dragSubId === s.id}
                />
            ))}
        </>
    );
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PhaseRow — main export
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function PhaseRow({ phase, canEdit, canEditStatus, allMembers: _allMembers, onPhaseUpdated: _onPhaseUpdated, onTaskUpdated, onAddTask, onAddSubtask, onEditTask, onEditPhase, onDeletePhase }: any) {
    const [expanded, setExpanded] = useState(false);
    // Confirm modal state: { type: 'task'|'subtask', id, title } | null
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'task' | 'subtask'; id: number; title: string } | null>(null);

    const tasks = (phase.tasks || []) as any[];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Task drag-and-drop reorder (local state)
    const [taskDragOrder, setTaskDragOrder] = useState<number[] | null>(null);
    const [dragTaskId, setDragTaskId] = useState<number | null>(null);
    const dragTaskIdRef = useRef<number | null>(null);
    const orderedTasks = useMemo(() => {
        if (!taskDragOrder) return tasks;
        const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
        const ordered = taskDragOrder.map((id: number) => taskMap.get(id)).filter(Boolean);
        const orderedIds = new Set(taskDragOrder);
        const newTasks = tasks.filter((t: any) => !orderedIds.has(t.id));
        return [...ordered, ...newTasks];
    }, [taskDragOrder, tasks]);

    const handleTaskDragStart = useCallback((taskId: number) => { setDragTaskId(taskId); dragTaskIdRef.current = taskId; }, []);
    const handleTaskDragEnd = useCallback(() => { setDragTaskId(null); dragTaskIdRef.current = null; }, []);
    const handleTaskDrop = useCallback((targetId: number) => {
        const currentDragId = dragTaskIdRef.current;
        if (currentDragId == null || currentDragId === targetId) return;
        setTaskDragOrder((prev) => {
            const currentOrder = (prev || tasks.map((t: any) => t.id));
            const fromIdx = currentOrder.indexOf(currentDragId);
            const toIdx = currentOrder.indexOf(targetId);
            if (fromIdx < 0 || toIdx < 0) return prev;
            const newOrder = [...currentOrder];
            const [moved] = newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, moved);
            return newOrder;
        });
        setDragTaskId(null);
        dragTaskIdRef.current = null;
    }, [tasks]);

    /* Update a field on a task or subtask in local state */
    const handleFieldChange = useCallback((taskId: number, field: string, value: string) => {
        onTaskUpdated(phase.id, taskId, field, value);
    }, [phase.id, onTaskUpdated]);

    const handleDeleteTask = useCallback(async (taskId: number) => {
        try {
            await tasksAPI.remove(taskId);
            onTaskUpdated(phase.id, taskId, '__delete', true);
        } catch {
            /* swallow */
        }
    }, [phase.id, onTaskUpdated]);

    // Ask for confirmation before deleting a task/subtask
    const requestDeleteTask = useCallback((task: any) => {
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
                <DeletePhaseTaskModal
                    title={`Delete ${confirmDelete.type === 'subtask' ? 'Subtask' : 'Task'}`}
                    itemName={confirmDelete.title}
                    message={confirmDelete.type === 'task'
                        ? 'All subtasks and assignees will be permanently removed. This action cannot be undone.'
                        : 'This subtask and all its assignees will be permanently removed. This action cannot be undone.'
                    }
                    confirmLabel="Delete"
                    onConfirm={() => { void handleDeleteTask(confirmDelete.id); }}
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
                                    {canEdit && <th className="phase-row-th phase-row-th--drag" />}
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
                                {orderedTasks.map((t: any) => (
                                    <TaskRow
                                        key={t.id}
                                        task={t}
                                        canEdit={canEdit}
                                        canEditStatus={canEditStatus}
                                        onFieldChange={handleFieldChange}
                                        onAddSubtask={(parentTask: any) => onAddSubtask(phase, parentTask)}
                                        onEditTask={onEditTask}
                                        onDeleteTask={requestDeleteTask}
                                        dragTaskId={dragTaskId}
                                        onTaskDragStart={handleTaskDragStart}
                                        onTaskDragEnd={handleTaskDragEnd}
                                        onTaskDrop={handleTaskDrop}
                                    />
                                ))}
                                {canEdit && (
                                    <tr
                                        className="phase-row-add-task-tr"
                                        onClick={() => onAddTask(phase)}
                                    >
                                        <td colSpan={9} className="phase-row-add-task-td">
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
