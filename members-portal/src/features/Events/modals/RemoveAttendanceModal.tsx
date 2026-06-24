'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface RemoveAttendanceModalProps {
    attendeeName: string;
    dayLabel: string;
    onConfirm: () => Promise<void> | void;
    onClose: () => void;
}

export default function RemoveAttendanceModal({
    attendeeName,
    dayLabel,
    onConfirm,
    onClose,
}: RemoveAttendanceModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        setLoading(true);
        setError('');
        try {
            await onConfirm();
            onClose();
        } catch (confirmError) {
            setError(confirmError instanceof Error ? confirmError.message : 'Failed to remove attendance. Please try again.');
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="remove-attendance-title"
            >
                <div className="modal-header">
                    <h2 className="modal-title" id="remove-attendance-title">
                        Remove check-in?
                    </h2>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error ? <p className="error-message">{error}</p> : null}
                    <p>
                        Remove check-in for <strong>{dayLabel}</strong> for <strong>{attendeeName}</strong>?
                        This will undo their attendance for that day.
                    </p>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => void handleConfirm()} disabled={loading}>
                        {loading ? 'Removing…' : 'Remove'}
                    </button>
                </div>
            </div>
        </>
    );
}
