'use client';

import { useState } from 'react';
import { X, PlayCircle } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type { Id } from '@/types/backend-contracts';

interface EventModalTarget {
    id: Id;
    title: string;
}

interface ReactivateEventModalProps {
    event: EventModalTarget | null;
    onClose: () => void;
    onReactivated: (eventId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to reactivate event';
}

export default function ReactivateEventModal({ event, onClose, onReactivated }: ReactivateEventModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'reactivate';

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setLoading(false);
        onClose();
    };

    const handleConfirm = async () => {
        if (!isConfirmed || !event) return;
        setLoading(true);
        setError('');
        try {
            await eventsAPI.reactivate(event.id);
            onReactivated(event.id);
            handleClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (!event) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container modal-info">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-info"><PlayCircle /></div>
                        <h2 className="modal-title">Reactivate Event</h2>
                    </div>
                    <button className="modal-close-btn" onClick={handleClose} type="button" disabled={loading}><X /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    <div className="info-box">
                        <p className="info-text">You are about to reactivate the event:</p>
                        <p className="info-highlight">{event.title}</p>
                        <p className="info-text">The event will return to the active workflow and can be edited again.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmReactivateEventText" className="form-label">Type <strong>REACTIVATE</strong> to confirm</label>
                        <input type="text" id="confirmReactivateEventText" className="form-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="REACTIVATE" disabled={loading} autoComplete="off" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>
                    <button type="button" className="btn btn-info" onClick={handleConfirm} disabled={!isConfirmed || loading}>{loading ? 'Reactivating...' : 'Reactivate Event'}</button>
                </div>
            </div>
        </>
    );
}
