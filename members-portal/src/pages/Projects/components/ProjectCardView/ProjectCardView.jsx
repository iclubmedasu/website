import {
    AlertCircle,
    Archive,
    Calendar,
    CheckCircle,
    CheckSquare,
    PauseCircle,
    PlayCircle,
    SquareCheckBig,
    X,
} from 'lucide-react';

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

export function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getCategoryClass(category) {
    return 'badge-category-' + (category ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function StatusBadge({ status }) {
    return (
        <span className={`badge badge-status-${status}`}>
            <span className={`status-dot status-dot-${status}`} />
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}

export function PriorityBadge({ priority }) {
    return (
        <span className={`badge badge-priority-${priority}`}>
            {PRIORITY_LABELS[priority] ?? priority}
        </span>
    );
}

export function isProjectAborted(project) {
    return project?.status === 'CANCELLED' && !project?.isArchived;
}

export function isProjectInactive(project) {
    return !!project && !project.isActive && !project.isFinalized && !project.isArchived && project.status !== 'CANCELLED';
}

export function getLifecycleBadge(project) {
    if (project?.isArchived) {
        return { className: 'badge-lifecycle-archived', label: 'Archived', icon: Archive, title: 'Archived' };
    }
    if (project?.isFinalized) {
        return { className: 'badge-lifecycle-finalized', label: 'Finalized', icon: CheckCircle, title: 'Finalized' };
    }
    if (project?.status === 'CANCELLED') {
        return { className: 'badge-lifecycle-aborted', label: 'Aborted', icon: AlertCircle, title: 'Aborted' };
    }
    if (project && !project.isActive) {
        return { className: 'badge-lifecycle-hold', label: 'On Hold', icon: PauseCircle, title: 'On Hold' };
    }
    return { className: 'badge-lifecycle-active', label: 'Active', icon: CheckSquare, title: 'Active' };
}

export function getArchiveOutcomeBadge(project) {
    if (!project?.isArchived) return null;
    if (project.isFinalized) {
        return { className: 'badge-lifecycle-finalized', label: 'Finalized', icon: CheckCircle, title: 'Archived after finalizing' };
    }
    if (project.status === 'CANCELLED') {
        return { className: 'badge-lifecycle-aborted', label: 'Aborted', icon: AlertCircle, title: 'Archived after being aborted' };
    }
    return null;
}

function ProjectDetailsSection({ detail, over, detailExtra }) {
    return (
        <div className="exp-card-section">
            <div className="exp-card-section-header">Details</div>
            <div className="exp-badges-row exp-badges-row--four">
                <div className="exp-badges-item">
                    <span className="exp-badges-label">Category</span>
                    <span className="exp-badges-value">
                        {detail.projectType?.category ? (
                            <span
                                className={`badge exp-badge--truncate ${getCategoryClass(detail.projectType.category)}`}
                                title={detail.projectType.category}
                            >
                                {detail.projectType.category}
                            </span>
                        ) : '—'}
                    </span>
                </div>
                <div className="exp-badges-item">
                    <span className="exp-badges-label">Type</span>
                    <span className="exp-badges-value">
                        {detail.projectType ? (
                            <span className="badge badge-type exp-badge--truncate" title={detail.projectType.name}>
                                {detail.projectType.name}
                            </span>
                        ) : '—'}
                    </span>
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
                    <span className={`exp-date-value${over ? ' overdue' : ''}`}>
                        {fmtDate(detail.dueDate) || '—'}
                    </span>
                </div>
                {detailExtra}
            </div>
        </div>
    );
}

function ProjectTeamsSection({ detail, ownerTeam, teamEmptyMessage, formatAssignedTeamSuffix, teamExtra }) {
    return (
        <div className="exp-card-section">
            <div className="exp-card-section-header">Teams</div>
            <div className="exp-teams-block exp-teams-block--spaced">
                <span className="exp-creator-label">Created by</span>
                <div className="exp-teams-pills">
                    <span className="exp-creator-name">{detail.createdBy?.fullName ?? '—'}</span>
                    {ownerTeam && (
                        <span className="badge-team">{ownerTeam.team?.name}</span>
                    )}
                </div>
            </div>
            {(detail.projectTeams?.length ?? 0) > 0 ? (
                <div className="exp-teams-block">
                    <span className="exp-teams-label">Assigned Teams</span>
                    <div className="exp-teams-pills">
                        {detail.projectTeams.map((pt) => (
                            <span key={pt.id} className="badge-team">
                                {pt.team?.name}
                                {formatAssignedTeamSuffix ? formatAssignedTeamSuffix(pt) : ''}
                            </span>
                        ))}
                    </div>
                </div>
            ) : teamEmptyMessage ? (
                <span style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>{teamEmptyMessage}</span>
            ) : null}
            {teamExtra}
        </div>
    );
}

export function ProjectCardView({
    project,
    expanded,
    detail,
    fullDetail,
    detailLoading,
    onToggle,
    collapsedMeta,
    collapsedActions,
    collapsedFooterTrailing,
    expandedMeta,
    expandedActions,
    detailExtra,
    teamEmptyMessage,
    formatAssignedTeamSuffix,
    teamExtra,
    afterSections,
}) {
    const currentDetail = detail || fullDetail;
    const over = currentDetail ? currentDetail.dueDate && currentDetail.status !== 'COMPLETED' && currentDetail.status !== 'CANCELLED' && new Date(currentDetail.dueDate) < new Date() : project?.dueDate && project?.status !== 'COMPLETED' && project?.status !== 'CANCELLED' && new Date(project.dueDate) < new Date();
    const ownerTeam = currentDetail?.projectTeams?.find((pt) => pt.isOwner) ?? null;
    const accessDenied = expanded && !detailLoading && !currentDetail;
    const loadingDetail = expanded && detailLoading && !currentDetail;

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

            <div className="project-card-collapsed-content">
                <div className="project-card-header">
                    <span className="project-card-title">{project.title}</span>
                    <div className="project-card-meta">
                        {collapsedMeta}
                        {collapsedActions}
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
                </div>

                {collapsedFooterTrailing && (
                    <div className="project-card-bottom-bar">
                        {collapsedFooterTrailing}
                    </div>
                )}
            </div>

            {expanded && currentDetail && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">
                        <div style={{ marginBottom: '0.25rem' }}>
                            <div className="expanded-title-row">
                                <h2 className="project-card-title" style={{ marginBottom: 0 }}>
                                    {currentDetail.title}
                                </h2>
                                {expandedMeta}
                                {expandedActions}
                            </div>
                            {currentDetail.description && (
                                <div className="expanded-description" style={{ marginTop: '0.4rem' }}>
                                    {currentDetail.description}
                                </div>
                            )}
                        </div>

                        <div className="exp-card-columns">
                            <ProjectDetailsSection detail={currentDetail} over={over} detailExtra={detailExtra} />
                            <ProjectTeamsSection
                                detail={currentDetail}
                                ownerTeam={ownerTeam}
                                teamEmptyMessage={teamEmptyMessage}
                                formatAssignedTeamSuffix={formatAssignedTeamSuffix}
                                teamExtra={teamExtra}
                            />
                        </div>

                        {afterSections}
                    </div>
                </div>
            )}

            {loadingDetail && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">
                        <div className="project-card-loading-state">
                            <div className="project-card-loading-title">Loading project details…</div>
                            <div className="project-card-loading-text">
                                Fetching phases, tasks, and activity history.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {accessDenied && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">
                        <div style={{
                            padding: '1.5rem',
                            border: '1px dashed var(--gray-300)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--gray-50)',
                            color: 'var(--gray-600)',
                            textAlign: 'center',
                        }}>
                            <AlertCircle size={18} style={{ marginBottom: '0.5rem' }} />
                            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                You do not have access to this project
                            </div>
                            <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                                This project can’t be opened with your current permissions.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export { Calendar, SquareCheckBig };