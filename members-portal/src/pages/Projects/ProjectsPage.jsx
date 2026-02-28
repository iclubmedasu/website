import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus,
    X,
    ChevronDown,
    ChevronRight,
    Calendar,
    CheckSquare,
    AlertCircle,
    Pencil,
    PauseCircle,
    SquareCheckBig,
    Paperclip,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, tasksAPI, teamsAPI, membersAPI, phasesAPI, projectTypesAPI, projectFilesAPI, getProfilePhotoUrl } from '../../services/api';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import './ProjectsPage.css';

import CreateProjectModal from './modals/CreateProjectModal';
import DeactivateProjectModal from './modals/DeactivateProjectModal';
import AddPhaseModal from './modals/AddPhaseModal';
import AddTaskModal from './modals/AddTaskModal';
import EditTaskModal from './modals/EditTaskModal';
import EditPhaseModal from './modals/EditPhaseModal';
import ConfirmModal from './modals/ConfirmModal';
import PhaseRow from './components/PhaseRow';

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
                        <span key={a.id} className="assignee-chip">
                            {a.member?.profilePhotoUrl ? (
                                <img src={getProfilePhotoUrl(a.member.id)} alt="" className="assignee-chip-avatar" />
                            ) : (
                                <span className="assignee-chip-initial">{(a.member?.fullName ?? '?').charAt(0).toUpperCase()}</span>
                            )}
                            {a.member?.fullName ?? '—'}
                        </span>
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
//  Project Card with Expandable Detail
// ─────────────────────────────────────────────────────────
function ProjectCard({ project, expanded, fullDetail, onToggle, onEdit, onDeactivate, onRefreshDetail, allMembers, canEdit }) {
    const { user } = useAuth();
    const over = isOverdue(project.dueDate, project.status);
    const ownerTeam = fullDetail?.projectTeams?.find((pt) => pt.isOwner) ?? null;
    const otherTeams = fullDetail?.projectTeams?.filter((pt) => !pt.isOwner) ?? [];

    // Local copy of detail for optimistic inline updates (avoids full refresh & scroll reset)
    const [localDetail, setLocalDetail] = useState(fullDetail);
    useEffect(() => { setLocalDetail(fullDetail); }, [fullDetail]);

    // Optimistic in-place update for inline field changes (status/priority/difficulty)
    const handleTaskFieldUpdate = useCallback((phaseId, taskId, field, value) => {
        if (field === '__delete') {
            // Structural change — need real refresh
            onRefreshDetail(localDetail?.id);
            return;
        }
        setLocalDetail((prev) => {
            if (!prev?.phases) return prev;
            return {
                ...prev,
                phases: prev.phases.map((phase) => {
                    if (phase.id !== phaseId) return phase;
                    return {
                        ...phase,
                        tasks: (phase.tasks || []).map((task) => {
                            if (task.id === taskId) return { ...task, [field]: value };
                            // Check subtasks
                            if (task.subtasks?.length) {
                                return {
                                    ...task,
                                    subtasks: task.subtasks.map((s) =>
                                        s.id === taskId ? { ...s, [field]: value } : s
                                    ),
                                };
                            }
                            return task;
                        }),
                    };
                }),
            };
        });
    }, [localDetail?.id, onRefreshDetail]);

    // Project files state
    const [projectFiles, setProjectFiles] = useState([]);
    useEffect(() => {
        if (expanded && localDetail?.id) {
            projectFilesAPI.getAll(localDetail.id).then(setProjectFiles).catch(() => setProjectFiles([]));
        }
    }, [expanded, localDetail?.id]);

    // Phase/task management state (inline in card)
    const [showAddPhase, setShowAddPhase] = useState(false);
    const [addTaskTarget, setAddTaskTarget] = useState(null); // { phaseId, parentTask? }
    const [editTaskTarget, setEditTaskTarget] = useState(null); // task object to edit
    const [editPhaseTarget, setEditPhaseTarget] = useState(null); // phase object to edit
    const [confirmDeletePhase, setConfirmDeletePhase] = useState(null); // phase object to delete

    // Use localDetail for rendering instead of fullDetail
    const detail = localDetail;

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
                            {' · '}
                            {project._count?.phases ?? 0} phase{project._count?.phases !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded content - only visible when card is expanded */}
            {expanded && detail && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">

                        {/* Title row + action buttons */}
                        <div style={{ marginBottom: '0.25rem' }}>
                            <div className="expanded-title-row">
                                <h2 className="project-card-title" style={{ marginBottom: 0 }}>
                                    {detail.title}
                                </h2>
                                {canEdit && (
                                    <div className="expanded-title-actions">
                                        <button
                                            className="icon-btn edit-btn icon-btn--text"
                                            onClick={(e) => { e.stopPropagation(); onEdit(detail); }}
                                        >
                                            <Pencil size={13} />
                                            Edit Project
                                        </button>
                                        <button
                                            className="icon-btn deactivate-btn icon-btn--text"
                                            onClick={(e) => { e.stopPropagation(); onDeactivate(detail); }}
                                        >
                                            <PauseCircle size={13} />
                                            Deactivate
                                        </button>
                                    </div>
                                )}
                            </div>
                            {detail.description && (
                                <div className="expanded-description" style={{ marginTop: '0.4rem' }}>
                                    {detail.description}
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
                                        {detail.projectType?.category ? (
                                            <span className={`badge ${getCategoryClass(detail.projectType.category)}`}>
                                                {detail.projectType.category}
                                            </span>
                                        ) : '—'}
                                    </span>
                                </div>
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Type</span>
                                    <span className="exp-badges-value">{detail.projectType ? (
                                        <span className="badge badge-type">
                                            {detail.projectType.name}
                                        </span>
                                    ) : '—'}</span>
                                </div>
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Status</span>
                                    <span className="exp-badges-value"><StatusBadge status={detail.status} /></span>
                                </div>
                                <div className="exp-badges-item">
                                    <span className="exp-badges-label">Priority</span>
                                    <span className="exp-badges-value"><PriorityBadge priority={detail.priority} /></span>
                                </div>
                            </div>
                            {/* Row 2: created · start · due dates */}
                            <div className="exp-dates-row">
                                <div className="exp-date-item">
                                    <span className="exp-date-label">Created</span>
                                    <span className="exp-date-value">{fmtDate(detail.createdAt) || '—'}</span>
                                </div>
                                <div className="exp-date-item">
                                    <span className="exp-date-label">Start</span>
                                    <span className="exp-date-value">{fmtDate(detail.startDate) || '—'}</span>
                                </div>
                                <div className="exp-date-item">
                                    <span className="exp-date-label">Due</span>
                                    <span className={`exp-date-value${over ? ' overdue' : ''}`}>
                                        {fmtDate(detail.dueDate) || '—'}
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
                                    <span className="exp-creator-name">{detail.createdBy?.fullName ?? '—'}</span>
                                    {ownerTeam && (
                                        <span className="badge-team">{ownerTeam.team?.name}</span>
                                    )}
                                </div>
                            </div>
                            {/* All assigned teams */}
                            {(detail.projectTeams?.length ?? 0) > 0 ? (
                                <div className="exp-teams-block">
                                    <span className="exp-creator-label">Assigned Teams</span>
                                    <div className="exp-teams-pills">
                                        {detail.projectTeams.map((pt) => (
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

                        {/* ── Section 3: Phases & Tasks (interactive) ── */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">
                                Phases ({detail.phases?.length ?? 0})
                            </div>

                            <div className="phase-list" style={{ marginTop: '0.5rem' }}>
                                {detail.phases?.map((phase) => (
                                    <PhaseRow
                                        key={phase.id}
                                        phase={phase}
                                        canEdit={canEdit}
                                        allMembers={allMembers}
                                        onPhaseUpdated={() => onRefreshDetail(detail.id)}
                                        onTaskUpdated={handleTaskFieldUpdate}
                                        onAddTask={(p) => setAddTaskTarget({ phaseId: p.id })}
                                        onAddSubtask={(p, parentTask) => setAddTaskTarget({ phaseId: p.id, parentTask })}
                                        onEditTask={(task) => setEditTaskTarget(task)}
                                        onEditPhase={(p) => setEditPhaseTarget(p)}
                                        onDeletePhase={(p) => setConfirmDeletePhase(p)}
                                    />
                                ))}
                                {canEdit && (
                                    <div
                                        className="phase-add-row"
                                        onClick={(e) => { e.stopPropagation(); setShowAddPhase(true); }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && setShowAddPhase(true)}
                                    >
                                        <Plus size={15} />
                                        <span>Add Phase</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Section 4: Project Files ── */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">
                                <Paperclip size={14} style={{ marginRight: '0.35rem' }} />
                                Project Files
                            </div>
                            <FileUploadZone
                                projectId={detail.id}
                                memberId={user?.id}
                                existingFiles={projectFiles}
                                onFileUploaded={(newFile, replaced) => setProjectFiles((prev) =>
                                    replaced
                                        ? prev.map((f) => f.id === newFile.id ? newFile : f)
                                        : [newFile, ...prev]
                                )}
                                onFileRemoved={(fileId) => setProjectFiles((prev) => prev.filter((f) => f.id !== fileId))}
                                disabled={!canEdit}
                            />
                        </div>



                        {/* Edit Phase Modal */}
                        {editPhaseTarget && (
                            <EditPhaseModal
                                phase={editPhaseTarget}
                                onClose={() => setEditPhaseTarget(null)}
                                onPhaseUpdated={() => { setEditPhaseTarget(null); onRefreshDetail(detail.id); }}
                            />
                        )}

                        {/* Confirm Delete Phase Modal */}
                        {confirmDeletePhase && (
                            <ConfirmModal
                                title="Delete Phase"
                                itemName={confirmDeletePhase.title}
                                message="All tasks, subtasks, and assignees in this phase will be permanently removed. This action cannot be undone."
                                confirmLabel="Delete Phase"
                                onConfirm={async () => {
                                    await phasesAPI.remove(confirmDeletePhase.id);
                                    onRefreshDetail(detail.id);
                                }}
                                onClose={() => setConfirmDeletePhase(null)}
                            />
                        )}

                        {/* Add Phase Modal */}
                        {showAddPhase && (
                            <AddPhaseModal
                                projectId={detail.id}
                                existingPhasesCount={detail.phases?.length ?? 0}
                                onClose={() => setShowAddPhase(false)}
                                onPhaseCreated={() => { setShowAddPhase(false); onRefreshDetail(detail.id); }}
                            />
                        )}

                        {/* Add Task / Subtask Modal */}
                        {addTaskTarget && (
                            <AddTaskModal
                                projectId={detail.id}
                                phaseId={addTaskTarget.phaseId}
                                parentTask={addTaskTarget.parentTask || null}
                                allMembers={allMembers}
                                onClose={() => setAddTaskTarget(null)}
                                onTaskCreated={() => { setAddTaskTarget(null); onRefreshDetail(detail.id); }}
                            />
                        )}

                        {/* Edit Task / Subtask Modal */}
                        {editTaskTarget && (
                            <EditTaskModal
                                task={editTaskTarget}
                                allMembers={allMembers}
                                onClose={() => setEditTaskTarget(null)}
                                onTaskUpdated={() => { setEditTaskTarget(null); onRefreshDetail(detail.id); }}
                            />
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
    const [allCategories, setAllCategories] = useState([]);

    // Filters
    const [filterTeam, setFilterTeam] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
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
            projectTypesAPI.getAll().catch(() => []),
        ]).then(([teams, members, types]) => {
            setAllTeams(Array.isArray(teams) ? teams : []);
            setAllMembers(Array.isArray(members) ? members : []);
            const cats = [...new Set((Array.isArray(types) ? types : []).map((t) => t.category).filter(Boolean))];
            setAllCategories(cats);
        });
    }, []);

    // ── Load projects ──
    const loadProjects = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await projectsAPI.getAll({
                teamId: filterTeam || undefined,
                priority: filterPriority || undefined,
            });
            // Client-side filter by category
            let filtered = data;
            if (filterCategory) {
                filtered = data.filter((p) => p.projectType?.category === filterCategory);
            }
            // Sort by priority then createdAt
            filtered.sort((a, b) =>
                (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99) ||
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            setProjects(filtered);
        } catch (err) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [filterTeam, filterCategory, filterPriority]);

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

    // ── Refresh expanded detail (after phase/task changes) ──
    const handleRefreshDetail = async (projectId) => {
        try {
            const detail = await projectsAPI.getById(projectId);
            setExpandedProjectDetail(detail);
        } catch { /* swallow */ }
    };

    // ── Permission helpers ──
    const canCreateProject = user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership || user?.isSpecial;

    const canEditProject = (project) => {
        if (canCreateProject) return true;
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
                        triggerLabel="Team"
                        options={[
                            { value: '', label: 'All Teams' },
                            ...allTeams.map((t) => ({ value: String(t.id), label: t.name })),
                        ]}
                        value={filterTeam}
                        onChange={setFilterTeam}
                    />
                    <FilterDropdown
                        triggerLabel="Category"
                        options={[
                            { value: '', label: 'All Categories' },
                            ...allCategories.map((c) => ({ value: c, label: c })),
                        ]}
                        value={filterCategory}
                        onChange={setFilterCategory}
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
                            onRefreshDetail={handleRefreshDetail}
                            allMembers={allMembers}
                            canEdit={canEditProject(p)}
                        />
                    ))}
                    {canCreateProject && (
                        <div
                            className="project-add-card"
                            onClick={() => setShowCreateModal(true)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setShowCreateModal(true)}
                        >
                            <Plus className="project-add-card-icon" />
                            <span className="project-add-card-text">New Project</span>
                        </div>
                    )}
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