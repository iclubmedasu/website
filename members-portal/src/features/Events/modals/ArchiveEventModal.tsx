'use client';

import { useState } from 'react';
import { X, Archive } from 'lucide-react';
import { eventsAPI } from '@/services/api';

interface EventModalTarget {
    id: number | string;
    title: string;
}

interface ArchiveEventModalProps {
    event: EventModalTarget | null;
    onClose: () => void;
    onArchived: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to archive event';
}

export default function ArchiveEventModal({ event, onClose, onArchived }: ArchiveEventModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'archive';

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
            await eventsAPI.archive(event.id);
            onArchived();
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
            <div className="modal-container modal-neutral">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-neutral"><Archive /></div>
                        <h2 className="modal-title">Archive Event</h2>
                    </div>
                    <button className="modal-close-btn" onClick={handleClose} type="button" disabled={loading}><X /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    <div className="neutral-info-box">
                        <p className="info-text">You are about to archive the event:</p>
                        <p className="neutral-highlight">{event.title}</p>
                        <p className="info-text">This will move the event to Past Events and it will no longer appear in the active list.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmArchiveEventText" className="form-label">Type <strong>ARCHIVE</strong> to confirm</label>
                        <input type="text" id="confirmArchiveEventText" className="form-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ARCHIVE" disabled={loading} autoComplete="off" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>
                    <button type="button" className="btn btn-neutral" onClick={handleConfirm} disabled={!isConfirmed || loading}>{loading ? 'Archiving...' : 'Archive Event'}</button>
                </div>
            </div>
        </>
    );
}
