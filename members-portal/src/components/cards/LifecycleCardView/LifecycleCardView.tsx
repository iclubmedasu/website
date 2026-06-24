'use client';

import { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { fmtDate, getCategoryClass, PriorityBadge, StatusBadge } from './badges';
import type { CardTeamView, CardViewModel } from './types';
import './LifecycleCardView.css';

interface CardDetailsSectionProps {
    detail: CardViewModel;
    over: boolean;
    detailExtra?: React.ReactNode;
    dateFields?: Array<{ label: string; value: React.ReactNode; overdue?: boolean }>;
}

interface CardTeamsSectionProps {
    detail: CardViewModel;
    ownerTeam: CardTeamView | null;
    teamEmptyMessage?: string;
    formatAssignedTeamSuffix?: (team: CardTeamView) => React.ReactNode;
    teamExtra?: React.ReactNode;
}

export interface LifecycleCardViewProps {
    item: CardViewModel;
    expanded: boolean;
    detail?: CardViewModel | null;
    fullDetail?: CardViewModel | null;
    detailLoading?: boolean;
    onToggle: (item: CardViewModel | null) => void;
    collapsedMeta?: React.ReactNode;
    collapsedActions?: React.ReactNode;
    collapsedFooterTrailing?: React.ReactNode;
    expandedMeta?: React.ReactNode;
    expandedActions?: React.ReactNode;
    detailExtra?: React.ReactNode;
    detailDateFields?: Array<{ label: string; value: React.ReactNode; overdue?: boolean }>;
    teamEmptyMessage?: string;
    formatAssignedTeamSuffix?: (team: CardTeamView) => React.ReactNode;
    teamExtra?: React.ReactNode;
    afterSections?: React.ReactNode;
    loadingTitle?: string;
    loadingText?: string;
    accessDeniedTitle?: string;
    accessDeniedText?: string;
}

function CardDetailsSection({ detail, over, detailExtra, dateFields }: CardDetailsSectionProps) {
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
                {(dateFields ?? [
                    { label: 'Created', value: fmtDate(detail.createdAt) || '—' },
                    { label: 'Start', value: fmtDate(detail.startDate) || '—' },
                    { label: 'Due', value: fmtDate(detail.dueDate) || '—', overdue: over },
                ]).map((field) => (
                    <div key={field.label} className="exp-date-item">
                        <span className="exp-date-label">{field.label}</span>
                        <span className={`exp-date-value${field.overdue ? ' overdue' : ''}`}>
                            {field.value}
                        </span>
                    </div>
                ))}
                {detailExtra}
            </div>
        </div>
    );
}

function CardTeamsSection({ detail, ownerTeam, teamEmptyMessage, formatAssignedTeamSuffix, teamExtra }: CardTeamsSectionProps) {
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
                        {detail.projectTeams?.map((pt, index) => (
                            <span key={pt.id ?? `${pt.teamId}-${index}`} className="badge-team">
                                {pt.team?.name}
                                {formatAssignedTeamSuffix ? formatAssignedTeamSuffix(pt) : ''}
                            </span>
                        ))}
                    </div>
                </div>
            ) : teamEmptyMessage ? (
                <span className="exp-team-empty-message">{teamEmptyMessage}</span>
            ) : null}
            {teamExtra}
        </div>
    );
}

