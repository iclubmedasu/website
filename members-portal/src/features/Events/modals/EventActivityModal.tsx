'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline';
import type { EventActivityEntry, EventSummary } from '@/types/backend-contracts';

interface EventActivityModalProps {
    event: Pick<EventSummary, 'id' | 'title'> | null;
    onClose: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to load event activity';
}

export default function EventActivityModal({ event, onClose }: EventActivityModalProps) {
    const [activity, setActivity] = useState<EventActivityEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!event?.id) return;

        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError('');
                const activityData = await eventsAPI.getActivity(event.id);

                if (cancelled) return;
                setActivity(Array.isArray(activityData) ? activityData : []);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [event?.id]);

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
                        {loading ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Loading event activity…</p>
                            </div>
                        ) : error ? (
                            <div className="error-message">{error}</div>
                        ) : (
                            <ActivityTimeline
                                title="Event History"
                                events={activity}
                                emptyMessage="No event activity yet."
                                chronology="descending"
                                contextEntity={{
                                    label: 'Event',
                                    name: event.title || 'Untitled event',
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
