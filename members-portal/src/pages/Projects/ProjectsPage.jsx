import { useState, useEffect, useCallback, useMemo } from 'react';
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
    CheckCircle,
    Archive,
    PlayCircle,
    History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, tasksAPI, teamsAPI, membersAPI, phasesAPI, projectTypesAPI, projectFilesAPI, getProfilePhotoUrl } from '../../services/api';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import Dropdown from '../../components/dropdown/dropdown';
import './ProjectsPage.css';
import {
    fmtDate,
    PriorityBadge,
    ProjectCardView,
    StatusBadge,
    getLifecycleBadge,
    isProjectAborted,
    isProjectInactive,
} from './components/ProjectCardView/ProjectCardView';

import CreateProjectModal from './modals/CreateProjectModal';
import HoldProjectModal from './modals/HoldProjectModal';
import AbortProjectModal from './modals/AbortProjectModal';
import FinalizeProjectModal from './modals/FinalizeProjectModal';
import ArchiveProjectModal from './modals/ArchiveProjectModal';
import ReactivateProjectModal from './modals/ReactivateProjectModal';
import AddPhaseModal from './modals/AddPhaseModal';
import AddTaskModal from './modals/AddTaskModal';
import EditTaskModal from './modals/EditTaskModal';
import TaskCommentsModal from './modals/TaskCommentsModal';
import TaskScheduleSlotsModal from './modals/TaskScheduleSlotsModal';
import TaskActivityModal from './modals/TaskActivityModal';
import EditPhaseModal from './modals/EditPhaseModal';
import DeletePhaseTaskModal from './modals/DeletePhaseTaskModal';
import ProjectActivityModal from './modals/ProjectActivityModal';
import GanttChart from './components/GanttChart/GanttChart';

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

