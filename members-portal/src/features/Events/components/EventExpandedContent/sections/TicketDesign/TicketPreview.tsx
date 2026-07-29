'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
    CLUB_TIMEZONE,
    DEFAULT_TICKET_ACCENT,
    deriveTicketPalette,
    formatEventDateRange,
    formatSessionRangeInTimezone,
} from '@iclub/shared/utils';
import { apiFetch, eventsAPI } from '@/services/api';
import type {
    EventSessionRef,
    EventTicketDesignRef,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';

const SAMPLE_ATTENDEE = 'Jane Doe';
const SAMPLE_CODE = 'SAMPLE1234';

export function useAuthorizedTicketImage(
    eventId: Id | string,
    slot: 'header' | 'footer',
    hasImage: boolean,
    cacheKey: string | null | undefined,
): string | null {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let createdUrl: string | null = null;
        setObjectUrl(null);

        if (!hasImage) return undefined;

        void (async () => {
            try {
                const response = await apiFetch(
                    eventsAPI.getTicketDesignImageDownloadUrl(eventId, slot),
                );
                if (!response.ok || cancelled) return;
                const blob = await response.blob();
                if (cancelled) return;
                createdUrl = URL.createObjectURL(blob);
                setObjectUrl(createdUrl);
            } catch {
                // Leave thumb empty on fetch failure.
            }
        })();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [cacheKey, eventId, hasImage, slot]);

    return objectUrl;
}

export function draftFromDesign(design: EventTicketDesignRef | null | undefined) {
    return {
        accentColor: design?.ticketAccentColor?.trim() || DEFAULT_TICKET_ACCENT,
        headerTitle: design?.ticketHeaderTitle ?? '',
        headerSubtitle: design?.ticketHeaderSubtitle ?? '',
        footerNote: design?.ticketFooterNote ?? '',
    };
}

export type TicketDesignDraft = ReturnType<typeof draftFromDesign>;

export interface TicketPreviewProps {
    eventTitle: string;
    eventVenue?: string | null;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    sessions?: EventSessionRef[];
    tiers?: EventTierRef[];
    draft: TicketDesignDraft;
    headerThumb?: string | null;
    footerThumb?: string | null;
    label?: string;
}

export default function TicketPreview({
    eventTitle,
    eventVenue,
    eventDate,
    eventEndDate,
    eventTimezone = CLUB_TIMEZONE,
    sessions = [],
    tiers = [],
    draft,
    headerThumb = null,
    footerThumb = null,
    label = '',
}: TicketPreviewProps) {
    const palette = useMemo(
        () => deriveTicketPalette(draft.accentColor),
        [draft.accentColor],
    );

    const previewStyle = {
        '--ticket-accent-900': palette[900],
        '--ticket-accent-800': palette[800],
        '--ticket-accent-700': palette[700],
        '--ticket-accent-600': palette[600],
        '--ticket-accent-400': palette[400],
    } as CSSProperties;

    const previewEyebrow = draft.headerSubtitle.trim() || 'Your ticket';
    const previewTitle = draft.headerTitle.trim() || eventTitle;
    const dateLabel = eventDate
        ? formatEventDateRange(eventDate, eventEndDate ?? eventDate)
        : '—';
    const sampleTier = tiers.find((tier) => tier.isActive !== false) ?? tiers[0] ?? null;
    const previewSessions = sessions.slice(0, 3);

    return (
        <div className="ticket-design-preview-wrap">
            {label ? <p className="ticket-design-preview-label">{label}</p> : null}
            <div className="ticket-design-preview" style={previewStyle}>
                {headerThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={headerThumb} alt="" className="ticket-design-preview__banner" />
                ) : null}
                <div className="ticket-design-preview__header">
                    <p className="ticket-design-preview__eyebrow">{previewEyebrow}</p>
                    <p className="ticket-design-preview__title">{previewTitle}</p>
                </div>
                <div className="ticket-design-preview__body">
                    <div className="ticket-design-preview__qr" aria-hidden>
                        <span>QR</span>
                    </div>
                    <div className="ticket-design-preview__details">
                        <div className="ticket-design-preview__row">
                            <span>Attendee</span>
                            <strong>{SAMPLE_ATTENDEE}</strong>
                        </div>
                        <div className="ticket-design-preview__row">
                            <span>Date</span>
                            <strong>{dateLabel}</strong>
                        </div>
                        {eventVenue ? (
                            <div className="ticket-design-preview__row">
                                <span>Venue</span>
                                <strong>{eventVenue}</strong>
                            </div>
                        ) : null}
                        {sampleTier ? (
                            <div className="ticket-design-preview__row">
                                <span>Tier</span>
                                <strong>{sampleTier.name}</strong>
                            </div>
                        ) : null}
                        <div className="ticket-design-preview__row">
                            <span>Code</span>
                            <strong className="ticket-design-preview__code">{SAMPLE_CODE}</strong>
                        </div>
                    </div>
                </div>
                {previewSessions.length > 0 ? (
                    <div className="ticket-design-preview__sessions">
                        <p className="ticket-design-preview__sessions-title">Your Sessions</p>
                        <ul>
                            {previewSessions.map((session) => {
                                const range = session.startDateTime && session.endDateTime
                                    ? formatSessionRangeInTimezone(
                                        session.startDateTime,
                                        session.endDateTime,
                                        eventTimezone,
                                    )
                                    : null;
                                const sessionLabel = [session.label?.trim(), range].filter(Boolean).join(' · ');
                                return (
                                    <li key={String(session.id)}>{sessionLabel || 'Session'}</li>
                                );
                            })}
                        </ul>
                    </div>
                ) : null}
                <p className="ticket-design-preview__note">
                    Present this QR code or confirmation code at check-in.
                </p>
                {draft.footerNote.trim() ? (
                    <p className="ticket-design-preview__footer-note">{draft.footerNote.trim()}</p>
                ) : null}
                {footerThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={footerThumb} alt="" className="ticket-design-preview__banner" />
                ) : null}
            </div>
        </div>
    );
}
