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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, teamsAPI, membersAPI, projectTypesAPI, projectFilesAPI, getProfilePhotoUrl } from '../../services/api';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import './ProjectsPage.css';
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

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCategoryClass(category) {
    return 'badge-category-' + (category ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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
//  Past-Project Card (read-only)
// ─────────────────────────────────────────────────────────
function PastProjectCard({ project, expanded, fullDetail, onToggle, allMembers }) {
    const { user } = useAuth();
    const ownerTeam = fullDetail?.projectTeams?.find((pt) => pt.isOwner) ?? null;

    const [projectFiles, setProjectFiles] = useState([]);
    useEffect(() => {
        if (expanded && fullDetail?.id) {
            projectFilesAPI.getAll(fullDetail.id).then(setProjectFiles).catch(() => setProjectFiles([]));
        }
    }, [expanded, fullDetail?.id]);

    const detail = fullDetail;

    return (
        <div
            className={`project-card${expanded ? ' project-card--expanded' : ''}`}
            onClick={() => !expanded && onToggle(project)}
        >
            {expanded && (
                <button
                    className="expanded-close-btn"
                    onClick={(e) => { e.stopPropagation(); onToggle(null); }}
                    title="Close"
                >
                    <X size={16} />
                </button>
            )}

            {/* Collapsed content */}
            <div className="project-card-collapsed-content">
                <div className="project-card-header">
                    <span className="project-card-title">{project.title}</span>
                    <div className="project-card-meta">
                        <span className="badge badge-finalized" title="Finalized">
                            <CheckCircle size={12} />
                            Finalized
                        </span>
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
                </div>
            </div>

            {/* Expanded content (read-only) */}
            {expanded && detail && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">

                        <div style={{ marginBottom: '0.25rem' }}>
                            <div className="expanded-title-row">
                                <h2 className="project-card-title" style={{ marginBottom: 0 }}>
                                    {detail.title}
                                </h2>
                                <span className="badge badge-finalized" style={{ fontSize: '0.82rem' }}>
                                    <CheckCircle size={14} />
                                    Finalized
                                </span>
                            </div>
                            {detail.description && (
                                <div className="expanded-description" style={{ marginTop: '0.4rem' }}>
                                    {detail.description}
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">Details</div>
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
                                    <span className="exp-date-value">{fmtDate(detail.dueDate) || '—'}</span>
                                </div>
                                {detail.completedDate && (
                                    <div className="exp-date-item">
                                        <span className="exp-date-label">Completed</span>
                                        <span className="exp-date-value">{fmtDate(detail.completedDate)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Teams */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">Teams</div>
                            <div className="exp-teams-block">
                                <span className="exp-creator-label">Created by</span>
                                <div className="exp-teams-pills">
                                    <span className="exp-creator-name">{detail.createdBy?.fullName ?? '—'}</span>
                                    {ownerTeam && (
                                        <span className="badge-team">{ownerTeam.team?.name}</span>
                                    )}
                                </div>
                            </div>
                            {(detail.projectTeams?.length ?? 0) > 0 && (
                                <div className="exp-teams-block">
                                    <span className="exp-creator-label">Assigned Teams</span>
                                    <div className="exp-teams-pills">
                                        {detail.projectTeams.map((pt) => (
                                            <span key={pt.id} className="badge-team">
                                                {pt.team?.name}
                                                {pt.isOwner ? ' ★' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Phases & Tasks (read-only) */}
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

                        {/* Project Files (read-only) */}
                        <div className="exp-card-section">
                            <div className="exp-card-section-header">
                                <Paperclip size={14} style={{ marginRight: '0.35rem' }} />
                                Project Files
                            </div>
                            <FileUploadZone
                                projectId={detail.id}
                                memberId={user?.id}
                                existingFiles={projectFiles}
                                onFileUploaded={() => { }}
                                onFileRemoved={() => { }}
                                disabled={true}
                            />
                        </div>

                    </div>
                </div>
            )}
        </div>
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
                                onToggle={handleToggleExpand}
                                allMembers={allMembers}
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
        </div>
    );
}