function isOverdue(dueDate, status) {
    if (!dueDate || status === 'COMPLETED' || status === 'CANCELLED') return false;
    return new Date(dueDate) < new Date();
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
function ProjectCard({ project, expanded, fullDetail, detailLoading, onToggle, onEdit, onDeactivate, onFinalize, onArchive, onReactivate, onAbort, onPublish, onRefreshDetail, onViewActivity, allMembers, canEdit, canManage, canUpload, canEditStructure, canEditStatus }) {
    const { user } = useAuth();

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
    const [projectFolders, setProjectFolders] = useState([]);
    useEffect(() => {
        if (expanded && localDetail?.id) {
            projectFilesAPI.getAll(localDetail.id).then(setProjectFiles).catch(() => setProjectFiles([]));
            projectFilesAPI.getFolders(localDetail.id, true).then(setProjectFolders).catch(() => setProjectFolders([]));
        }
    }, [expanded, localDetail?.id]);

    // Phase/task management state (inline in card)
    const [showAddPhase, setShowAddPhase] = useState(false);
    const [addTaskTarget, setAddTaskTarget] = useState(null); // { phaseId, parentTask? }
    const [editTaskTarget, setEditTaskTarget] = useState(null); // task object to edit
    const [taskCommentsTarget, setTaskCommentsTarget] = useState(null);
    const [taskScheduleTarget, setTaskScheduleTarget] = useState(null);
    const [taskActivityTarget, setTaskActivityTarget] = useState(null);
    const [editPhaseTarget, setEditPhaseTarget] = useState(null); // phase object to edit
    const [confirmDeletePhase, setConfirmDeletePhase] = useState(null); // phase object to delete

    // Use localDetail for rendering instead of fullDetail
    const detail = localDetail;
    const aborted = isProjectAborted(project);
    const inactive = isProjectInactive(project);
    const lifecycleBadge = getLifecycleBadge(project);
    const LifecycleIcon = lifecycleBadge.icon;

    return (
        <ProjectCardView
            project={project}
            expanded={expanded}
            detail={detail}
            detailLoading={detailLoading}
            onToggle={onToggle}
            collapsedMeta={(
                <>
                    <span className={`badge ${lifecycleBadge.className}`} title={lifecycleBadge.title}>
                        <LifecycleIcon size={12} />
                        {lifecycleBadge.label}
                    </span>
                    {project.isFinalized && canManage && (
                        <button
                            className="icon-btn archive-btn"
                            title="Archive project"
                            onClick={(e) => { e.stopPropagation(); onArchive(project); }}
                        >
                            <Archive size={14} />
                        </button>
                    )}
                    {canEdit && !project.isFinalized && project.isActive && project.status !== 'CANCELLED' && (
                        <>
                            <button
                                className="icon-btn edit-btn"
                                title="Edit project"
                                onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                className="icon-btn hold-btn"
                                title="Hold project"
                                onClick={(e) => { e.stopPropagation(); onDeactivate(project); }}
                            >
                                <PauseCircle size={14} />
                            </button>
                            <button
                                className="icon-btn deactivate-btn"
                                title="Abort project"
                                onClick={(e) => { e.stopPropagation(); onAbort(project); }}
                            >
                                <AlertCircle size={14} />
                            </button>
                            <button
                                className="icon-btn finalize-btn"
                                title="Finalize project"
                                onClick={(e) => { e.stopPropagation(); onFinalize(project); }}
                            >
                                <CheckSquare size={14} />
                            </button>
                        </>
                    )}
                    {canManage && inactive && (
                        <>
                            <button
                                className="icon-btn reactivate-btn"
                                title="Reactivate project"
                                onClick={(e) => { e.stopPropagation(); onReactivate(project); }}
                            >
                                <PlayCircle size={14} />
                            </button>
                            <button
                                className="icon-btn deactivate-btn"
                                title="Abort project"
                                onClick={(e) => { e.stopPropagation(); onAbort(project); }}
                            >
                                <AlertCircle size={14} />
                            </button>
                            <button
                                className="icon-btn finalize-btn"
                                title="Finalize project"
                                onClick={(e) => { e.stopPropagation(); onFinalize(project); }}
                            >
                                <CheckSquare size={14} />
                            </button>
                        </>
                    )}
                    {canManage && aborted && !project.isArchived && (
                        <button
                            className="icon-btn archive-btn"
                            title="Archive project"
                            onClick={(e) => { e.stopPropagation(); onArchive(project); }}
                        >
                            <Archive size={14} />
                        </button>
                    )}
                    <button
                        className="icon-btn activity-btn"
                        title="View activity"
                        onClick={(e) => { e.stopPropagation(); onViewActivity(project); }}
                    >
                        <History size={14} />
                    </button>
                </>
            )}
            collapsedFooterTrailing={(
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="project-card-due project-card-date-range">
                        <Calendar size={11} />
                        {fmtDate(project.startDate)} → {fmtDate(project.dueDate)}
                    </div>
                    <div className="project-card-task-count">
                        <SquareCheckBig size={11} />
                        {project._count?.tasks ?? 0} task{project._count?.tasks !== 1 ? 's' : ''}
                        {' · '}
                        {project._count?.phases ?? 0} phase{project._count?.phases !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
            expandedMeta={(
                <span className={`badge ${lifecycleBadge.className}`} style={{ fontSize: '0.82rem' }}>
                    <LifecycleIcon size={14} />
                    {lifecycleBadge.label}
                </span>
            )}
            expandedActions={detail ? (
                <>
                    {detail.isFinalized ? (
                        canManage && (
                            <div className="expanded-title-actions">
                                <button
                                    className="icon-btn archive-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onArchive(detail); }}
                                >
                                    <Archive size={13} />
                                    Archive
                                </button>
                            </div>
                        )
                    ) : detail.status === 'CANCELLED' ? (
                        canManage && !detail.isArchived && (
                            <div className="expanded-title-actions">
                                <button
                                    className="icon-btn archive-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onArchive(detail); }}
                                >
                                    <Archive size={13} />
                                    Archive
                                </button>
                            </div>
                        )
                    ) : detail.isActive === false ? (
                        canManage && !detail.isArchived && (
                            <div className="expanded-title-actions">
                                <button
                                    className="icon-btn reactivate-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onReactivate(detail); }}
                                >
                                    <PlayCircle size={13} />
                                    Reactivate
                                </button>
                                <button
                                    className="icon-btn deactivate-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onAbort(detail); }}
                                >
                                    <AlertCircle size={13} />
                                    Abort
                                </button>
                                <button
                                    className="icon-btn finalize-btn icon-btn--text"
                                    onClick={(e) => { e.stopPropagation(); onFinalize(detail); }}
                                >
                                    <CheckSquare size={13} />
                                    Finalize
                                </button>
                            </div>
                        )
                    ) : canEdit && (
                        <div className="expanded-title-actions">
                            <button
                                className="icon-btn edit-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onEdit(detail); }}
                            >
                                <Pencil size={13} />
                                Edit Project
                            </button>
                            <button
                                className="icon-btn hold-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onDeactivate(detail); }}
                            >
                                <PauseCircle size={13} />
                                Hold
                            </button>
                            <button
                                className="icon-btn deactivate-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onAbort(detail); }}
                            >
                                <AlertCircle size={13} />
                                Abort
                            </button>
                            <button
                                className="icon-btn finalize-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onFinalize(detail); }}
                            >
                                <CheckSquare size={13} />
                                Finalize
                            </button>
                        </div>
                    )}
                    {onViewActivity && (
                        <div className="expanded-title-actions">
                            <button
                                className="icon-btn activity-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onViewActivity(detail); }}
                            >
                                <History size={13} />
                                View activity
                            </button>
                        </div>
                    )}
                </>
            ) : null}
            teamEmptyMessage="No teams assigned"
            formatAssignedTeamSuffix={(pt) => `${pt.isOwner ? ' ★' : ''}${!pt.canEdit ? ' (view)' : ''}`}
            afterSections={detail ? (
                <>
                    <div className="exp-card-section" style={{ padding: 0 }}>
                        <GanttChart
                            phases={detail.phases || []}
                            projectId={detail.id}
                            projectDetail={detail}
                            projectStartDate={detail.startDate}
                            projectDueDate={detail.dueDate}
                            canEdit={canEditStructure}
                            canEditStatus={canEditStatus}
                            onAddPhase={() => setShowAddPhase(true)}
                            onAddTask={(phase) => setAddTaskTarget({ phaseId: phase.id })}
                            onAddSubtask={(phase, parentTask) => setAddTaskTarget({ phaseId: phase.id, parentTask })}
                            onEditPhase={(phase) => setEditPhaseTarget(phase)}
                            onEditTask={(task) => setEditTaskTarget(task)}
                            onOpenTaskComments={(task) => setTaskCommentsTarget(task)}
                            onOpenTaskScheduleSlots={(task) => setTaskScheduleTarget(task)}
                            onOpenTaskActivity={(task) => setTaskActivityTarget(task)}
                            onDeletePhase={(phase) => setConfirmDeletePhase(phase)}
                            onRefresh={() => onRefreshDetail(detail.id)}
                        />
                    </div>

                    <div className="exp-card-section">
                        <div className="exp-card-section-header">
                            <Paperclip size={14} style={{ marginRight: '0.35rem' }} />
                            Project Files
                        </div>
                        <FileUploadZone
                            projectId={detail.id}
                            memberId={user?.id}
                            existingFiles={projectFiles}
                            existingFolders={projectFolders}
                            onFileUploaded={(newFile, replaced) => setProjectFiles((prev) =>
                                replaced
                                    ? prev.map((f) => f.id === newFile.id ? newFile : f)
                                    : [newFile, ...prev]
                            )}
                            onFileRemoved={(fileId) => setProjectFiles((prev) => prev.filter((f) => f.id !== fileId))}
                            onFileRenamed={(updated) => setProjectFiles((prev) =>
                                prev.map((f) => f.id === updated.id ? { ...f, fileName: updated.fileName } : f)
                            )}
                            disabled={!canUpload}
                        />
                    </div>

                    {editPhaseTarget && (
                        <EditPhaseModal
                            phase={editPhaseTarget}
                            onClose={() => setEditPhaseTarget(null)}
                            onPhaseUpdated={() => { setEditPhaseTarget(null); onRefreshDetail(detail.id); }}
                        />
                    )}

                    {confirmDeletePhase && (
                        <DeletePhaseTaskModal
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

                    {showAddPhase && (
                        <AddPhaseModal
                            projectId={detail.id}
                            existingPhasesCount={detail.phases?.length ?? 0}
                            onClose={() => setShowAddPhase(false)}
                            onPhaseCreated={() => { setShowAddPhase(false); onRefreshDetail(detail.id); }}
                        />
                    )}

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

                    {editTaskTarget && (
                        <EditTaskModal
                            task={editTaskTarget}
                            projectDetail={detail}
                            allMembers={allMembers}
                            onClose={() => setEditTaskTarget(null)}
                            onTaskUpdated={() => { setEditTaskTarget(null); onRefreshDetail(detail.id); }}
                        />
                    )}

                    {taskCommentsTarget && (
                        <TaskCommentsModal
                            task={taskCommentsTarget}
                            onClose={() => setTaskCommentsTarget(null)}
                        />
                    )}

                    {taskScheduleTarget && (
                        <TaskScheduleSlotsModal
                            task={taskScheduleTarget}
                            allMembers={allMembers}
                            onClose={() => setTaskScheduleTarget(null)}
                        />
                    )}

                    {taskActivityTarget && (
                        <TaskActivityModal
                            task={taskActivityTarget}
                            onClose={() => setTaskActivityTarget(null)}
                        />
                    )}
                </>
            ) : null}
        />
    );
}

// ─────────────────────────────────────────────────────────
//  Pagination helper – produces [1, 2, '...', 5, 6, 7, '...', 10] style array
// ─────────────────────────────────────────────────────────
function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
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

    // Pagination
    const PROJECTS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    // Expanded card state
    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [expandedProjectDetail, setExpandedProjectDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [holdingProject, setHoldingProject] = useState(null);
    const [finalizingProject, setFinalizingProject] = useState(null);
    const [archivingProject, setArchivingProject] = useState(null);
    const [reactivatingProject, setReactivatingProject] = useState(null);
    const [abortingProject, setAbortingProject] = useState(null);
    const [publishingProject, setPublishingProject] = useState(null);
    const [activityProject, setActivityProject] = useState(null);

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
            const [activeData, inactiveData] = await Promise.all([
                projectsAPI.getAll({
                    teamId: filterTeam || undefined,
                    priority: filterPriority || undefined,
                }),
                projectsAPI.getAll({
                    isActive: false,
                    teamId: filterTeam || undefined,
                    priority: filterPriority || undefined,
                }),
            ]);

            const data = [...activeData, ...inactiveData].reduce((acc, item) => {
                if (!acc.some((p) => p.id === item.id)) acc.push(item);
                return acc;
            }, []);
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

    // Reset to page 1 when filters change
    useEffect(() => { setCurrentPage(1); }, [filterTeam, filterCategory, filterPriority]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(projects.length / PROJECTS_PER_PAGE));
    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * PROJECTS_PER_PAGE;
        return projects.slice(start, start + PROJECTS_PER_PAGE);
    }, [projects, currentPage]);

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
        // Optimistic local update
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
        // Re-fetch from server so state stays in sync across navigations
        loadProjects();
    };

    const handleProjectHeld = () => {
        handleProjectLifecycleChanged();
    };

    const handleProjectLifecycleChanged = () => {
        loadProjects();
        if (expandedProjectId) {
            projectsAPI.getById(expandedProjectId).then(setExpandedProjectDetail).catch(() => { });
        }
    };

    const handleProjectFinalized = () => {
        loadProjects();
        if (expandedProjectId) {
            projectsAPI.getById(expandedProjectId).then(setExpandedProjectDetail).catch(() => { });
        }
    };

    const handleProjectArchived = () => {
        loadProjects();
        if (expandedProjectId) {
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
        }
    };

    // ── Refresh expanded detail (after phase/task changes) ──
    // Preserves task order within each phase to fix the bug where
    // editing a task causes it to jump to the top of the list.
    const handleRefreshDetail = async (projectId) => {
        try {
            const detail = await projectsAPI.getById(projectId);
            setExpandedProjectDetail(detail);
        } catch { /* swallow */ }
    };

    // ── Permission helpers ──
    // Privileged roles: developer, officer, admin, leadership
    const isPrivileged = user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership;
    // Privileged + special roles can manage phases/tasks
    const isPrivilegedOrSpecial = isPrivileged || user?.isSpecial;
    // Only privileged roles can create/edit/manage projects
    const canCreateProject = isPrivileged;

    const canEditProject = (project) => isPrivileged && !!project?.isActive && !project?.isFinalized && project?.status !== 'CANCELLED';

    // canManageProject: finalize, archive, hold, abort, publish, reactivate (NOT blocked by finalized)
    const canManageProject = () => isPrivileged;

    // Can the user upload files? Any team member or privileged user
    const canUploadToProject = (project) => {
        if (isPrivileged) return true;
        if (!user?.id) return false;
        return (project.projectTeams ?? []).some(
            (pt) => (user.teamIds ?? []).includes(pt.teamId)
        );
    };

    // Filter allMembers to only those in the project's teams
    const getProjectMembers = (project) => {
        if (!project?.projectTeams?.length) return allMembers;
        const projectTeamIds = new Set(project.projectTeams.map((pt) => pt.teamId));
        return allMembers.filter((m) =>
            m.teamMemberships?.some((tm) => tm.isActive && projectTeamIds.has(tm.teamId))
        );
    };

    return (
        <div className="projects-page">
            {/* ─── Header ─── */}
            <div className="page-header">
                <h1 className="projects-title">Projects</h1>
                <div className="page-header-actions">
                    <Dropdown
                        triggerLabel="Team"
                        options={[
                            { value: '', label: 'All Teams' },
                            ...allTeams.map((t) => ({ value: String(t.id), label: t.name })),
                        ]}
                        value={filterTeam}
                        onChange={setFilterTeam}
                    />
                    <Dropdown
                        triggerLabel="Category"
                        options={[
                            { value: '', label: 'All Categories' },
                            ...allCategories.map((c) => ({ value: c, label: c })),
                        ]}
                        value={filterCategory}
                        onChange={setFilterCategory}
                    />
                    <Dropdown
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
                <>
                    <div className="projects-grid">
                        {paginatedProjects.map((p) => (
                            <ProjectCard
                                key={p.id}
                                project={p}
                                expanded={expandedProjectId === p.id}
                                fullDetail={expandedProjectId === p.id ? expandedProjectDetail : null}
                                detailLoading={expandedProjectId === p.id && detailLoading}
                                onToggle={handleToggleExpand}
                                onEdit={(proj) => setEditingProject(proj)}
                                onDeactivate={(proj) => setHoldingProject(proj)}
                                onFinalize={(proj) => setFinalizingProject(proj)}
                                onArchive={(proj) => setArchivingProject(proj)}
                                onRefreshDetail={handleRefreshDetail}
                                allMembers={getProjectMembers(p)}
                                canEdit={canEditProject(p)}
                                canManage={canManageProject()}
                                canUpload={canUploadToProject(p)}
                                canEditStructure={isPrivilegedOrSpecial && p.isActive && !p.isFinalized && p.status !== 'CANCELLED'}
                                canEditStatus={isPrivilegedOrSpecial}
                                onReactivate={(proj) => setReactivatingProject(proj)}
                                onAbort={(proj) => setAbortingProject(proj)}
                                onPublish={(proj) => setPublishingProject(proj)}
                                onViewActivity={(proj) => setActivityProject(proj)}
                            />
                        ))}
                        {canCreateProject && currentPage === 1 && (
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
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="pagination-btn"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <div className="pagination-pages">
                                {getPageNumbers(currentPage, totalPages).map((p, i) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            className={`pagination-page-btn${p === currentPage ? ' pagination-page-btn--active' : ''}`}
                                            onClick={() => setCurrentPage(p)}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                            </div>
                            <button
                                className="pagination-btn"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {reactivatingProject && (
                <ReactivateProjectModal
                    project={reactivatingProject}
                    onClose={() => setReactivatingProject(null)}
                    onReactivated={handleProjectLifecycleChanged}
                />
            )}

            {abortingProject && (
                <AbortProjectModal
                    project={abortingProject}
                    onClose={() => setAbortingProject(null)}
                    onAborted={() => {
                        setAbortingProject(null);
                        handleProjectLifecycleChanged();
                    }}
                />
            )}

            {/* Publish is intentionally hidden for now.
            {publishingProject && (
                <PublishProjectModal ... />
            )}
            */}

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
                    userTeamIds={user.teamIds ?? []}
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
                    userTeamIds={user.teamIds ?? []}
                    onClose={() => setEditingProject(null)}
                    onSaved={handleProjectSaved}
                />
            )}

            {/* ─── Hold Confirm ─── */}
            {holdingProject && (
                <HoldProjectModal
                    project={holdingProject}
                    onClose={() => setHoldingProject(null)}
                    onHeld={handleProjectHeld}
                />
            )}

            {/* ─── Finalize Confirm ─── */}
            {finalizingProject && (
                <FinalizeProjectModal
                    project={finalizingProject}
                    onClose={() => setFinalizingProject(null)}
                    onFinalized={handleProjectFinalized}
                />
            )}

            {/* ─── Archive Confirm ─── */}
            {archivingProject && (
                <ArchiveProjectModal
                    project={archivingProject}
                    onClose={() => setArchivingProject(null)}
                    onArchived={handleProjectArchived}
                />
            )}

            {activityProject && (
                <ProjectActivityModal
                    project={activityProject}
                    onClose={() => setActivityProject(null)}
                />
            )}

        </div>
    );
}