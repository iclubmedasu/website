'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus,
    ChevronDown,
    ChevronRight,
    Calendar,
    CheckSquare,
    AlertCircle,
    Search,
    Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, tasksAPI, teamsAPI, membersAPI, projectTypesAPI, getProfilePhotoUrl } from '../../services/api';
import { buildSearchText, matchesSearchQuery } from '../../utils/search';
import './ProjectsPage.css';
import { PriorityBadge, fmtDate, StatusBadge } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import ProjectCard from './components/ProjectCard/ProjectCard';

import CreateProjectModal from './modals/CreateProjectModal';
import HoldProjectModal from './modals/HoldProjectModal';
import AbortProjectModal from './modals/AbortProjectModal';
import FinalizeProjectModal from './modals/FinalizeProjectModal';
import ArchiveProjectModal from './modals/ArchiveProjectModal';
import ReactivateProjectModal from './modals/ReactivateProjectModal';
import ProjectActivityModal from './modals/ProjectActivityModal';
import ProjectFiltersModal, { type ProjectFiltersState } from './modals/ProjectFiltersModal';
import { isDateWithinRange } from '../../utils/filterDateRange';
import type { Id } from '../../types/backend-contracts';

// ─────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────
const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED'];

function isOverdue(dueDate: any, status: any) {
    if (!dueDate || status === 'COMPLETED' || status === 'CANCELLED') return false;
    return new Date(dueDate) < new Date();
}

