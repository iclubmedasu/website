'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Calendar,
    CheckSquare,
    AlertCircle,
    SquareCheckBig,
    Paperclip,
    Archive,
    History,
    PlayCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, teamsAPI, membersAPI, projectTypesAPI, projectFilesAPI } from '../../services/api';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import Dropdown from '../../components/dropdown/dropdown';
import './ProjectsPage.css';
import {
    fmtDate,
    ProjectCardView,
    getArchiveOutcomeBadge,
    getLifecycleBadge,
    isProjectAborted,
    isProjectInactive,
} from './components/ProjectCardView/ProjectCardView';
import GanttChart from './components/GanttChart/GanttChart';
import ReactivateProjectModal from './modals/ReactivateProjectModal';
import FinalizeProjectModal from './modals/FinalizeProjectModal';
import ArchiveProjectModal from './modals/ArchiveProjectModal';
import AbortProjectModal from './modals/AbortProjectModal';
import ProjectActivityModal from './modals/ProjectActivityModal';
import type {
    Id,
    MemberSummary,
    ProjectDetail,
    ProjectFileRef,
    ProjectFolderRef,
    ProjectSummary,
    ProjectTypeRef,
    TeamRef,
} from '../../types/backend-contracts';

// ─────────────────────────────────────────────────────────
//  Small helpers (duplicated to keep this page self-contained)
// ─────────────────────────────────────────────────────────
type PriorityKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface PastProjectSummary extends ProjectSummary {
    createdAt?: string | null;
    _count?: {
        tasks?: number;
        phases?: number;
    };
}

interface ProjectActionTarget {
    id: Id;
    title: string;
}

type ProjectActionPayload = (PastProjectSummary | ProjectDetail | ProjectActionTarget) & Record<string, any>;

type ProjectActionType = 'reactivate' | 'abort' | 'finalize' | 'publish' | 'archive' | 'activity';

const PRIORITY_ORDER: Record<PriorityKey, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const PRIORITY_LABELS: Record<PriorityKey, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

