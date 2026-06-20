'use client';

import {
    AlertCircle,
    Archive,
    Calendar,
    CheckSquare,
    History,
    PauseCircle,
    Pencil,
    PlayCircle,
    Users,
} from 'lucide-react';
import {
    ProjectCardView,
    fmtDate,
    getArchiveOutcomeBadge,
    getLifecycleBadge,
    isProjectAborted,
    isProjectInactive,
} from '@/features/Projects/components/ProjectCardView/ProjectCardView';
import type { EventDetail, EventSummary } from '@/types/backend-contracts';
import { eventToCardViewModel } from '../eventCardAdapter';
import EventExpandedContent from '../EventExpandedContent';
import type { EventTabKey } from '../eventUtils';
import '../../EventCardExpanded.css';

interface EventCardProps {
    event: EventSummary;
    expanded: boolean;
    fullDetail: EventDetail | null;
    detailLoading?: boolean;
    initialTab?: EventTabKey | null;
    canEdit: boolean;
    canManage: boolean;
    onToggle: (event: EventSummary | null) => void;
    onEdit: (event: EventSummary | EventDetail) => void;
    onDeactivate: (event: EventSummary | EventDetail) => void;
    onFinalize: (event: EventSummary | EventDetail) => void;
    onArchive: (event: EventSummary | EventDetail) => void;
    onReactivate: (event: EventSummary | EventDetail) => void;
    onAbort: (event: EventSummary | EventDetail) => void;
    onViewActivity: (event: EventSummary | EventDetail) => void;
    onReloadDetail?: () => void;
    archivedView?: boolean;
}

