'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Calendar, FolderKanban, Pin } from 'lucide-react';
import './AnnouncementPost.css';

export interface AnnouncementPostAuthor {
    fullName: string;
    profilePhotoUrl?: string | null;
}

export interface AnnouncementPostEvent {
    id: number;
    title: string;
}

export interface AnnouncementPostProject {
    id: number;
    title: string;
}

export type AnnouncementPostTargetType = 'NONE' | 'EVENT' | 'PROJECT';

export interface AnnouncementPostProps {
    title: string;
    body: string;
    createdAt: string;
    createdBy: AnnouncementPostAuthor;
    targetType: AnnouncementPostTargetType;
    event?: AnnouncementPostEvent | null;
    project?: AnnouncementPostProject | null;
    isPinned?: boolean;
    isActive?: boolean;
    /** Render event/project targets as Links (feed). */
    linkTargets?: boolean;
    /** Optional response status chips (feed). */
    responseStatus?: 'AVAILABLE' | 'UNAVAILABLE' | null;
    /** Optional selected availability summary under chips (feed). */
    selectedAvailabilityLabels?: string[];
    /** Footer action bar (management or feed respond UI). */
    footer?: ReactNode;
}

export default function AnnouncementPost({
    title,
    body,
    // createdAt / createdBy — restore with signature below
    targetType,
    event = null,
    project = null,
    isPinned = false,
    isActive = true,
    linkTargets = false,
    responseStatus = null,
    selectedAvailabilityLabels,
    footer,
}: AnnouncementPostProps) {
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const bodyRef = useRef<HTMLParagraphElement>(null);

    const eventTarget =
        targetType === 'EVENT' && event
            ? {
                  className: 'badge badge-category-events-activities announcement-post-corner-target',
                  href: `/events?event=${event.id}`,
                  icon: <Calendar size={12} aria-hidden />,
                  label: event.title,
              }
            : null;

    const projectTarget =
        targetType === 'PROJECT' && project
            ? {
                  className: 'badge badge-type announcement-post-corner-target',
                  href: '/projects',
                  icon: <FolderKanban size={12} aria-hidden />,
                  label: project.title,
              }
            : null;

    const target = eventTarget ?? projectTarget;
    const showCornerBadges = isPinned || !isActive || Boolean(target);

    useLayoutEffect(() => {
        setExpanded(false);
    }, [title, body]);

    useLayoutEffect(() => {
        const titleEl = titleRef.current;
        const bodyEl = bodyRef.current;
        if (!titleEl && !bodyEl) return undefined;

        const measure = () => {
            if (expanded) return;
            const titleOverflow = titleEl
                ? titleEl.scrollHeight > titleEl.clientHeight + 1 ||
                  titleEl.scrollWidth > titleEl.clientWidth + 1
                : false;
            const bodyOverflow = bodyEl
                ? bodyEl.scrollHeight > bodyEl.clientHeight + 1
                : false;
            setCanExpand(titleOverflow || bodyOverflow);
        };

        measure();
        const observer = new ResizeObserver(measure);
        if (titleEl) observer.observe(titleEl);
        if (bodyEl) observer.observe(bodyEl);
        return () => observer.disconnect();
    }, [title, body, expanded]);

    const titleClassName = expanded
        ? 'announcement-post-title'
        : 'announcement-post-title announcement-post-title--clamp';

    const bodyClassName = expanded
        ? 'announcement-post-body'
        : 'announcement-post-body announcement-post-body--clamp';

    const targetBadge = target ? (
        linkTargets ? (
            <Link href={target.href} className={target.className} title={target.label}>
                {target.icon}
                <span>{target.label}</span>
            </Link>
        ) : (
            <span className={target.className} title={target.label}>
                {target.icon}
                <span>{target.label}</span>
            </span>
        )
    ) : null;

    const hasStatusChips =
        responseStatus === 'AVAILABLE' || responseStatus === 'UNAVAILABLE';
    const hasSelectedAvailability = Boolean(
        selectedAvailabilityLabels && selectedAvailabilityLabels.length > 0,
    );

    return (
        <article className="announcement-post">
            <div className="announcement-post-content">
                {showCornerBadges ? (
                    <div className="announcement-post-corner-badges">
                        {isPinned ? (
                            <span className="badge badge-website-disclosed">
                                <Pin size={12} />
                                Pinned
                            </span>
                        ) : null}
                        {!isActive ? (
                            <span className="badge badge-lifecycle-inactive">Inactive</span>
                        ) : null}
                        {targetBadge}
                    </div>
                ) : null}

                <div className="announcement-post-title-row">
                    <h3 ref={titleRef} className={titleClassName}>
                        {title}
                    </h3>
                </div>

                <p ref={bodyRef} className={bodyClassName}>
                    {body}
                </p>
                {canExpand ? (
                    <button
                        type="button"
                        className="announcement-post-expand-btn"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((prev) => !prev)}
                    >
                        {expanded ? 'Show less' : 'See more'}
                    </button>
                ) : null}

                {/* Signature temporarily hidden — restore formatDate import + createdAt/createdBy destructure
                <p className="announcement-post-signature">
                    — {createdBy.fullName} · {createdAt ? formatDate(createdAt) : '—'}
                </p>
                */}
            </div>

            {hasStatusChips || hasSelectedAvailability || footer ? (
                <div className="announcement-post-bottom">
                    {hasStatusChips || hasSelectedAvailability ? (
                        <div className="announcement-post-meta">
                            {hasStatusChips ? (
                                <div className="announcement-post-chips">
                                    {responseStatus === 'AVAILABLE' ? (
                                        <span className="badge badge-lifecycle-finalized">Available</span>
                                    ) : null}
                                    {responseStatus === 'UNAVAILABLE' ? (
                                        <span className="badge badge-lifecycle-inactive">Not available</span>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="announcement-post-chips" />
                            )}
                            {hasSelectedAvailability && selectedAvailabilityLabels ? (
                                <p className="announcement-post-selected-days">
                                    {selectedAvailabilityLabels.join(', ')}
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {footer ? <div className="announcement-post-footer">{footer}</div> : null}
                </div>
            ) : null}
        </article>
    );
}
