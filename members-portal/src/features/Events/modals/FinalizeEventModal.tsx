'use client';

import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { eventsAPI } from '@/services/api';

interface EventModalTarget {
    id: number | string;
    title: string;
}

interface FinalizeEventModalProps {
    event: EventModalTarget | null;
    onClose: () => void;
    onFinalized: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to finalize event';
}

export default function FinalizeEventModal({ event, onClose, onFinalized }: FinalizeEventModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'finalize';

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
            await eventsAPI.finalize(event.id);
            onFinalized();
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
            <div className="modal-container modal-success">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-success"><CheckCircle /></div>
                        <h2 className="modal-title">Finalize Event</h2>
                    </div>
                    <button className="modal-close-btn" onClick={handleClose} type="button" disabled={loading}><X /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    <div className="success-info-box">
                        <p className="info-text">You are about to finalize the event:</p>
                        <p className="success-highlight">{event.title}</p>
                        <p className="info-text">This will mark the event as completed. It will no longer be editable in the active workflow.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmFinalizeEventText" className="form-label">Type <strong>FINALIZE</strong> to confirm</label>
                        <input type="text" id="confirmFinalizeEventText" className="form-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="FINALIZE" disabled={loading} autoComplete="off" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>
                    <button type="button" className="btn btn-success" onClick={handleConfirm} disabled={!isConfirmed || loading}>{loading ? 'Finalizing...' : 'Finalize Event'}</button>
                </div>
            </div>
        </>
    );
}
