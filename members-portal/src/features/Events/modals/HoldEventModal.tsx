'use client';

import { useState } from 'react';
import { X, PauseCircle } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type { Id } from '@/types/backend-contracts';

interface EventModalTarget {
    id: Id;
    title: string;
}

interface HoldEventModalProps {
    event: EventModalTarget | null;
    onClose: () => void;
    onHeld: (eventId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to hold event';
}

export default function HoldEventModal({ event, onClose, onHeld }: HoldEventModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'hold';

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
            await eventsAPI.deactivate(event.id);
            onHeld(event.id);
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
            <div className="modal-container modal-warning">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-warning"><PauseCircle /></div>
                        <h2 className="modal-title">Hold Event</h2>
                    </div>
                    <button className="modal-close-btn" onClick={handleClose} type="button" disabled={loading}><X /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    <div className="warning-info-box">
                        <p className="info-text">You are about to hold the event:</p>
                        <p className="warning-highlight">{event.title}</p>
                        <p className="info-text">The event will be paused and removed from the active workflow. It can be reactivated later.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmHoldEventText" className="form-label">Type <strong>HOLD</strong> to confirm</label>
                        <input type="text" id="confirmHoldEventText" className="form-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="HOLD" disabled={loading} autoComplete="off" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>
                    <button type="button" className="btn btn-warning" onClick={handleConfirm} disabled={!isConfirmed || loading}>{loading ? 'Holding...' : 'Hold Event'}</button>
                </div>
            </div>
        </>
    );
}
