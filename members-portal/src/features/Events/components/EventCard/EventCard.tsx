'use client';

import { useEffect, useState } from 'react';
import { Archive, Calendar, Paperclip, Users } from 'lucide-react';
import LifecycleCardView, {
    getArchiveOutcomeBadge,
    getLifecycleBadge,
} from '@/components/cards/LifecycleCardView/LifecycleCardView';
import LifecycleCardActions from '@/components/cards/LifecycleCardView/LifecycleCardActions';
import FileUploadZone from '@/components/FileUpload/FileUploadZone';
import type { EntityFilesAPI } from '@/components/FileUpload/types';
import { useAuth } from '@/context/AuthContext';
import { eventFilesAPI } from '@/services/api';
import type { EventDetail, EventFileRef, EventFolderRef, EventSummary, Id } from '@/types/backend-contracts';
import { eventToCardViewModel } from './eventCardAdapter';
import EventExpandedContent from '../EventExpandedContent/EventExpandedContent';
import { formatEventDuration } from '../eventDateUtils';
import type { EventTabKey } from '../eventUtils';

export interface EventCardProps {
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
    canUpload?: boolean;
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
    canUpload = false,
}: EventCardProps) {
    const { user } = useAuth();
    const [eventFiles, setEventFiles] = useState<EventFileRef[]>([]);
    const [eventFolders, setEventFolders] = useState<EventFolderRef[]>([]);
    const detailId = fullDetail?.id as Id | undefined;

    useEffect(() => {
        if (expanded && detailId) {
            eventFilesAPI.getAll(detailId).then(setEventFiles).catch(() => setEventFiles([]));
            eventFilesAPI.getFolders(detailId, true).then(setEventFolders).catch(() => setEventFolders([]));
        }
    }, [expanded, detailId]);

    const cardItem = eventToCardViewModel(event);
    const detailCard = fullDetail ? eventToCardViewModel(fullDetail) : null;
    const registrationCount = event._count?.registrations ?? event.registrationCount ?? 0;
    const capacity = event.capacity ?? null;

    const lifecycleBadge = getLifecycleBadge(cardItem);
    const LifecycleIcon = lifecycleBadge.icon;
    const archiveOutcomeBadge = archivedView ? getArchiveOutcomeBadge(cardItem) : null;
    const ArchiveOutcomeIcon = archiveOutcomeBadge?.icon ?? Archive;

    const detailTarget = fullDetail ?? event;
    const lifecycleMode = archivedView ? 'archived' as const : 'active' as const;

    const collapsedHandlers = {
        onEdit: () => onEdit(event),
        onDeactivate: () => onDeactivate(event),
        onFinalize: () => onFinalize(event),
        onArchive: () => onArchive(event),
        onReactivate: () => onReactivate(event),
        onAbort: () => onAbort(event),
        onViewActivity: () => onViewActivity(event),
    };

    const expandedHandlers = {
        onEdit: () => onEdit(detailTarget),
        onDeactivate: () => onDeactivate(detailTarget),
        onFinalize: () => onFinalize(detailTarget),
        onArchive: () => onArchive(detailTarget),
        onReactivate: () => onReactivate(detailTarget),
        onAbort: () => onAbort(detailTarget),
        onViewActivity: () => onViewActivity(detailTarget),
    };

    return (
        <LifecycleCardView
            item={cardItem}
            expanded={expanded}
            detail={detailCard}
            detailLoading={detailLoading}
            onToggle={(card) => onToggle(card != null ? event : null)}
            loadingTitle="Loading event details…"
            loadingText="Fetching tiers, registrations, and statistics."
            accessDeniedTitle="You do not have access to this event"
            accessDeniedText="This event can't be opened with your current permissions."
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
            collapsedActions={(
                <LifecycleCardActions
                    item={cardItem}
                    mode={lifecycleMode}
                    variant="collapsed"
                    canEdit={canEdit}
                    canManage={canManage}
                    entityLabel="event"
                    {...collapsedHandlers}
                />
            )}
            collapsedFooterTrailing={(
                <div className="project-card-footer-trailing">
                    <div className="project-card-due project-card-date-range">
                        <Calendar size={11} />
                        {formatEventDuration(event.eventDate, event.eventEndDate ?? event.eventDate)}
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
                    <LifecycleCardActions
                        item={cardItem}
                        detail={eventToCardViewModel(detailTarget as EventDetail)}
                        mode={lifecycleMode}
                        variant="expanded"
                        canEdit={canEdit}
                        canManage={canManage}
                        entityLabel="event"
                        {...expandedHandlers}
                    />
                </div>
            ) : null}
            formatAssignedTeamSuffix={(team) => `${team.isOwner ? ' ★' : ''}`}
            detailDateFields={fullDetail ? (() => {
                const venue = fullDetail.venue?.trim() || '—';
                const duration = formatEventDuration(fullDetail.eventDate, fullDetail.eventEndDate ?? fullDetail.eventDate);
                return [
                    // { label: 'Created', value: fmtDate(fullDetail.createdAt) || '—' },
                    {
                        label: 'Venue',
                        value: venue !== '—' ? (
                            <span className="exp-date-value event-venue-truncate" title={venue}>
                                {venue}
                            </span>
                        ) : '—',
                    },
                    { label: 'Capacity', value: fullDetail.capacity != null ? String(fullDetail.capacity) : 'Unlimited' },
                    { label: 'Duration', value: duration },
                ];
            })() : undefined}
            afterSections={fullDetail ? (
                <>
                    <div className="exp-card-section exp-card-section--flush">
                        <EventExpandedContent
                            eventId={fullDetail.id}
                            initialTab={initialTab}
                            allowWalkIns={fullDetail.allowWalkIns ?? false}
                            eventDate={fullDetail.eventDate}
                            eventEndDate={fullDetail.eventEndDate}
                            onReload={() => onReloadDetail?.()}
                        />
                    </div>
                    <div className="exp-card-section">
                        <div className="exp-card-section-header">
                            <Paperclip size={14} className="exp-card-section-icon" />
                            Event Files
                        </div>
                        <FileUploadZone
                            entityId={fullDetail.id}
                            filesAPI={eventFilesAPI as EntityFilesAPI}
                            memberId={user?.id}
                            existingFiles={eventFiles}
                            existingFolders={eventFolders}
                            onFileUploaded={archivedView ? () => { } : (newFile, replaced) => setEventFiles((prev) =>
                                replaced
                                    ? prev.map((f) => f.id === newFile.id ? newFile as EventFileRef : f)
                                    : [newFile as EventFileRef, ...prev]
                            )}
                            onFileRemoved={archivedView ? () => { } : (fileId) => setEventFiles((prev) => prev.filter((f) => f.id !== fileId))}
                            onFileRenamed={archivedView ? () => { } : (updated) => setEventFiles((prev) =>
                                prev.map((f) => f.id === updated.id ? { ...f, fileName: updated.fileName } : f)
                            )}
                            disabled={archivedView || !canUpload}
                        />
                    </div>
                </>
            ) : null}
        />
    );
}
