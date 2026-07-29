'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CLUB_TIMEZONE } from '@iclub/shared/utils';
import type {
    EventSessionRef,
    EventTicketDesignRef,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import TicketDesignEditModal from './TicketDesignEditModal';
import TicketPreview, {
    draftFromDesign,
    useAuthorizedTicketImage,
} from './TicketPreview';
import './TicketDesignPanel.css';

export interface TicketDesignPanelProps {
    eventId: Id | string;
    eventTitle: string;
    eventDescription?: string | null;
    eventVenue?: string | null;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    sessions?: EventSessionRef[];
    tiers?: EventTierRef[];
    ticketDesign?: EventTicketDesignRef | null;
    onReload: () => void;
}

export default function TicketDesignPanel({
    eventId,
    eventTitle,
    eventVenue,
    eventDate,
    eventEndDate,
    eventTimezone = CLUB_TIMEZONE,
    sessions = [],
    tiers = [],
    ticketDesign,
    onReload,
}: TicketDesignPanelProps) {
    const [editOpen, setEditOpen] = useState(false);

    const hasHeaderImage = Boolean(ticketDesign?.ticketHeaderImageGithubPath);
    const hasFooterImage = Boolean(ticketDesign?.ticketFooterImageGithubPath);
    const headerThumb = useAuthorizedTicketImage(
        eventId,
        'header',
        hasHeaderImage,
        ticketDesign?.ticketHeaderImageGithubSha ?? ticketDesign?.ticketHeaderImageGithubPath,
    );
    const footerThumb = useAuthorizedTicketImage(
        eventId,
        'footer',
        hasFooterImage,
        ticketDesign?.ticketFooterImageGithubSha ?? ticketDesign?.ticketFooterImageGithubPath,
    );

    const savedDraft = draftFromDesign(ticketDesign);

    return (
        <aside className="ticket-design-panel" aria-label="Ticket design">
            <div className="ticket-design-panel__header">
                <h3 className="expanded-section-title expanded-section-title--sm">Ticket design</h3>
                <button
                    type="button"
                    className="btn btn-secondary ticket-design-panel__edit-btn"
                    onClick={() => setEditOpen(true)}
                >
                    <Pencil size={16} />
                    <span>Edit</span>
                </button>
            </div>

            <TicketPreview
                eventTitle={eventTitle}
                eventVenue={eventVenue}
                eventDate={eventDate}
                eventEndDate={eventEndDate}
                eventTimezone={eventTimezone}
                sessions={sessions}
                tiers={tiers}
                draft={savedDraft}
                headerThumb={headerThumb}
                footerThumb={footerThumb}
                label=""
            />

            {editOpen ? (
                <TicketDesignEditModal
                    eventId={eventId}
                    eventTitle={eventTitle}
                    eventVenue={eventVenue}
                    eventDate={eventDate}
                    eventEndDate={eventEndDate}
                    eventTimezone={eventTimezone}
                    sessions={sessions}
                    tiers={tiers}
                    ticketDesign={ticketDesign}
                    onClose={() => setEditOpen(false)}
                    onReload={onReload}
                />
            ) : null}
        </aside>
    );
}