// ─────────────────────────────────────────────────────────
//  Inline status selector for tasks
// ─────────────────────────────────────────────────────────
function TaskStatusSelect({ taskId, current, canEdit, onChanged }: any) {
    const [busy, setBusy] = useState(false);

    const handleChange = async (e: any) => {
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
            title="Select task status"
            aria-label="Select task status"
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
function SubtaskItem({ task, canEdit, onStatusChange, depth = 0 }: any) {
    const [open, setOpen] = useState(false);
    const hasSubs = task.subtasks && task.subtasks.length > 0;
    const over = isOverdue(task.dueDate, task.status);

    return (
        <div>
            <div className="subtask-item" onClick={() => hasSubs && setOpen((o) => !o)}>
                <span className="subtask-item-title">{task.title}</span>
                <div className="subtask-item-meta-inline">
                    <TaskStatusSelect
                        taskId={task.id}
                        current={task.status}
                        canEdit={canEdit}
                        onChanged={onStatusChange}
                    />
                    {over && (
                        <span title="Overdue" className="task-overdue-indicator">
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
                <div className={`subtask-list${depth > 0 ? ' subtask-list--nested' : ''}`}>
                    {task.subtasks.map((s: any) => (
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
function TaskItem({ task, canEdit, onStatusChange, onAddSubtask }: any) {
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
                        <span title="Overdue" className="task-overdue-indicator">
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
                    {task.assignments.map((a: any) => (
                        <span key={a.id} className="assignee-chip">
                            {a.member?.profilePhotoUrl ? (
                                <img src={getProfilePhotoUrl(a.member.id) ?? undefined} alt="" className="assignee-chip-avatar" />
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
                <div className={`project-card-due project-card-due--compact ${over ? 'overdue' : ''}`}>
                    <Calendar size={11} />
                    Due {fmtDate(task.dueDate)}
                </div>
            )}

            {/* subtasks */}
            {open && hasSubs && (
                <div className="subtask-list">
                    {task.subtasks.map((s: any) => (
                        <SubtaskItem key={s.id} task={s} canEdit={canEdit} onStatusChange={onStatusChange} />
                    ))}
                </div>
            )}
        </div>
    );
}

void TaskItem;



// ─────────────────────────────────────────────────────────
//  Pagination helper – produces [1, 2, '...', 5, 6, 7, '...', 10] style array
function getPageNumbers(current: number, total: number): Array<number | '...'> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | '...'> = [];
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

    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [allTeams, setAllTeams] = useState<any[]>([]);
    const [allMembers, setAllMembers] = useState<any[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);

    // Filters
    const [filterTeam, setFilterTeam] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFiltersModal, setShowFiltersModal] = useState(false);

    // Pagination
    const PROJECTS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    // Expanded card state
    const [expandedProjectId, setExpandedProjectId] = useState<Id | null>(null);
    const [expandedProjectDetail, setExpandedProjectDetail] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [holdingProject, setHoldingProject] = useState<any>(null);
    const [finalizingProject, setFinalizingProject] = useState<any>(null);
    const [archivingProject, setArchivingProject] = useState<any>(null);
    const [reactivatingProject, setReactivatingProject] = useState<any>(null);
    const [abortingProject, setAbortingProject] = useState<any>(null);
    const [activityProject, setActivityProject] = useState<any>(null);

    // ── Load all supporting data ──
    useEffect(() => {
        Promise.all([
            teamsAPI.getAll(undefined, 'all').catch(() => []),
            membersAPI.getAll(true).catch(() => []),
            projectTypesAPI.getAll().catch(() => []),
        ]).then(([teams, members, types]) => {
            setAllTeams(Array.isArray(teams) ? teams : []);
            setAllMembers(Array.isArray(members) ? members : []);
            const cats = [...new Set((Array.isArray(types) ? types : []).map((t: any) => t.category).filter(Boolean))] as string[];
            setAllCategories(cats);
        });
    }, []);

    // ── Load projects ──
    const loadProjects = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [activeData, inactiveData] = await Promise.all([
                projectsAPI.getAll({
                    teamId: filterTeam ? Number(filterTeam) : undefined,
                    priority: (filterPriority || undefined) as any,
                    status: (filterStatus || undefined) as any,
                }),
                projectsAPI.getAll({
                    isActive: false,
                    teamId: filterTeam ? Number(filterTeam) : undefined,
                    priority: (filterPriority || undefined) as any,
                    status: (filterStatus || undefined) as any,
                }),
            ]);

            const data = [...activeData, ...inactiveData].reduce((acc: any[], item: any) => {
                if (!acc.some((p) => p.id === item.id)) acc.push(item);
                return acc;
            }, [] as any[]);
            // Client-side filter by category
            let filtered = data;
            if (filterCategory) {
                filtered = data.filter((p) => p.projectType?.category === filterCategory);
            }
            // Sort by priority then createdAt
            filtered.sort((a, b) => {
                const priorityA = PRIORITY_ORDER[(String(a.priority) as keyof typeof PRIORITY_ORDER)] ?? 99;
                const priorityB = PRIORITY_ORDER[(String(b.priority) as keyof typeof PRIORITY_ORDER)] ?? 99;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            setProjects(filtered);
        } catch (err: any) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, [filterTeam, filterCategory, filterPriority, filterStatus]);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    // Reset to page 1 when filters change
    useEffect(() => { setCurrentPage(1); }, [filterTeam, filterCategory, filterPriority, filterStatus, dateFrom, dateTo, searchQuery]);

    const filteredProjects = useMemo(() => {
        return projects.filter((project) => {
            if (!isDateWithinRange(project.dueDate, dateFrom, dateTo)) return false;
            return matchesSearchQuery(
                buildSearchText(project.title, project.description, project.status, project.priority, project.projectType?.name, project.projectType?.category),
                searchQuery,
            );
        });
    }, [projects, searchQuery, dateFrom, dateTo]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * PROJECTS_PER_PAGE;
        return filteredProjects.slice(start, start + PROJECTS_PER_PAGE);
    }, [filteredProjects, currentPage]);

    // ── Handle card expansion ──
    const handleToggleExpand = async (project: any) => {
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
    const handleProjectSaved = (saved: any) => {
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
    const handleRefreshDetail = async (projectId: Id) => {
        try {
            const detail = await projectsAPI.getById(projectId);
            setExpandedProjectDetail(detail);
        } catch { /* swallow */ }
    };

    // ── Permission helpers ──
    // Privileged roles: developer, officer, admin, leadership
    const isPrivileged = user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership;
    const isElevatedWorkItemRole = isPrivileged || user?.isSpecial;
    // Only privileged roles with a real member identity can create/edit/manage projects
    const canCreateProject = isPrivileged && !!user?.id;

    const canEditProject = (project: any) => isPrivileged && !!project?.isActive && !project?.isFinalized && project?.status !== 'CANCELLED';

    // canManageProject: finalize, archive, hold, abort, publish, reactivate (NOT blocked by finalized)
    const canManageProject = () => isPrivileged;

    // Upload follows backend visibility scope: if a project is visible to the user, upload is allowed.
    const canUploadToProject = () => !!user?.id;

    const hasActiveFilters = filterTeam !== '' || filterCategory !== '' || filterPriority !== ''
        || filterStatus !== '' || dateFrom !== '' || dateTo !== '';

    const handleApplyFilters = (filters: ProjectFiltersState) => {
        setFilterTeam(filters.filterTeam);
        setFilterCategory(filters.filterCategory);
        setFilterPriority(filters.filterPriority);
        setFilterStatus(filters.filterStatus);
        setDateFrom(filters.dateFrom);
        setDateTo(filters.dateTo);
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        setFilterTeam('');
        setFilterCategory('');
        setFilterPriority('');
        setFilterStatus('');
        setDateFrom('');
        setDateTo('');
    };

    // Filter allMembers to only those in the project's teams
    const getProjectMembers = (project: any) => {
        if (!project?.projectTeams?.length) return allMembers;
        const projectTeamIds = new Set(project.projectTeams.map((pt: any) => pt.teamId));
        return allMembers.filter((m: any) =>
            m.teamMemberships?.some((tm: any) => tm.isActive && projectTeamIds.has(tm.teamId))
        );
    };

    return (
        <div className="projects-page">
            {/* ─── Header ─── */}
            <div className="page-header">
                <h1 className="projects-title">Projects</h1>
            </div>
            <hr className="title-divider" />

            <div className="page-search-row">
                <div className="page-search-field page-search-field--full">
                    <Search className="page-search-icon" size={16} />
                    <input
                        type="search"
                        className="page-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search projects"
                        aria-label="Search projects"
                    />
                    <button
                        type="button"
                        className={`page-search-filter-btn${hasActiveFilters ? ' page-search-filter-btn--active' : ''}`}
                        onClick={() => setShowFiltersModal(true)}
                        aria-label="Open advanced filters"
                    >
                        <Filter size={16} />
                        <span className="page-search-filter-label">Advanced Filters</span>
                    </button>
                </div>
            </div>

            {/* ─── Content ─── */}
            {loading ? (
                <div className="projects-loading">Loading projects…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : filteredProjects.length === 0 ? (
                <div className="empty-state">
                    <CheckSquare className="empty-state-icon" />
                    <h4 className="empty-state-title">{searchQuery || hasActiveFilters ? 'No projects found' : 'No projects yet'}</h4>
                    <p className="empty-state-text">
                        {searchQuery || hasActiveFilters
                            ? 'Try a different search or adjust the filters.'
                            : 'Create your first project to get started.'}
                    </p>
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
                                onEdit={(proj: any) => setEditingProject(proj)}
                                onDeactivate={(proj: any) => setHoldingProject(proj)}
                                onFinalize={(proj: any) => setFinalizingProject(proj)}
                                onArchive={(proj: any) => setArchivingProject(proj)}
                                onRefreshDetail={handleRefreshDetail}
                                allMembers={getProjectMembers(p)}
                                canEdit={!!canEditProject(p)}
                                canManage={!!canManageProject()}
                                canUpload={canUploadToProject()}
                                canEditStructure={isElevatedWorkItemRole && p.isActive && !p.isFinalized && p.status !== 'CANCELLED'}
                                canEditStatus={p.isActive && !p.isFinalized && p.status !== 'CANCELLED'}
                                onReactivate={(proj: any) => setReactivatingProject(proj)}
                                onAbort={(proj: any) => setAbortingProject(proj)}
                                onViewActivity={(proj: any) => setActivityProject(proj)}
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
                <div className="project-detail-loading-indicator">
                    Loading details…
                </div>
            )}

            {/* ─── Create Modal ─── */}
            {showCreateModal && (
                <CreateProjectModal
                    mode="create"
                    allTeams={allTeams}
                    userTeamIds={user?.teamIds ?? []}
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
                    userTeamIds={user?.teamIds ?? []}
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

            {showFiltersModal && (
                <ProjectFiltersModal
                    filterTeam={filterTeam}
                    filterCategory={filterCategory}
                    filterPriority={filterPriority}
                    filterStatus={filterStatus}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    allTeams={allTeams}
                    allCategories={allCategories}
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyFilters}
                    onClear={handleResetFilters}
                />
            )}

        </div>
    );
}