const PRIORITIES: PriorityKey[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ─────────────────────────────────────────────────────────
//  Past-Project Card (read-only)
// ─────────────────────────────────────────────────────────
interface PastProjectCardProps {
    project: PastProjectSummary;
    expanded: boolean;
    fullDetail: ProjectDetail | null;
    detailLoading: boolean;
    onToggle: (project: any) => void;
    onReactivate: (project: ProjectActionPayload) => void;
    onAbort: (project: ProjectActionPayload) => void;
    onFinalize: (project: ProjectActionPayload) => void;
    onArchive: (project: ProjectActionPayload) => void;
    onViewActivity: (project: ProjectActionPayload) => void;
}

function PastProjectCard({ project, expanded, fullDetail, detailLoading, onToggle, onReactivate, onAbort, onFinalize, onArchive, onViewActivity }: PastProjectCardProps) {
    const { user } = useAuth();

    const [projectFiles, setProjectFiles] = useState<ProjectFileRef[]>([]);
    const [projectFolders, setProjectFolders] = useState<ProjectFolderRef[]>([]);
    useEffect(() => {
        if (expanded && fullDetail?.id) {
            projectFilesAPI.getAll(fullDetail.id).then(setProjectFiles).catch(() => setProjectFiles([]));
            projectFilesAPI.getFolders(fullDetail.id, true).then(setProjectFolders).catch(() => setProjectFolders([]));
        }
    }, [expanded, fullDetail?.id]);

    const detail = fullDetail;
    const aborted = isProjectAborted(project);
    const inactive = isProjectInactive(project);
    const lifecycleBadge = getLifecycleBadge(project);
    const LifecycleIcon = lifecycleBadge.icon;
    const archiveOutcomeBadge = getArchiveOutcomeBadge(project);
    const ArchiveOutcomeIcon = archiveOutcomeBadge?.icon ?? Archive;
    const detailTarget = detail
        ? { id: detail.id, title: detail.title }
        : { id: project.id, title: project.title };

    return (
        <ProjectCardView
            project={project}
            expanded={expanded}
            detail={detail}
            detailLoading={detailLoading}
            onToggle={onToggle}
            collapsedMeta={(
                <>
                    {archiveOutcomeBadge && (
                        <span className={`badge ${archiveOutcomeBadge.className}`} title={archiveOutcomeBadge.title}>
                            <ArchiveOutcomeIcon size={12} />
                            {archiveOutcomeBadge.label}
                        </span>
                    )}
                    <span className={`badge ${lifecycleBadge.className}`} title={lifecycleBadge.title}>
                        <LifecycleIcon size={12} />
                        {lifecycleBadge.label}
                    </span>
                    {inactive && (
                        <>
                            <button className="icon-btn reactivate-btn" title="Reactivate project" onClick={(e) => { e.stopPropagation(); onReactivate({ id: project.id, title: project.title }); }}>
                                <PlayCircle size={14} />
                            </button>
                            <button className="icon-btn finalize-btn" title="Finalize project" onClick={(e) => { e.stopPropagation(); onFinalize({ id: project.id, title: project.title }); }}>
                                <CheckSquare size={14} />
                            </button>
                            <button className="icon-btn deactivate-btn" title="Abort project" onClick={(e) => { e.stopPropagation(); onAbort({ id: project.id, title: project.title }); }}>
                                <AlertCircle size={14} />
                            </button>
                        </>
                    )}
                    {aborted && !project.isArchived && (
                        <button className="icon-btn archive-btn" title="Archive project" onClick={(e) => { e.stopPropagation(); onArchive({ id: project.id, title: project.title }); }}>
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
                <div className="project-card-footer-trailing">
                    {project.dueDate && (
                        <div className="project-card-due">
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
            )}
            expandedMeta={(
                <>
                    {archiveOutcomeBadge && (
                        <span className={`badge badge--compact ${archiveOutcomeBadge.className}`} title={archiveOutcomeBadge.title}>
                            <ArchiveOutcomeIcon size={14} />
                            {archiveOutcomeBadge.label}
                        </span>
                    )}
                    <span className={`badge badge--compact ${lifecycleBadge.className}`}>
                        <LifecycleIcon size={14} />
                        {lifecycleBadge.label}
                    </span>
                </>
            )}
            expandedActions={(
                <>
                    {inactive ? (
                        <div className="expanded-title-actions">
                            <button
                                className="icon-btn reactivate-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onReactivate(detailTarget); }}
                            >
                                <PlayCircle size={13} />
                                Reactivate
                            </button>
                            <button
                                className="icon-btn finalize-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onFinalize(detailTarget); }}
                            >
                                <CheckSquare size={13} />
                                Finalize
                            </button>
                            <button
                                className="icon-btn deactivate-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onAbort(detailTarget); }}
                            >
                                <AlertCircle size={13} />
                                Abort
                            </button>
                        </div>
                    ) : aborted && !project.isArchived ? (
                        <div className="expanded-title-actions">
                            <button
                                className="icon-btn archive-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onArchive(detailTarget); }}
                            >
                                <Archive size={13} />
                                Archive
                            </button>
                        </div>
                    ) : null}
                    <div className="expanded-title-actions">
                        <button
                            className="icon-btn activity-btn icon-btn--text"
                            onClick={(e) => { e.stopPropagation(); onViewActivity(detail || project); }}
                        >
                            <History size={13} />
                            View activity
                        </button>
                    </div>
                </>
            )}
            detailExtra={detail?.completedDate ? (
                <div className="exp-date-item">
                    <span className="exp-date-label">Completed</span>
                    <span className="exp-date-value">{fmtDate(detail.completedDate)}</span>
                </div>
            ) : null}
            formatAssignedTeamSuffix={(pt) => `${pt.isOwner ? ' ★' : ''}`}
            afterSections={detail ? (
                <>
                    <div className="exp-card-section exp-card-section--flush">
                        <GanttChart
                            phases={detail.phases || []}
                            projectId={detail.id}
                            projectTitle={detail.title}
                            projectDetail={detail}
                            projectStartDate={detail.startDate}
                            projectDueDate={detail.dueDate}
                            canEdit={false}
                            canEditStatus={false}
                            onAddPhase={() => { }}
                            onAddTask={() => { }}
                            onAddSubtask={() => { }}
                            onEditPhase={() => { }}
                            onEditTask={() => { }}
                            onOpenTaskComments={() => { }}
                            onOpenTaskScheduleSlots={() => { }}
                            onOpenTaskActivity={() => { }}
                            onDeletePhase={() => { }}
                            onRefresh={() => { }}
                        />
                    </div>

                    <div className="exp-card-section">
                        <div className="exp-card-section-header">
                            <Paperclip size={14} className="exp-card-section-icon" />
                            Project Files
                        </div>
                        <FileUploadZone
                            projectId={detail.id}
                            memberId={user?.id}
                            existingFiles={projectFiles}
                            existingFolders={projectFolders}
                            onFileUploaded={() => { }}
                            onFileRemoved={() => { }}
                            disabled={true}
                        />
                    </div>
                </>
            ) : null}
        />
    );
}

// ─────────────────────────────────────────────────────────
//  Pagination helper
// ─────────────────────────────────────────────────────────
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
export default function PastProjectsPage() {
    const [projects, setProjects] = useState<PastProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [allTeams, setAllTeams] = useState<TeamRef[]>([]);
    const [, setAllMembers] = useState<MemberSummary[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);

    // Filters
    const [filterTeam, setFilterTeam] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    // Pagination
    const PROJECTS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    // Expanded card state
    const [expandedProjectId, setExpandedProjectId] = useState<Id | null>(null);
    const [expandedProjectDetail, setExpandedProjectDetail] = useState<ProjectDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionProject, setActionProject] = useState<{ type: ProjectActionType; project: ProjectActionPayload } | null>(null);

    // Load supporting data
    useEffect(() => {
        Promise.all([
            teamsAPI.getAll(undefined, 'all').catch(() => [] as TeamRef[]),
            membersAPI.getAll(true).catch(() => [] as MemberSummary[]),
            projectTypesAPI.getAll().catch(() => [] as ProjectTypeRef[]),
        ]).then(([teams, members, types]) => {
            const teamsList = Array.isArray(teams) ? (teams as TeamRef[]) : [];
            const membersList = Array.isArray(members) ? (members as MemberSummary[]) : [];
            const typeList = Array.isArray(types) ? (types as ProjectTypeRef[]) : [];
            setAllTeams(teamsList);
            setAllMembers(membersList);
            const cats = [...new Set(typeList.map((t) => t.category).filter((category): category is string => Boolean(category)))];
            setAllCategories(cats);
        });
    }, []);

    // Load archived projects
    const loadProjects = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await projectsAPI.getAll({
                archived: true,
                teamId: filterTeam ? Number(filterTeam) : undefined,
                priority: (filterPriority || undefined) as any,
            }) as PastProjectSummary[];

            let filtered = data;
            if (filterCategory) {
                filtered = data.filter((p: PastProjectSummary) => p.projectType?.category === filterCategory);
            }
            filtered.sort((a: PastProjectSummary, b: PastProjectSummary) => {
                const priorityA = PRIORITY_ORDER[(a.priority as PriorityKey) || 'LOW'] ?? 99;
                const priorityB = PRIORITY_ORDER[(b.priority as PriorityKey) || 'LOW'] ?? 99;
                if (priorityA !== priorityB) return priorityA - priorityB;
                const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return createdB - createdA;
            });
            setProjects(filtered);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load past projects');
        } finally {
            setLoading(false);
        }
    }, [filterTeam, filterCategory, filterPriority]);

    const handleLifecycleRefresh = useCallback(() => {
        loadProjects();
        if (expandedProjectId) {
            projectsAPI.getById(expandedProjectId).then(setExpandedProjectDetail).catch(() => { });
        }
    }, [expandedProjectId, loadProjects]);

    useEffect(() => { loadProjects(); }, [loadProjects]);
    useEffect(() => { setCurrentPage(1); }, [filterTeam, filterCategory, filterPriority]);

    const totalPages = Math.max(1, Math.ceil(projects.length / PROJECTS_PER_PAGE));
    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * PROJECTS_PER_PAGE;
        return projects.slice(start, start + PROJECTS_PER_PAGE);
    }, [projects, currentPage]);

    const handleToggleExpand = async (project: any) => {
        if (!project || !project.id) {
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
            return;
        }
        if (expandedProjectId === project.id) {
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
            return;
        }
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

    return (
        <div className="projects-page">
            {/* Header */}
            <div className="page-header">
                <h1 className="projects-title">Past Projects</h1>
                <div className="page-header-actions">
                    <Dropdown
                        triggerLabel="Team"
                        options={[
                            { value: '', label: 'All Teams' },
                            ...allTeams.map((t: TeamRef) => ({ value: String(t.id), label: t.name })),
                        ]}
                        value={filterTeam}
                        onChange={(value) => setFilterTeam(value == null ? '' : String(value))}
                    />
                    <Dropdown
                        triggerLabel="Category"
                        options={[
                            { value: '', label: 'All Categories' },
                            ...allCategories.map((c: string) => ({ value: c, label: c })),
                        ]}
                        value={filterCategory}
                        onChange={(value) => setFilterCategory(value == null ? '' : String(value))}
                    />
                    <Dropdown
                        triggerLabel="Priority"
                        options={[
                            { value: '', label: 'All Priorities' },
                            ...PRIORITIES.map((p: PriorityKey) => ({ value: p, label: PRIORITY_LABELS[p] })),
                        ]}
                        value={filterPriority}
                        onChange={(value) => setFilterPriority(value == null ? '' : String(value))}
                    />
                </div>
            </div>
            <hr className="title-divider" />

            {/* Content */}
            {loading ? (
                <div className="projects-loading">Loading past projects…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : projects.length === 0 ? (
                <div className="empty-state">
                    <Archive className="empty-state-icon" />
                    <h4 className="empty-state-title">No archived projects</h4>
                    <p className="empty-state-text">Projects that have been archived will appear here.</p>
                </div>
            ) : (
                <>
                    <div className="projects-grid">
                        {paginatedProjects.map((p: PastProjectSummary) => (
                            <PastProjectCard
                                key={p.id}
                                project={p}
                                expanded={expandedProjectId === p.id}
                                fullDetail={expandedProjectId === p.id ? expandedProjectDetail : null}
                                detailLoading={expandedProjectId === p.id && detailLoading}
                                onToggle={handleToggleExpand}
                                onReactivate={(proj) => setActionProject({ type: 'reactivate', project: proj })}
                                onAbort={(proj) => setActionProject({ type: 'abort', project: proj })}
                                onFinalize={(proj) => setActionProject({ type: 'finalize', project: proj })}
                                onArchive={(proj) => setActionProject({ type: 'archive', project: proj })}
                                onViewActivity={(proj) => setActionProject({ type: 'activity', project: proj })}
                            />
                        ))}
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
                                {getPageNumbers(currentPage, totalPages).map((p: number | '...', i: number) =>
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

            {/* Loading indicator for expanded card */}
            {expandedProjectId && detailLoading && !expandedProjectDetail && (
                <div className="project-detail-loading-indicator">
                    Loading details…
                </div>
            )}

            {actionProject?.type === 'reactivate' && (
                <ReactivateProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onReactivated={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {actionProject?.type === 'finalize' && (
                <FinalizeProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onFinalized={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {actionProject?.type === 'archive' && (
                <ArchiveProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onArchived={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {actionProject?.type === 'activity' && (
                <ProjectActivityModal
                    project={actionProject.project as any}
                    onClose={() => setActionProject(null)}
                />
            )}

            {actionProject?.type === 'abort' && (
                <AbortProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onAborted={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}
        </div>
    );
}