export default function EventCard({
    event,
    expanded,
    fullDetail,
    detailLoading,
    initialTab,
    canEdit,
    canManage,
    onToggle,
    onEdit,
    onDeactivate,
    onFinalize,
    onArchive,
    onReactivate,
    onAbort,
    onViewActivity,
    onReloadDetail,
    archivedView = false,
}: EventCardProps) {
    const cardProject = eventToCardViewModel(event);
    const detail = fullDetail ? eventToCardViewModel(fullDetail) : null;
    const registrationCount = event._count?.registrations ?? event.registrationCount ?? 0;
    const capacity = event.capacity ?? null;

    const aborted = isProjectAborted(cardProject);
    const inactive = isProjectInactive(cardProject);
    const lifecycleBadge = getLifecycleBadge(cardProject);
    const LifecycleIcon = lifecycleBadge.icon;
    const archiveOutcomeBadge = archivedView ? getArchiveOutcomeBadge(cardProject) : null;
    const ArchiveOutcomeIcon = archiveOutcomeBadge?.icon ?? Archive;

    const collapsedActions = archivedView ? (
        <>
            {canManage && inactive && (
                <>
                    <button className="icon-btn reactivate-btn" title="Reactivate event" type="button" onClick={(e) => { e.stopPropagation(); onReactivate(event); }}>
                        <PlayCircle size={14} />
                    </button>
                    <button className="icon-btn finalize-btn" title="Finalize event" type="button" onClick={(e) => { e.stopPropagation(); onFinalize(event); }}>
                        <CheckSquare size={14} />
                    </button>
                    <button className="icon-btn deactivate-btn" title="Abort event" type="button" onClick={(e) => { e.stopPropagation(); onAbort(event); }}>
                        <AlertCircle size={14} />
                    </button>
                </>
            )}
            {canManage && aborted && !event.isArchived && (
                <button className="icon-btn archive-btn" title="Archive event" type="button" onClick={(e) => { e.stopPropagation(); onArchive(event); }}>
                    <Archive size={14} />
                </button>
            )}
            <button className="icon-btn activity-btn" title="View activity" type="button" onClick={(e) => { e.stopPropagation(); onViewActivity(event); }}>
                <History size={14} />
            </button>
        </>
    ) : (
        <>
            {event.isFinalized && canManage && (
                <button className="icon-btn archive-btn" title="Archive event" type="button" onClick={(e) => { e.stopPropagation(); onArchive(event); }}>
                    <Archive size={14} />
                </button>
            )}
            {canEdit && !event.isFinalized && event.isActive && cardProject.status !== 'CANCELLED' && (
                <>
                    <button className="icon-btn edit-btn" title="Edit event" type="button" onClick={(e) => { e.stopPropagation(); onEdit(event); }}>
                        <Pencil size={14} />
                    </button>
                    <button className="icon-btn hold-btn" title="Hold event" type="button" onClick={(e) => { e.stopPropagation(); onDeactivate(event); }}>
                        <PauseCircle size={14} />
                    </button>
                    <button className="icon-btn deactivate-btn" title="Abort event" type="button" onClick={(e) => { e.stopPropagation(); onAbort(event); }}>
                        <AlertCircle size={14} />
                    </button>
                    <button className="icon-btn finalize-btn" title="Finalize event" type="button" onClick={(e) => { e.stopPropagation(); onFinalize(event); }}>
                        <CheckSquare size={14} />
                    </button>
                </>
            )}
            {canManage && inactive && (
                <>
                    <button className="icon-btn reactivate-btn" title="Reactivate event" type="button" onClick={(e) => { e.stopPropagation(); onReactivate(event); }}>
                        <PlayCircle size={14} />
                    </button>
                    <button className="icon-btn deactivate-btn" title="Abort event" type="button" onClick={(e) => { e.stopPropagation(); onAbort(event); }}>
                        <AlertCircle size={14} />
                    </button>
                    <button className="icon-btn finalize-btn" title="Finalize event" type="button" onClick={(e) => { e.stopPropagation(); onFinalize(event); }}>
                        <CheckSquare size={14} />
                    </button>
                </>
            )}
            {canManage && aborted && !event.isArchived && (
                <button className="icon-btn archive-btn" title="Archive event" type="button" onClick={(e) => { e.stopPropagation(); onArchive(event); }}>
                    <Archive size={14} />
                </button>
            )}
            <button className="icon-btn activity-btn" title="View activity" type="button" onClick={(e) => { e.stopPropagation(); onViewActivity(event); }}>
                <History size={14} />
            </button>
        </>
    );

    const detailTarget = fullDetail ?? event;

    return (
        <ProjectCardView
            project={cardProject}
            expanded={expanded}
            detail={detail}
            detailLoading={detailLoading}
            onToggle={(card) => onToggle(card != null ? event : null)}
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
                </>
            )}
            collapsedActions={collapsedActions}
            collapsedFooterTrailing={(
                <div className="project-card-footer-trailing">
                    <div className="project-card-due project-card-date-range">
                        <Calendar size={11} />
                        {fmtDate(event.eventDate)}
                    </div>
                    <div className="project-card-task-count">
                        <Users size={11} />
                        {registrationCount} registered{capacity != null ? ` / ${capacity}` : ''}
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
            expandedActions={fullDetail ? (
                <div className="expanded-title-actions">
                    {fullDetail.isFinalized ? (
                        canManage && (
                            <button className="icon-btn archive-btn icon-btn--text" title="Archive" type="button" onClick={(e) => { e.stopPropagation(); onArchive(detailTarget); }}>
                                <Archive size={13} />
                                <span className="expanded-action-label">Archive</span>
                            </button>
                        )
                    ) : cardProject.status === 'CANCELLED' ? (
                        canManage && !event.isArchived && (
                            <button className="icon-btn archive-btn icon-btn--text" title="Archive" type="button" onClick={(e) => { e.stopPropagation(); onArchive(detailTarget); }}>
                                <Archive size={13} />
                                <span className="expanded-action-label">Archive</span>
                            </button>
                        )
                    ) : fullDetail.isActive === false ? (
                        canManage && !event.isArchived && (
                            <>
                                <button className="icon-btn reactivate-btn icon-btn--text" title="Reactivate" type="button" onClick={(e) => { e.stopPropagation(); onReactivate(detailTarget); }}>
                                    <PlayCircle size={13} />
                                    <span className="expanded-action-label">Reactivate</span>
                                </button>
                                <button className="icon-btn deactivate-btn icon-btn--text" title="Abort" type="button" onClick={(e) => { e.stopPropagation(); onAbort(detailTarget); }}>
                                    <AlertCircle size={13} />
                                    <span className="expanded-action-label">Abort</span>
                                </button>
                                <button className="icon-btn finalize-btn icon-btn--text" title="Finalize" type="button" onClick={(e) => { e.stopPropagation(); onFinalize(detailTarget); }}>
                                    <CheckSquare size={13} />
                                    <span className="expanded-action-label">Finalize</span>
                                </button>
                            </>
                        )
                    ) : canEdit ? (
                        <>
                            <button className="icon-btn edit-btn icon-btn--text" title="Edit event" type="button" onClick={(e) => { e.stopPropagation(); onEdit(detailTarget); }}>
                                <Pencil size={13} />
                                <span className="expanded-action-label">Edit</span>
                            </button>
                            <button className="icon-btn hold-btn icon-btn--text" title="Hold event" type="button" onClick={(e) => { e.stopPropagation(); onDeactivate(detailTarget); }}>
                                <PauseCircle size={13} />
                                <span className="expanded-action-label">Hold</span>
                            </button>
                            <button className="icon-btn deactivate-btn icon-btn--text" title="Abort event" type="button" onClick={(e) => { e.stopPropagation(); onAbort(detailTarget); }}>
                                <AlertCircle size={13} />
                                <span className="expanded-action-label">Abort</span>
                            </button>
                            <button className="icon-btn finalize-btn icon-btn--text" title="Finalize event" type="button" onClick={(e) => { e.stopPropagation(); onFinalize(detailTarget); }}>
                                <CheckSquare size={13} />
                                <span className="expanded-action-label">Finalize</span>
                            </button>
                        </>
                    ) : null}
                    <button className="icon-btn activity-btn icon-btn--text" title="View activity" type="button" onClick={(e) => { e.stopPropagation(); onViewActivity(detailTarget); }}>
                        <History size={13} />
                        <span className="expanded-action-label">View activity</span>
                    </button>
                </div>
            ) : null}
            formatAssignedTeamSuffix={(team) => `${team.isOwner ? ' ★' : ''}`}
            detailDateFields={fullDetail ? [
                { label: 'Created', value: fmtDate(fullDetail.createdAt) || '—' },
                { label: 'Venue', value: fullDetail.venue || '—' },
                { label: 'Capacity', value: fullDetail.capacity != null ? String(fullDetail.capacity) : 'Unlimited' },
                { label: 'Event date', value: fmtDate(fullDetail.eventDate) || '—' },
            ] : undefined}
            afterSections={fullDetail ? (
                <div className="exp-card-section exp-card-section--flush">
                    <EventExpandedContent
                        eventId={fullDetail.id}
                        initialTab={initialTab}
                        onReload={() => onReloadDetail?.()}
                    />
                </div>
            ) : null}
        />
    );
}
