import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    X,
    ChevronDown,
    ChevronRight,
    Calendar,
    CheckSquare,
    AlertCircle,
    SquareCheckBig,
    Paperclip,
    Archive,
    CheckCircle,
    History,
    PlayCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, teamsAPI, membersAPI, projectTypesAPI, projectFilesAPI, getProfilePhotoUrl } from '../../services/api';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import './ProjectsPage.css';
import {
    fmtDate,
    ProjectCardView,
    getArchiveOutcomeBadge,
    getLifecycleBadge,
    isProjectAborted,
    isProjectInactive,
} from './components/ProjectCardView';
import ReactivateProjectModal from './modals/ReactivateProjectModal';
import FinalizeProjectModal from './modals/FinalizeProjectModal';
import ArchiveProjectModal from './modals/ArchiveProjectModal';
import AbortProjectModal from './modals/AbortProjectModal';
import ProjectActivityModal from './modals/ProjectActivityModal';
import PhaseRow from './components/PhaseRow';

// ─────────────────────────────────────────────────────────
//  Filter Dropdown (same as ProjectsPage)
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
//  Small helpers (duplicated to keep this page self-contained)
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

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ─────────────────────────────────────────────────────────
//  Past-Project Card (read-only)
// ─────────────────────────────────────────────────────────
function PastProjectCard({ project, expanded, fullDetail, detailLoading, onToggle, allMembers, onReactivate, onAbort, onFinalize, onPublish, onArchive, onViewActivity }) {
    const { user } = useAuth();

    const [projectFiles, setProjectFiles] = useState([]);
    const [projectFolders, setProjectFolders] = useState([]);
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
    const ArchiveOutcomeIcon = archiveOutcomeBadge?.icon;

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
                            <button className="icon-btn reactivate-btn" title="Reactivate project" onClick={(e) => { e.stopPropagation(); onReactivate(project); }}>
                                <PlayCircle size={14} />
                            </button>
                            <button className="icon-btn finalize-btn" title="Finalize project" onClick={(e) => { e.stopPropagation(); onFinalize(project); }}>
                                <CheckSquare size={14} />
                            </button>
                            <button className="icon-btn deactivate-btn" title="Abort project" onClick={(e) => { e.stopPropagation(); onAbort(project); }}>
                                <AlertCircle size={14} />
                            </button>
                        </>
                    )}
                    {aborted && !project.isArchived && (
                        <button className="icon-btn archive-btn" title="Archive project" onClick={(e) => { e.stopPropagation(); onArchive(project); }}>
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
                        <span className={`badge ${archiveOutcomeBadge.className}`} style={{ fontSize: '0.82rem' }} title={archiveOutcomeBadge.title}>
                            <ArchiveOutcomeIcon size={14} />
                            {archiveOutcomeBadge.label}
                        </span>
                    )}
                    <span className={`badge ${lifecycleBadge.className}`} style={{ fontSize: '0.82rem' }}>
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
                                onClick={(e) => { e.stopPropagation(); onReactivate(detail); }}
                            >
                                <PlayCircle size={13} />
                                Reactivate
                            </button>
                            <button
                                className="icon-btn finalize-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onFinalize(detail); }}
                            >
                                <CheckSquare size={13} />
                                Finalize
                            </button>
                            <button
                                className="icon-btn deactivate-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onAbort(detail); }}
                            >
                                <AlertCircle size={13} />
                                Abort
                            </button>
                        </div>
                    ) : aborted && !project.isArchived ? (
                        <div className="expanded-title-actions">
                            <button
                                className="icon-btn archive-btn icon-btn--text"
                                onClick={(e) => { e.stopPropagation(); onArchive(detail); }}
                            >
                                <Archive size={13} />
                                Archive
                            </button>
                        </div>
                    ) : null}
                    <div className="expanded-title-actions">
                        <button
                            className="icon-btn activity-btn icon-btn--text"
                            onClick={(e) => { e.stopPropagation(); onViewActivity(detail); }}
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
                    <div className="exp-card-section">
                        <div className="exp-card-section-header">
                            Phases ({detail.phases?.length ?? 0})
                        </div>
                        <div className="phase-list" style={{ marginTop: '0.5rem' }}>
                            {detail.phases?.map((phase) => (
                                <PhaseRow
                                    key={phase.id}
                                    phase={phase}
                                    canEdit={false}
                                    allMembers={allMembers}
                                    onPhaseUpdated={() => { }}
                                    onTaskUpdated={() => { }}
                                    onAddTask={() => { }}
                                    onAddSubtask={() => { }}
                                    onEditTask={() => { }}
                                    onEditPhase={() => { }}
                                    onDeletePhase={() => { }}
                                />
                            ))}
                        </div>
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
export default function PastProjectsPage() {
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
    const [actionProject, setActionProject] = useState(null);

    // Load supporting data
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

    // Load archived projects
    const loadProjects = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await projectsAPI.getAll({
                archived: true,
                teamId: filterTeam || undefined,
                priority: filterPriority || undefined,
            });

            let filtered = data;
            if (filterCategory) {
                filtered = data.filter((p) => p.projectType?.category === filterCategory);
            }
            filtered.sort((a, b) =>
                (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99) ||
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            setProjects(filtered);
        } catch (err) {
            setError(err.message || 'Failed to load past projects');
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

    const handleToggleExpand = async (project) => {
        if (!project) {
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
                        {paginatedProjects.map((p) => (
                            <PastProjectCard
                                key={p.id}
                                project={p}
                                expanded={expandedProjectId === p.id}
                                fullDetail={expandedProjectId === p.id ? expandedProjectDetail : null}
                                detailLoading={expandedProjectId === p.id && detailLoading}
                                onToggle={handleToggleExpand}
                                allMembers={allMembers}
                                onReactivate={(proj) => setActionProject({ type: 'reactivate', project: proj })}
                                onAbort={(proj) => setActionProject({ type: 'abort', project: proj })}
                                onFinalize={(proj) => setActionProject({ type: 'finalize', project: proj })}
                                onPublish={(proj) => setActionProject({ type: 'publish', project: proj })}
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

            {/* Loading indicator for expanded card */}
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
                    project={actionProject.project}
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
