'use client';

import { X } from 'lucide-react';
import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline';
import type { EventSummary } from '@/types/backend-contracts';

interface EventActivityModalProps {
    event: Pick<EventSummary, 'id' | 'title'> | null;
    onClose: () => void;
}

export default function EventActivityModal({ event, onClose }: EventActivityModalProps) {
    if (!event) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container activity-history-modal project-activity-modal">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Event Activity</h2>
                        <p className="modal-subtitle">{event.title}</p>
                    </div>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="activity-history-content">
                        <ActivityTimeline
                            title="Event History"
                            events={[]}
                            emptyMessage="No event activity yet."
                            chronology="descending"
                            contextEntity={{
                                label: 'Event',
                                name: event.title || 'Untitled event',
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
