'use client';

import {
    AlertCircle,
    Archive,
    CheckSquare,
    History,
    PauseCircle,
    Pencil,
    PlayCircle,
} from 'lucide-react';
import type { LifecycleItemTarget } from './types';
import { isProjectAborted, isProjectInactive } from './lifecycleBadges';

export interface LifecycleCardHandlers {
    onEdit?: (item: LifecycleItemTarget) => void;
    onDeactivate?: (item: LifecycleItemTarget) => void;
    onFinalize?: (item: LifecycleItemTarget) => void;
    onArchive?: (item: LifecycleItemTarget) => void;
    onReactivate?: (item: LifecycleItemTarget) => void;
    onAbort?: (item: LifecycleItemTarget) => void;
    onViewActivity?: (item: LifecycleItemTarget) => void;
}

interface LifecycleCardActionsProps extends LifecycleCardHandlers {
    item: LifecycleItemTarget;
    detail?: LifecycleItemTarget | null;
    mode: 'active' | 'archived';
    variant: 'collapsed' | 'expanded';
    canEdit: boolean;
    canManage: boolean;
    entityLabel: 'project' | 'event';
    iconSize?: number;
}

function getEntityTitle(entityLabel: 'project' | 'event', action: string): string {
    const noun = entityLabel === 'event' ? 'event' : 'project';
    return `${action} ${noun}`;
}

