'use client';

import { useState } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { announcementsAPI } from '@/services/api';
import AnnouncementPost from './AnnouncementPost';
import AnnouncementAvailabilityModal from './AnnouncementAvailabilityModal';
import {
    type AvailabilityMode,
    type AvailabilityPeriod,
    formatPeriods,
    normalizePeriods,
    targetWindow,
    usesPeriodMode,
} from './announcementAvailability';
import './AnnouncementsFeed.css';

interface AnnouncementCreatedBy {
    id: number;
    fullName: string;
    profilePhotoUrl?: string | null;
}

interface AnnouncementEvent {
    id: number;
    title: string;
    slug?: string | null;
    eventDate: string;
    eventEndDate?: string | null;
}

interface AnnouncementProject {
    id: number;
    title: string;
    slug?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
}

interface AnnouncementMyResponse {
    status: 'AVAILABLE' | 'UNAVAILABLE';
    periods?: AvailabilityPeriod[];
}

interface AnnouncementItem {
    id: number;
    title: string;
    body: string;
    targetType: 'NONE' | 'EVENT' | 'PROJECT';
    isPinned: boolean;
    createdAt: string;
    createdBy: AnnouncementCreatedBy;
    event: AnnouncementEvent | null;
    project: AnnouncementProject | null;
    myResponse: AnnouncementMyResponse | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parsePeriodEntry(raw: unknown): AvailabilityPeriod | null {
    if (!isRecord(raw)) return null;
    const start =
        typeof raw.startDate === 'string'
            ? raw.startDate
            : typeof raw.start === 'string'
              ? raw.start
              : '';
    const end =
        typeof raw.endDate === 'string'
            ? raw.endDate
            : typeof raw.end === 'string'
              ? raw.end
              : '';
    if (!start || !end) return null;
    return { start, end };
}

function availabilityContext(item: AnnouncementItem): {
    mode: AvailabilityMode;
    window: { start: string; end: string };
} | null {
    const canRespond = item.targetType === 'EVENT' || item.targetType === 'PROJECT';
    if (!canRespond) return null;

    const window = targetWindow({
        targetType: item.targetType,
        eventDate: item.event?.eventDate,
        eventEndDate: item.event?.eventEndDate,
        projectStartDate: item.project?.startDate,
        projectDueDate: item.project?.dueDate,
    });
    if (!window) return null;

    const mode: AvailabilityMode = usesPeriodMode({
        targetType: item.targetType,
        eventDate: item.event?.eventDate,
        eventEndDate: item.event?.eventEndDate,
        projectStartDate: item.project?.startDate,
        projectDueDate: item.project?.dueDate,
    })
        ? 'periods'
        : 'days';

    return { mode, window };
}

function parseAnnouncement(raw: unknown): AnnouncementItem | null {
    if (!isRecord(raw) || typeof raw.id !== 'number') return null;
    if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;

    const targetType =
        raw.targetType === 'EVENT' || raw.targetType === 'PROJECT' || raw.targetType === 'NONE'
            ? raw.targetType
            : 'NONE';

    const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';

    const createdBy = isRecord(raw.createdBy)
        ? {
              id: typeof raw.createdBy.id === 'number' ? raw.createdBy.id : 0,
              fullName:
                  typeof raw.createdBy.fullName === 'string' ? raw.createdBy.fullName : 'Unknown',
              profilePhotoUrl:
                  typeof raw.createdBy.profilePhotoUrl === 'string'
                      ? raw.createdBy.profilePhotoUrl
                      : null,
          }
        : { id: 0, fullName: 'Unknown' };

    let event: AnnouncementEvent | null = null;
    if (isRecord(raw.event) && typeof raw.event.id === 'number' && typeof raw.event.title === 'string') {
        event = {
            id: raw.event.id,
            title: raw.event.title,
            slug: typeof raw.event.slug === 'string' ? raw.event.slug : null,
            eventDate: typeof raw.event.eventDate === 'string' ? raw.event.eventDate : '',
            eventEndDate:
                typeof raw.event.eventEndDate === 'string' ? raw.event.eventEndDate : null,
        };
        if (!event.eventDate) event = null;
    }

    let project: AnnouncementProject | null = null;
    if (
        isRecord(raw.project) &&
        typeof raw.project.id === 'number' &&
        typeof raw.project.title === 'string'
    ) {
        project = {
            id: raw.project.id,
            title: raw.project.title,
            slug: typeof raw.project.slug === 'string' ? raw.project.slug : null,
            startDate: typeof raw.project.startDate === 'string' ? raw.project.startDate : null,
            dueDate: typeof raw.project.dueDate === 'string' ? raw.project.dueDate : null,
        };
    }

    let myResponse: AnnouncementMyResponse | null = null;
    if (isRecord(raw.myResponse)) {
        const status = raw.myResponse.status;
        if (status === 'AVAILABLE' || status === 'UNAVAILABLE') {
            const periods = Array.isArray(raw.myResponse.periods)
                ? normalizePeriods(
                      raw.myResponse.periods
                          .map(parsePeriodEntry)
                          .filter((p): p is AvailabilityPeriod => p !== null),
                  )
                : [];
            myResponse = { status, periods };
        }
    }

    return {
        id: raw.id,
        title: raw.title,
        body: raw.body,
        targetType,
        isPinned: Boolean(raw.isPinned),
        createdAt,
        createdBy,
        event,
        project,
        myResponse,
    };
}

function AnnouncementRow({
    item,
    onResponded,
}: {
    item: AnnouncementItem;
    onResponded: () => Promise<void>;
}) {
    const availability = availabilityContext(item);
    const canRespond = item.targetType === 'EVENT' || item.targetType === 'PROJECT';
    const [submitting, setSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    const status = item.myResponse?.status ?? null;
    const selectedPeriods = normalizePeriods(item.myResponse?.periods ?? []);
    const availabilityLabels =
        status === 'AVAILABLE' && selectedPeriods.length > 0
            ? [formatPeriods(selectedPeriods)]
            : undefined;

    async function respond(payload: {
        status: 'AVAILABLE' | 'UNAVAILABLE';
        periods?: AvailabilityPeriod[];
    }) {
        setSubmitting(true);
        setActionError(null);
        try {
            await announcementsAPI.respond(item.id, payload);
            await onResponded();
            setPickerOpen(false);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Failed to save response');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <AnnouncementPost
                title={item.title}
                body={item.body}
                createdAt={item.createdAt}
                createdBy={item.createdBy}
                targetType={item.targetType}
                event={item.event}
                project={item.project}
                isPinned={item.isPinned}
                linkTargets
                responseStatus={status}
                selectedAvailabilityLabels={availabilityLabels}
                footer={
                    canRespond ? (
                        <>
                            <div className="announcement-post-actions">
                                <button
                                    type="button"
                                    className={`announcement-post-action${status === 'AVAILABLE' ? ' announcement-post-action--selected' : ''}`}
                                    disabled={submitting}
                                    aria-pressed={status === 'AVAILABLE'}
                                    onClick={() => void respond({ status: 'AVAILABLE' })}
                                >
                                    Available
                                </button>
                                <button
                                    type="button"
                                    className={`announcement-post-action${status === 'UNAVAILABLE' ? ' announcement-post-action--selected' : ''}`}
                                    disabled={submitting}
                                    aria-pressed={status === 'UNAVAILABLE'}
                                    onClick={() => void respond({ status: 'UNAVAILABLE' })}
                                >
                                    Not available
                                </button>
                                {availability ? (
                                    <button
                                        type="button"
                                        className={`announcement-post-action${pickerOpen ? ' announcement-post-action--selected' : ''}`}
                                        disabled={submitting}
                                        aria-pressed={pickerOpen}
                                        onClick={() => setPickerOpen(true)}
                                    >
                                        {availability.mode === 'periods'
                                            ? 'Pick periods'
                                            : 'Pick days'}
                                    </button>
                                ) : null}
                            </div>

                            {actionError ? <p className="error-message">{actionError}</p> : null}
                        </>
                    ) : null
                }
            />

            {pickerOpen && availability ? (
                <AnnouncementAvailabilityModal
                    title={item.title}
                    mode={availability.mode}
                    windowStart={availability.window.start}
                    windowEnd={availability.window.end}
                    initialPeriods={selectedPeriods}
                    submitting={submitting}
                    onClose={() => setPickerOpen(false)}
                    onSave={(periods) => respond({ status: 'AVAILABLE', periods })}
                />
            ) : null}
        </>
    );
}

export default function AnnouncementsFeed() {
    const { announcements, loading, error, refetch } = useAnnouncements();
    const items = announcements
        .map(parseAnnouncement)
        .filter((item): item is AnnouncementItem => item !== null);

    return (
        <div className="card dashboard-side-card announcements-feed-card" aria-label="Announcements">
            <div className="card-header">
                <div className="card-header-left">
                    <h3 className="card-title">Announcements</h3>
                    <p className="card-subtitle">Club updates and availability requests</p>
                </div>
            </div>
            <div className="card-body">
                {loading ? (
                    <p className="loading-message">Loading…</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : items.length === 0 ? (
                    <p className="empty-message">No announcements yet</p>
                ) : (
                    <div className="announcements-feed-list">
                        {items.map((item) => (
                            <AnnouncementRow key={item.id} item={item} onResponded={refetch} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
