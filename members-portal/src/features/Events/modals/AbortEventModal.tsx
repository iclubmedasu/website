'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type { Id } from '@/types/backend-contracts';

interface EventModalTarget {
    id: Id;
    title: string;
}

interface AbortEventModalProps {
    event: EventModalTarget | null;
    onClose: () => void;
    onAborted: (eventId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to abort event';
}

export default function AbortEventModal({ event, onClose, onAborted }: AbortEventModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'abort';

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
            await eventsAPI.abort(event.id);
            onAborted(event.id);
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
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger"><AlertCircle /></div>
                        <h2 className="modal-title">Abort Event</h2>
                    </div>
                    <button className="modal-close-btn" onClick={handleClose} type="button" disabled={loading}><X /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    <div className="danger-info-box">
                        <p className="info-text">You are about to abort the event:</p>
                        <p className="danger-highlight">{event.title}</p>
                        <p className="info-text">This will cancel the event workflow. It can be archived later but will no longer accept registrations.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmAbortEventText" className="form-label">Type <strong>ABORT</strong> to confirm</label>
                        <input type="text" id="confirmAbortEventText" className="form-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ABORT" disabled={loading} autoComplete="off" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>
                    <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={!isConfirmed || loading}>{loading ? 'Aborting...' : 'Abort Event'}</button>
                </div>
            </div>
        </>
    );
}