export default function LifecycleCardActions({
    item,
    detail,
    mode,
    variant,
    canEdit,
    canManage,
    entityLabel,
    onEdit,
    onDeactivate,
    onFinalize,
    onArchive,
    onReactivate,
    onAbort,
    onViewActivity,
    iconSize,
}: LifecycleCardActionsProps) {
    const target = detail ?? item;
    const inactive = isProjectInactive(item as Parameters<typeof isProjectInactive>[0]);
    const aborted = isProjectAborted(item as Parameters<typeof isProjectAborted>[0]);
    const isExpanded = variant === 'expanded';
    const size = iconSize ?? (isExpanded ? 13 : 14);
    const btnClass = isExpanded ? 'icon-btn icon-btn--text' : 'icon-btn';

    const stop = (handler?: (t: LifecycleItemTarget) => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        handler?.(target);
    };

    const label = (text: string) => (isExpanded ? <span className="expanded-action-label">{text}</span> : null);

    if (mode === 'archived') {
        return (
            <>
                {canManage && inactive && (
                    <>
                        <button className={`${btnClass} reactivate-btn`} title="Reactivate" type="button" onClick={stop(onReactivate)}>
                            <PlayCircle size={size} />
                            {label('Reactivate')}
                        </button>
                        <button className={`${btnClass} finalize-btn`} title="Finalize" type="button" onClick={stop(onFinalize)}>
                            <CheckSquare size={size} />
                            {label('Finalize')}
                        </button>
                        <button className={`${btnClass} deactivate-btn`} title="Abort" type="button" onClick={stop(onAbort)}>
                            <AlertCircle size={size} />
                            {label('Abort')}
                        </button>
                    </>
                )}
                {canManage && aborted && !item.isArchived && (
                    <button className={`${btnClass} archive-btn`} title="Archive" type="button" onClick={stop(onArchive)}>
                        <Archive size={size} />
                        {label('Archive')}
                    </button>
                )}
                {onViewActivity && (
                    <button className={`${btnClass} activity-btn`} title="View activity" type="button" onClick={stop(onViewActivity)}>
                        <History size={size} />
                        {label('View activity')}
                    </button>
                )}
            </>
        );
    }

    if (isExpanded && detail) {
        return (
            <>
                {detail.isFinalized ? (
                    canManage && (
                        <button className={`${btnClass} archive-btn`} title="Archive" aria-label="Archive" type="button" onClick={stop(onArchive)}>
                            <Archive size={size} />
                            {label('Archive')}
                        </button>
                    )
                ) : detail.status === 'CANCELLED' ? (
                    canManage && !detail.isArchived && (
                        <button className={`${btnClass} archive-btn`} title="Archive" aria-label="Archive" type="button" onClick={stop(onArchive)}>
                            <Archive size={size} />
                            {label('Archive')}
                        </button>
                    )
                ) : detail.isActive === false ? (
                    canManage && !detail.isArchived && (
                        <>
                            <button className={`${btnClass} reactivate-btn`} title="Reactivate" aria-label="Reactivate" type="button" onClick={stop(onReactivate)}>
                                <PlayCircle size={size} />
                                {label('Reactivate')}
                            </button>
                            <button className={`${btnClass} deactivate-btn`} title="Abort" aria-label="Abort" type="button" onClick={stop(onAbort)}>
                                <AlertCircle size={size} />
                                {label('Abort')}
                            </button>
                            <button className={`${btnClass} finalize-btn`} title="Finalize" aria-label="Finalize" type="button" onClick={stop(onFinalize)}>
                                <CheckSquare size={size} />
                                {label('Finalize')}
                            </button>
                        </>
                    )
                ) : canEdit ? (
                    <>
                        <button className={`${btnClass} edit-btn`} title={getEntityTitle(entityLabel, 'Edit')} aria-label={getEntityTitle(entityLabel, 'Edit')} type="button" onClick={stop(onEdit)}>
                            <Pencil size={size} />
                            {label('Edit')}
                        </button>
                        <button className={`${btnClass} hold-btn`} title={getEntityTitle(entityLabel, 'Hold')} aria-label={getEntityTitle(entityLabel, 'Hold')} type="button" onClick={stop(onDeactivate)}>
                            <PauseCircle size={size} />
                            {label('Hold')}
                        </button>
                        <button className={`${btnClass} deactivate-btn`} title={getEntityTitle(entityLabel, 'Abort')} aria-label={getEntityTitle(entityLabel, 'Abort')} type="button" onClick={stop(onAbort)}>
                            <AlertCircle size={size} />
                            {label('Abort')}
                        </button>
                        <button className={`${btnClass} finalize-btn`} title={getEntityTitle(entityLabel, 'Finalize')} aria-label={getEntityTitle(entityLabel, 'Finalize')} type="button" onClick={stop(onFinalize)}>
                            <CheckSquare size={size} />
                            {label('Finalize')}
                        </button>
                    </>
                ) : null}
                {onViewActivity && (
                    <button className={`${btnClass} activity-btn`} title="View activity" aria-label="View activity" type="button" onClick={stop(onViewActivity)}>
                        <History size={size} />
                        {label('View activity')}
                    </button>
                )}
            </>
        );
    }

    return (
        <>
            {item.isFinalized && canManage && (
                <button className={`${btnClass} archive-btn`} title={getEntityTitle(entityLabel, 'Archive')} type="button" onClick={stop(onArchive)}>
                    <Archive size={size} />
                </button>
            )}
            {canEdit && !item.isFinalized && item.isActive && item.status !== 'CANCELLED' && (
                <>
                    <button className={`${btnClass} edit-btn`} title={getEntityTitle(entityLabel, 'Edit')} type="button" onClick={stop(onEdit)}>
                        <Pencil size={size} />
                    </button>
                    <button className={`${btnClass} hold-btn`} title={getEntityTitle(entityLabel, 'Hold')} type="button" onClick={stop(onDeactivate)}>
                        <PauseCircle size={size} />
                    </button>
                    <button className={`${btnClass} deactivate-btn`} title={getEntityTitle(entityLabel, 'Abort')} type="button" onClick={stop(onAbort)}>
                        <AlertCircle size={size} />
                    </button>
                    <button className={`${btnClass} finalize-btn`} title={getEntityTitle(entityLabel, 'Finalize')} type="button" onClick={stop(onFinalize)}>
                        <CheckSquare size={size} />
                    </button>
                </>
            )}
            {canManage && inactive && (
                <>
                    <button className={`${btnClass} reactivate-btn`} title={getEntityTitle(entityLabel, 'Reactivate')} type="button" onClick={stop(onReactivate)}>
                        <PlayCircle size={size} />
                    </button>
                    <button className={`${btnClass} deactivate-btn`} title={getEntityTitle(entityLabel, 'Abort')} type="button" onClick={stop(onAbort)}>
                        <AlertCircle size={size} />
                    </button>
                    <button className={`${btnClass} finalize-btn`} title={getEntityTitle(entityLabel, 'Finalize')} type="button" onClick={stop(onFinalize)}>
                        <CheckSquare size={size} />
                    </button>
                </>
            )}
            {canManage && aborted && !item.isArchived && (
                <button className={`${btnClass} archive-btn`} title={getEntityTitle(entityLabel, 'Archive')} type="button" onClick={stop(onArchive)}>
                    <Archive size={size} />
                </button>
            )}
            {onViewActivity && (
                <button className={`${btnClass} activity-btn`} title="View activity" type="button" onClick={stop(onViewActivity)}>
                    <History size={size} />
                </button>
            )}
        </>
    );
}