export function LifecycleCardView({
    item,
    expanded,
    detail,
    fullDetail,
    detailLoading = false,
    onToggle,
    collapsedMeta,
    collapsedActions,
    collapsedFooterTrailing,
    expandedMeta,
    expandedActions,
    detailExtra,
    detailDateFields,
    teamEmptyMessage,
    formatAssignedTeamSuffix,
    teamExtra,
    afterSections,
    loadingTitle = 'Loading details…',
    loadingText = 'Fetching content and activity history.',
    accessDeniedTitle = 'You do not have access to this item',
    accessDeniedText = 'This item can’t be opened with your current permissions.',
}: LifecycleCardViewProps) {
    const currentDetail = detail || fullDetail;
    const over = currentDetail
        ? Boolean(currentDetail.dueDate && currentDetail.status !== 'COMPLETED' && currentDetail.status !== 'CANCELLED' && new Date(currentDetail.dueDate) < new Date())
        : Boolean(item?.dueDate && item?.status !== 'COMPLETED' && item?.status !== 'CANCELLED' && new Date(item.dueDate) < new Date());
    const ownerTeam = currentDetail?.projectTeams?.find((pt) => pt.isOwner) ?? null;
    const accessDenied = expanded && !detailLoading && !currentDetail;
    const loadingDetail = expanded && detailLoading && !currentDetail;

    useEffect(() => {
        if (!expanded) return;

        const mainContent = document.querySelector('.main-content') as HTMLElement | null;
        const prevOverflow = mainContent?.style.overflow ?? '';

        if (mainContent) {
            mainContent.style.overflow = 'hidden';
        }

        return () => {
            if (mainContent) {
                mainContent.style.overflow = prevOverflow;
            }
        };
    }, [expanded]);

    return (
        <>
            {expanded && (
                <div className="project-card-expanded-backdrop" aria-hidden="true" />
            )}
            <div
            className={`project-card${expanded ? ' project-card--expanded' : ''}`}
            onClick={() => !expanded && onToggle(item)}
        >
            {expanded && (
                <button
                    className="expanded-close-btn"
                    onClick={(e) => { e.stopPropagation(); onToggle(null); }}
                    title="Close"
                    type="button"
                >
                    <X size={16} />
                </button>
            )}

            <div className="project-card-collapsed-content">
                <div className="project-card-header">
                    <span className="project-card-title">{item.title}</span>
                    <div className="project-card-meta">
                        {collapsedMeta && (
                            <div className="project-card-meta-badges">
                                {collapsedMeta}
                            </div>
                        )}
                        {collapsedActions && (
                            <div className="project-card-meta-actions">
                                {collapsedActions}
                            </div>
                        )}
                    </div>
                </div>

                {item.description && (
                    <div className="project-card-description">{item.description}</div>
                )}

                <div className="project-card-badges">
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                </div>

                <div className="project-card-footer">
                    <div className="project-card-teams">
                        {item.projectTeams?.slice(0, 3).map((pt, index) => (
                            <span key={pt.id ?? `${pt.teamId}-${index}`} className="badge-team">{pt.team?.name}</span>
                        ))}
                        {(item.projectTeams?.length ?? 0) > 3 && (
                            <span className="badge-team">+{(item.projectTeams?.length ?? 0) - 3}</span>
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
                        <div className="expanded-title-block">
                            <div className="expanded-title-row">
                                <h2 className="project-card-title project-card-title--flush">
                                    {currentDetail.title}
                                </h2>
                                <div className="expanded-title-controls">
                                    {expandedMeta}
                                    {expandedActions}
                                </div>
                            </div>
                            {currentDetail.description && (
                                <div className="expanded-description expanded-description--spaced">
                                    {currentDetail.description}
                                </div>
                            )}
                        </div>

                        <div className="exp-card-columns">
                            <CardDetailsSection
                                detail={currentDetail}
                                over={over}
                                detailExtra={detailExtra}
                                dateFields={detailDateFields}
                            />
                            <CardTeamsSection
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
                            <div className="project-card-loading-title">{loadingTitle}</div>
                            <div className="project-card-loading-text">{loadingText}</div>
                        </div>
                    </div>
                </div>
            )}

            {accessDenied && (
                <div className="project-card-expanded-content">
                    <div className="expanded-content-wrapper">
                        <div className="project-card-access-denied">
                            <AlertCircle size={18} className="project-card-access-denied-icon" />
                            <div className="project-card-access-denied-title">{accessDeniedTitle}</div>
                            <div className="project-card-access-denied-text">{accessDeniedText}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}

export { Calendar, SquareCheckBig } from 'lucide-react';
export { fmtDate, getCategoryClass, StatusBadge, PriorityBadge } from './badges';
export {
    getArchiveOutcomeBadge,
    getLifecycleBadge,
    getWebsiteDisclosedBadge,
    isProjectAborted,
    isProjectInactive,
} from './lifecycleBadges';
export type { CardViewModel, CardTeamView } from './types';

export default LifecycleCardView;
