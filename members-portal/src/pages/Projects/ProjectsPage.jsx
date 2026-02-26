import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus,
    X,
    ChevronDown,
    ChevronRight,
    Calendar,
    Users,
    CheckSquare,
    AlertCircle,
    Pencil,
    PauseCircle,
    SquareCheckBig,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, tasksAPI, teamsAPI, membersAPI } from '../../services/api';
import './ProjectsPage.css';
import '../Teams/TeamsPage.css';
import CreateProjectModal from './modals/CreateProjectModal';
import DeactivateProjectModal from './modals/DeactivateProjectModal';

// ─────────────────────────────────────────────────────────
//  Filter Dropdown (matches Members / Teams page style)
// ─────────────────────────────────────────────────────────
function FilterDropdown({ options, value, onChange, triggerLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selected = options.find((o) => String(o.value) === String(value)) || options[0];
    const displayLabel = selected ? selected.label : triggerLabel;

    return (
        <div className="manage-roles-container" ref={dropdownRef}>
            <div className="manage-roles-header">
                <div
                    className="manage-combobox-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="manage-combobox-label">{displayLabel}</span>
                    <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} size={20} />
                </div>
            </div>
            <div className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`} role="listbox">
                {options.map((opt) => (
                    <div key={opt.value ?? 'all'} className="manage-dropdown-item-wrapper">
                        <button
                            type="button"
                            role="option"
                            aria-selected={String(opt.value) === String(value)}
                            className={`manage-dropdown-item ${String(opt.value) === String(value) ? 'active' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            <span className="manage-dropdown-item-label">{opt.label}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────
const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const STATUS_LABELS = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const PRIORITY_LABELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

const PROJECT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCategoryClass(category) {
    return 'badge-category-' + (category ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function isOverdue(dueDate, status) {
    if (!dueDate || status === 'COMPLETED' || status === 'CANCELLED') return false;
    return new Date(dueDate) < new Date();
}

// ─────────────────────────────────────────────────────────
//  Badge component
// ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    return (
        <span className={`badge badge-status-${status}`}>
            <span className={`status-dot status-dot-${status}`} />
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}

function PriorityBadge({ priority }) {
    return (
        <span className={`badge badge-priority-${priority}`}>
            {PRIORITY_LABELS[priority] ?? priority}
        </span>
    );
}

// ─────────────────────────────────────────────────────────
//  Inline status selector for tasks
// ─────────────────────────────────────────────────────────
function TaskStatusSelect({ taskId, current, canEdit, onChanged }) {
    const [busy, setBusy] = useState(false);

    const handleChange = async (e) => {
        const next = e.target.value;
        if (next === current || !canEdit) return;
        setBusy(true);
        try {
            await tasksAPI.updateStatus(taskId, next);
            onChanged(taskId, next);
        } catch {
            /* swallow */
        } finally {
            setBusy(false);
        }
    };

    if (!canEdit) return <StatusBadge status={current} />;

    return (
        <select
            className={`status-select-inline s-${current}`}
            value={current}
            onChange={handleChange}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
        >
            {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
        </select>
    );
}

// ─────────────────────────────────────────────────────────
//  Subtask item (recursive)
// ─────────────────────────────────────────────────────────
function SubtaskItem({ task, canEdit, onStatusChange, depth = 0 }) {
    const [open, setOpen] = useState(false);
    const hasSubs = task.subtasks && task.subtasks.length > 0;
    const over = isOverdue(task.dueDate, task.status);

    return (
        <div>
            <div className="subtask-item" onClick={() => hasSubs && setOpen((o) => !o)}>
                <span className="subtask-item-title">{task.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <TaskStatusSelect
                        taskId={task.id}
                        current={task.status}
                        canEdit={canEdit}
                        onChanged={onStatusChange}
                    />
                    {over && (
                        <span title="Overdue" style={{ color: '#dc2626', display: 'flex' }}>
                            <AlertCircle size={12} />
                        </span>
                    )}
                    {hasSubs && (
                        <button className="task-expand-btn">
                            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                    )}
                </div>
            </div>
            {open && hasSubs && (
                <div className="subtask-list" style={{ marginLeft: depth > 0 ? '1rem' : undefined }}>
                    {task.subtasks.map((s) => (
                        <SubtaskItem key={s.id} task={s} canEdit={canEdit} onStatusChange={onStatusChange} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Task item (top-level inside project detail)
// ─────────────────────────────────────────────────────────
function TaskItem({ task, canEdit, onStatusChange, onAddSubtask }) {
    const [open, setOpen] = useState(false);
    const hasSubs = task.subtasks && task.subtasks.length > 0;
    const over = isOverdue(task.dueDate, task.status);

    return (
        <div className="task-item">
            <div className="task-item-header">
                <span className="task-item-title">{task.title}</span>
                <div className="task-item-meta">
                    <TaskStatusSelect
                        taskId={task.id}
                        current={task.status}
                        canEdit={canEdit}
                        onChanged={onStatusChange}
                    />
                    <PriorityBadge priority={task.priority} />
                    {over && (
                        <span title="Overdue" style={{ color: '#dc2626', display: 'flex' }}>
                            <AlertCircle size={13} />
                        </span>
                    )}
                    {canEdit && (
                        <button
                            className="task-expand-btn"
                            title="Add subtask"
                            onClick={(e) => { e.stopPropagation(); onAddSubtask(task); }}
                        >
                            <Plus size={13} />
                        </button>
                    )}
                    {hasSubs && (
                        <button
                            className="task-expand-btn"
                            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                        >
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {/* assignees */}
            {task.assignments?.length > 0 && (
                <div className="task-item-assignees">
                    {task.assignments.map((a) => (
                        <span key={a.id} className="assignee-chip">{a.member?.fullName ?? '—'}</span>
                    ))}
                </div>
            )}

            {/* due date */}
            {task.dueDate && (
                <div className={`project-card-due ${over ? 'overdue' : ''}`} style={{ fontSize: '0.72rem' }}>
                    <Calendar size={11} />
                    Due {fmtDate(task.dueDate)}
                </div>
            )}

            {/* subtasks */}
            {open && hasSubs && (
                <div className="subtask-list">
                    {task.subtasks.map((s) => (
                        <SubtaskItem key={s.id} task={s} canEdit={canEdit} onStatusChange={onStatusChange} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Project Detail Panel (right-side drawer)
// ─────────────────────────────────────────────────────────
function ProjectDetailPanel({ project: initProject, allMembers, onClose, onProjectUpdated, canEdit }) {
    const [project, setProject] = useState(initProject);
    const [addingTask, setAddingTask] = useState(false);
    const [addingSubtaskFor, setAddingSubtaskFor] = useState(null); // task object
    const [newTask, setNewTask] = useState({ title: '', priority: 'MEDIUM', status: 'NOT_STARTED', dueDate: '', assigneeIds: [] });
    const [taskLoading, setTaskLoading] = useState(false);
    const [taskError, setTaskError] = useState('');

    // Refresh tasks when project changed from outside
    useEffect(() => { setProject(initProject); }, [initProject]);

    // Update a task status in local state
    const handleTaskStatusChange = useCallback((taskId, newStatus) => {
        setProject((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => {
                if (t.id === taskId) return { ...t, status: newStatus };
                // also check subtasks
                return {
                    ...t,
                    subtasks: (t.subtasks || []).map((s) =>
                        s.id === taskId ? { ...s, status: newStatus } : s
                    ),
                };
            }),
        }));
        onProjectUpdated?.();
    }, [onProjectUpdated]);

    const handleAddTask = async () => {
        if (!newTask.title.trim()) { setTaskError('Title is required'); return; }
        setTaskLoading(true); setTaskError('');
        try {
            const created = await tasksAPI.create({
                projectId: project.id,
                parentTaskId: addingSubtaskFor ? addingSubtaskFor.id : null,
                title: newTask.title.trim(),
                priority: newTask.priority,
                status: newTask.status,
                dueDate: newTask.dueDate || undefined,
                assigneeIds: newTask.assigneeIds,
            });

            // Merge into local state
            setProject((prev) => {
                if (!addingSubtaskFor) {
                    return { ...prev, tasks: [...(prev.tasks || []), { ...created, subtasks: [], assignments: created.assignments || [] }] };
                }
                return {
                    ...prev,
                    tasks: prev.tasks.map((t) =>
                        t.id === addingSubtaskFor.id
                            ? { ...t, subtasks: [...(t.subtasks || []), { ...created, subtasks: [] }] }
                            : t
                    ),
                };
            });

            setNewTask({ title: '', priority: 'MEDIUM', status: 'NOT_STARTED', dueDate: '', assigneeIds: [] });
            setAddingTask(false);
            setAddingSubtaskFor(null);
            onProjectUpdated?.();
        } catch (err) {
            setTaskError(err.message || 'Failed to create task');
        } finally {
            setTaskLoading(false);
        }
    };

    const openAddTask = () => {
        setAddingSubtaskFor(null);
        setAddingTask(true);
    };

    const openAddSubtask = (parentTask) => {
        setAddingSubtaskFor(parentTask);
        setAddingTask(true);
    };

    const cancelAddTask = () => {
        setAddingTask(false);
        setAddingSubtaskFor(null);
        setNewTask({ title: '', priority: 'MEDIUM', status: 'NOT_STARTED', dueDate: '', assigneeIds: [] });
        setTaskError('');
    };

    const over = isOverdue(project.dueDate, project.status);

    return (
        <div className="project-detail-overlay" onClick={onClose}>
            <div className="project-detail-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="project-detail-header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                            <StatusBadge status={project.status} />
                            <PriorityBadge priority={project.priority} />
                            {over && <span className="badge badge-status-DELAYED"><AlertCircle size={11} /> Overdue</span>}
                        </div>
                        <div className="project-detail-title">{project.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>
                            {project.projectType?.name} · Created by {project.createdBy?.fullName ?? '—'}
                        </div>
                    </div>
                    <button className="project-detail-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="project-detail-body">

                    {/* Info row */}
                    <div className="detail-info-row">
                        <div className="detail-info-item">
                            <span className="detail-info-label">Start Date</span>
                            <span className="detail-info-value">{fmtDate(project.startDate)}</span>
                        </div>
                        <div className="detail-info-item">
                            <span className="detail-info-label">Due Date</span>
                            <span className={`detail-info-value${over ? ' overdue' : ''}`}
                                style={over ? { color: '#dc2626' } : {}}>
                                {fmtDate(project.dueDate)}
                            </span>
                        </div>
                        {project.completedDate && (
                            <div className="detail-info-item">
                                <span className="detail-info-label">Completed</span>
                                <span className="detail-info-value">{fmtDate(project.completedDate)}</span>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {project.description && (
                        <div>
                            <div className="detail-section-title">Description</div>
                            <div className="detail-description">{project.description}</div>
                        </div>
                    )}

                    {/* Teams */}
                    <div>
                        <div className="detail-section-title">Teams</div>
                        <div className="detail-teams-list">
                            {project.projectTeams?.length ? (
                                project.projectTeams.map((pt) => (
                                    <span key={pt.id} className="badge-team">
                                        {pt.team?.name ?? '—'}
                                        {pt.isOwner ? ' ★' : ''}
                                        {!pt.canEdit ? ' (view)' : ''}
                                    </span>
                                ))
                            ) : (
                                <span style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>No teams assigned</span>
                            )}
                        </div>
                    </div>

                    {/* Tags */}
                    {project.tags?.length > 0 && (
                        <div>
                            <div className="detail-section-title">Tags</div>
                            <div className="detail-teams-list">
                                {project.tags.map((t) => (
                                    <span key={t.id} className="badge-team" style={{ background: '#f1f5f9', color: '#475569' }}>
                                        #{t.tagName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tasks */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <div className="detail-section-title" style={{ marginBottom: 0 }}>
                                Tasks ({project.tasks?.length ?? 0})
                            </div>
                            {canEdit && (
                                <button className="icon-btn" onClick={openAddTask}>
                                    <Plus size={13} /> Add Task
                                </button>
                            )}
                        </div>

                        {/* Add task inline form */}
                        {addingTask && (
                            <div className="task-detail-section" style={{ marginBottom: '0.75rem' }}>
                                <div className="task-detail-title" style={{ fontSize: '0.85rem' }}>
                                    {addingSubtaskFor ? `Subtask of: "${addingSubtaskFor.title}"` : 'New Task'}
                                </div>
                                <input
                                    className="modal-input"
                                    placeholder="Task title *"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask((n) => ({ ...n, title: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                    autoFocus
                                />
                                <div className="modal-row">
                                    <div className="modal-form-group">
                                        <label className="modal-label">Priority</label>
                                        <select
                                            className="modal-select"
                                            value={newTask.priority}
                                            onChange={(e) => setNewTask((n) => ({ ...n, priority: e.target.value }))}
                                        >
                                            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                                        </select>
                                    </div>
                                    <div className="modal-form-group">
                                        <label className="modal-label">Due Date</label>
                                        <input
                                            type="date"
                                            className="modal-input"
                                            value={newTask.dueDate}
                                            onChange={(e) => setNewTask((n) => ({ ...n, dueDate: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Assignee picker */}
                                {allMembers.length > 0 && (
                                    <div className="modal-form-group">
                                        <label className="modal-label">Assign members</label>
                                        <div className="team-checkbox-list">
                                            {allMembers.map((m) => (
                                                <label key={m.id} className="team-checkbox-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={newTask.assigneeIds.includes(m.id)}
                                                        onChange={(e) => {
                                                            setNewTask((n) => ({
                                                                ...n,
                                                                assigneeIds: e.target.checked
                                                                    ? [...n.assigneeIds, m.id]
                                                                    : n.assigneeIds.filter((id) => id !== m.id),
                                                            }));
                                                        }}
                                                    />
                                                    <span className="team-checkbox-label">{m.fullName}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {taskError && <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>{taskError}</div>}
                                <div className="modal-actions" style={{ paddingTop: 0, borderTop: 'none' }}>
                                    <button className="modal-btn-cancel" onClick={cancelAddTask}>Cancel</button>
                                    <button className="modal-btn-submit" onClick={handleAddTask} disabled={taskLoading}>
                                        {taskLoading ? 'Saving…' : 'Add Task'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {project.tasks?.length ? (
                            <div className="task-list">
                                {project.tasks.map((t) => (
                                    <TaskItem
                                        key={t.id}
                                        task={t}
                                        canEdit={canEdit}
                                        onStatusChange={handleTaskStatusChange}
                                        onAddSubtask={openAddSubtask}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)', textAlign: 'center', padding: '1.5rem 0' }}>
                                No tasks yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Expanded card: collapsible subtask row (recursive)
// ─────────────────────────────────────────────────────────
function ExpandedSubtaskRow({ task, depth = 0 }) {
    const [open, setOpen] = useState(false);
    const hasSubs = task.subtasks?.length > 0;
    const over = isOverdue(task.dueDate, task.status);

    return (
        <div style={depth > 0 ? { paddingLeft: '1rem' } : undefined}>
            <div
                className="exp-subtask-row"
                style={hasSubs ? { cursor: 'pointer' } : undefined}
                onClick={() => hasSubs && setOpen((o) => !o)}
            >
                <div className="exp-task-left">
                    {hasSubs
                        ? <span className="task-expand-btn">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                        : <span style={{ width: 12, flexShrink: 0, display: 'inline-block' }} />}
                    <span className="exp-subtask-title">{task.title}</span>
                </div>
                <div className="exp-task-meta">
                    <StatusBadge status={task.status} />
                    {over && <span style={{ color: '#dc2626', display: 'flex' }}><AlertCircle size={10} /></span>}
                </div>
            </div>
            {open && hasSubs && task.subtasks.map((s) => (
                <ExpandedSubtaskRow key={s.id} task={s} depth={depth + 1} />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Expanded card: full task row with collapsible subtasks
// ─────────────────────────────────────────────────────────
function ExpandedTaskRow({ task }) {
    const [open, setOpen] = useState(false);
    const hasSubs = task.subtasks?.length > 0;
    const over = isOverdue(task.dueDate, task.status);

    return (
        <div className="exp-task">
            <div
                className="exp-task-header"
                style={hasSubs ? { cursor: 'pointer' } : undefined}
                onClick={() => hasSubs && setOpen((o) => !o)}
            >
                <div className="exp-task-left">
                    {hasSubs
                        ? <span className="task-expand-btn">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                        : <span style={{ width: 13, flexShrink: 0, display: 'inline-block' }} />}
                    <span className="exp-task-title">{task.title}</span>
                </div>
                <div className="exp-task-meta">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {over && <span title="Overdue" style={{ color: '#dc2626', display: 'flex' }}><AlertCircle size={11} /></span>}
                </div>
            </div>
            {(task.assignments?.length > 0 || task.dueDate) && (
                <div className="exp-task-sub">
                    {task.assignments?.length > 0 && (
                        <div className="exp-task-assignees">
                            {task.assignments.map((a) => (
                                <span key={a.id} className="assignee-chip">{a.member?.fullName ?? '—'}</span>
                            ))}
                        </div>
                    )}
                    {task.dueDate && (
                        <div className={`project-card-due${over ? ' overdue' : ''}`} style={{ fontSize: '0.72rem' }}>
                            <Calendar size={10} />
                            {fmtDate(task.dueDate)}
                        </div>
                    )}
                </div>
            )}
            {open && hasSubs && (
                <div className="exp-subtask-list">
                    {task.subtasks.map((s) => <ExpandedSubtaskRow key={s.id} task={s} />)}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Project Card with Expandable Detail
// ─────────────────────────────────────────────────────────
function ProjectCard({ project, expanded, fullDetail, onToggle, onEdit, onDeactivate, canEdit }) {
    const over = isOverdue(project.dueDate, project.status);
    const ownerTeam = fullDetail?.projectTeams?.find((pt) => pt.isOwner) ?? null;
    const otherTeams = fullDetail?.projectTeams?.filter((pt) => !pt.isOwner) ?? [];

    return (
        <div
            className={`project-card${expanded ? ' project-card--expanded' : ''}`}
            onClick={() => !expanded && onToggle(project)}
        >
            {/* Close button when expanded */}
            {expanded && (
                <button
                    className="expanded-close-btn"
                    onClick={(e) => { e.stopPropagation(); onToggle(null); }}
                    title="Close"
                >
                    <X size={16} />
                </button>
            )}

            {/* Collapsed content - always visible but hidden when expanded */}
            <div className="project-card-collapsed-content">
                <div className="project-card-header">
                    <span className="project-card-title">{project.title}</span>
                    <div className="project-card-meta">
                        {canEdit && (
                            <>
                                <button
                                    className="icon-btn edit-btn"
                                    title="Edit project"
                                    onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    className="icon-btn deactivate-btn"
                                    title="Deactivate project"
                                    onClick={(e) => { e.stopPropagation(); onDeactivate(project); }}
                                >
                                    <PauseCircle size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {project.description && (
                    <div className="project-card-description">{project.description}</div>
                )}

                <div className="project-card-badges">
                    <StatusBadge status={project.status} />
                    <PriorityBadge priority={project.priority} />
                </div>

                <div className="project-card-footer">
                    <div className="project-card-teams">
                        {project.projectTeams?.slice(0, 3).map((pt) => (
                            <span key={pt.id} className="badge-team">{pt.team?.name}</span>
                        ))}
                        {(project.projectTeams?.length ?? 0) > 3 && (
                            <span className="badge-team">+{project.projectTeams.length - 3}</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {project.dueDate && (
                            <div className={`project-card-due ${over ? 'overdue' : ''}`}>
                                <Calendar size={11} />
                                {fmtDate(project.dueDate)}
                            </div>
                        )}
                        <div className="project-card-task-count">
                            <SquareCheckBig size={11} />
                            {project._count?.tasks ?? 0} task{project._count?.tasks !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded content - only visible when card is expanded */}
            {expanded && fullDetail && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">

                        {/* Title + description */}
                        <div style={{ marginBottom: '0.25rem' }}>
                            <h2 className="project-card-title" style={{ marginBottom: '0.35rem' }}>
                                {fullDetail.title}
                            </h2>
                            {fullDetail.description && (
                                <div className="expanded-description" style={{ marginTop: '0.4rem' }}>
                                    {fullDetail.description}
                                </div>
                            )}
                        </div>

                        {/* ── Section 1: Details ── */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">Details</div>
                            {/* Row 1: category · type · status · priority */}
                            <div className="exp-badges-row">
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Category</span>
                                    <span className="exp-badges-value">
                                        {fullDetail.projectType?.category ? (
                                            <span className={`badge ${getCategoryClass(fullDetail.projectType.category)}`}>
                                                {fullDetail.projectType.category}
                                            </span>
                                        ) : '—'}
                                    </span>
                                </div>
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Type</span>
                                    <span className="exp-badges-value">{fullDetail.projectType ? (
                                        <span className="badge badge-type">
                                            {fullDetail.projectType.name}
                                        </span>
                                    ) : '—'}</span>
                                </div>
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Status</span>
                                    <span className="exp-badges-value"><StatusBadge status={fullDetail.status} /></span>
                                </div>
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Priority</span>
                                    <span className="exp-badges-value"><PriorityBadge priority={fullDetail.priority} /></span>
                                </div>
                            </div>
                            {/* Row 2: created · start · due dates */}
                            <div className="exp-dates-row">
                                <div className="exp-date-item">
                                    <span className="exp-date-label">Created</span>
                                    <span className="exp-date-value">{fmtDate(fullDetail.createdAt) || '—'}</span>
                                </div>
                                <div className="exp-date-item">
                                    <span className="exp-date-label">Start</span>
                                    <span className="exp-date-value">{fmtDate(fullDetail.startDate) || '—'}</span>
                                </div>
                                <div className="exp-date-item">
                                    <span className="exp-date-label">Due</span>
                                    <span className={`exp-date-value${over ? ' overdue' : ''}`}>
                                        {fmtDate(fullDetail.dueDate) || '—'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── Section 2: Teams ── */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">Teams</div>
                            {/* Created by */}
                            <div className="exp-teams-block">
                                <span className="exp-creator-label">Created by</span>
                                <div className="exp-teams-pills">
                                    <span className="exp-creator-name">{fullDetail.createdBy?.fullName ?? '—'}</span>
                                    {ownerTeam && (
                                        <span className="badge-team">{ownerTeam.team?.name}</span>
                                    )}
                                </div>
                            </div>
                            {/* All assigned teams */}
                            {(fullDetail.projectTeams?.length ?? 0) > 0 ? (
                                <div className="exp-teams-block">
                                    <span className="exp-creator-label">Assigned Teams</span>
                                    <div className="exp-teams-pills">
                                        {fullDetail.projectTeams.map((pt) => (
                                            <span key={pt.id} className="badge-team">
                                                {pt.team?.name}
                                                {pt.isOwner ? ' ★' : ''}
                                                {!pt.canEdit ? ' (view)' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>No teams assigned</span>
                            )}
                        </div>

                        {/* ── Section 3: Tasks ── */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">
                                Tasks ({fullDetail.tasks?.length ?? 0})
                            </div>
                            {fullDetail.tasks?.length ? (
                                <div className="expanded-tasks-list">
                                    {fullDetail.tasks.map((task) => (
                                        <ExpandedTaskRow key={task.id} task={task} />
                                    ))}
                                </div>
                            ) : (
                                <div className="exp-tasks-placeholder">No tasks yet</div>
                            )}
                        </div>

                        {/* Actions */}
                        {canEdit && (
                            <div className="expanded-actions">
                                <button
                                    className="icon-btn edit-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onEdit(fullDetail); }}
                                >
                                    <Pencil size={13} />
                                    Edit Project
                                </button>
                                <button
                                    className="icon-btn deactivate-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onDeactivate(fullDetail); }}
                                >
                                    <PauseCircle size={13} />
                                    Deactivate
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────
export default function ProjectsPage() {
    const { user } = useAuth();

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [allTeams, setAllTeams] = useState([]);
    const [allMembers, setAllMembers] = useState([]);

    // Filters
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    // Expanded card state
    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [expandedProjectDetail, setExpandedProjectDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [deactivatingProject, setDeactivatingProject] = useState(null);

    // ── Load all supporting data ──
    useEffect(() => {
        Promise.all([
            teamsAPI.getAll(undefined, 'all').catch(() => []),
            membersAPI.getAll(true).catch(() => []),
        ]).then(([teams, members]) => {
            setAllTeams(Array.isArray(teams) ? teams : []);
            setAllMembers(Array.isArray(members) ? members : []);
        });
    }, []);

    // ── Load projects ──
    const loadProjects = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await projectsAPI.getAll({
                status: filterStatus || undefined,
                priority: filterPriority || undefined,
            });
            // Sort by priority then createdAt
            data.sort((a, b) =>
                (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99) ||
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            setProjects(data);
        } catch (err) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterPriority]);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    // ── Handle card expansion ──
    const handleToggleExpand = async (project) => {
        if (!project) {
            // Close expanded card
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
            return;
        }

        if (expandedProjectId === project.id) {
            // Already expanded, close it
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
            return;
        }

        // Expand new card
        setExpandedProjectId(project.id);
        setDetailLoading(true);
        try {
            const detail = await projectsAPI.getById(project.id);
            setExpandedProjectDetail(detail);
        } catch {
            setExpandedProjectDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    // ── After saving ──
    const handleProjectSaved = (saved) => {
        setProjects((prev) => {
            const idx = prev.findIndex((p) => p.id === saved.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...prev[idx], ...saved };
                return next;
            }
            return [saved, ...prev];
        });
        // If the expanded card is this project, refresh it
        if (expandedProjectId === saved.id) {
            projectsAPI.getById(saved.id).then(setExpandedProjectDetail).catch(() => { });
        }
    };

    const handleProjectDeactivated = (id) => {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (expandedProjectId === id) {
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
        }
    };

    // ── Permission helpers ──
    const isAdminUser = user?.isDeveloper || user?.isAdmin;

    const canEditProject = (project) => {
        if (isAdminUser) return true;
        if (!user?.id) return false;
        if (project.createdByMemberId === user.id) return true;
        return (project.projectTeams ?? []).some(
            (pt) => pt.canEdit && (user.teamIds ?? []).includes(pt.teamId)
        );
    };

    return (
        <div className="projects-page">
            {/* ─── Header ─── */}
            <div className="page-header">
                <h1 className="projects-title">Projects</h1>
                <div className="page-header-actions">
                    <FilterDropdown
                        triggerLabel="Status"
                        options={[
                            { value: '', label: 'All Statuses' },
                            ...PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
                        ]}
                        value={filterStatus}
                        onChange={setFilterStatus}
                    />
                    <FilterDropdown
                        triggerLabel="Priority"
                        options={[
                            { value: '', label: 'All Priorities' },
                            ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
                        ]}
                        value={filterPriority}
                        onChange={setFilterPriority}
                    />
                </div>
            </div>
            <hr className="title-divider" />

            {/* ─── Content ─── */}
            {loading ? (
                <div className="projects-loading">Loading projects…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : projects.length === 0 ? (
                <div className="empty-state">
                    <CheckSquare className="empty-state-icon" />
                    <h4 className="empty-state-title">No projects yet</h4>
                    <p className="empty-state-text">Create your first project to get started.</p>
                    <button className="empty-state-btn" onClick={() => setShowCreateModal(true)}>
                        <Plus />
                        New Project
                    </button>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.map((p) => (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            expanded={expandedProjectId === p.id}
                            fullDetail={expandedProjectId === p.id ? expandedProjectDetail : null}
                            onToggle={handleToggleExpand}
                            onEdit={(proj) => setEditingProject(proj)}
                            onDeactivate={(proj) => setDeactivatingProject(proj)}
                            canEdit={canEditProject(p)}
                        />
                    ))}
                </div>
            )}

            {/* ─── Loading indicator for expanded card ─── */}
            {expandedProjectId && detailLoading && !expandedProjectDetail && (
                <div style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 1rem',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--gray-500)'
                }}>
                    Loading details…
                </div>
            )}

            {/* ─── Create Modal ─── */}
            {showCreateModal && (
                <CreateProjectModal
                    mode="create"
                    allTeams={allTeams}
                    onClose={() => setShowCreateModal(false)}
                    onSaved={handleProjectSaved}
                />
            )}

            {/* ─── Edit Modal ─── */}
            {editingProject && (
                <CreateProjectModal
                    mode="edit"
                    initial={editingProject}
                    allTeams={allTeams}
                    onClose={() => setEditingProject(null)}
                    onSaved={handleProjectSaved}
                />
            )}

            {/* ─── Deactivate Confirm ─── */}
            {deactivatingProject && (
                <DeactivateProjectModal
                    project={deactivatingProject}
                    onClose={() => setDeactivatingProject(null)}
                    onConfirmed={handleProjectDeactivated}
                />
            )}
        </div>
    );
}