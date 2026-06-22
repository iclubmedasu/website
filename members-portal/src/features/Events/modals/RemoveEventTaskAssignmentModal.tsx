'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import './RemoveEventTaskAssignmentModal.css';

interface RemoveEventTaskAssignmentModalProps {
    memberName: string;
    taskTitle: string;
    onConfirm: () => Promise<void> | void;
    onClose: () => void;
}

export default function RemoveEventTaskAssignmentModal({
    memberName,
    taskTitle,
    onConfirm,
    onClose,
}: RemoveEventTaskAssignmentModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        setLoading(true);
        setError('');
        try {
            await onConfirm();
            onClose();
        } catch {
            setError('Failed to remove assignee slot. Please try again.');
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop event-task-remove-modal-backdrop" onClick={onClose} />
            <div
                className="modal-container event-task-remove-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="remove-event-task-assignment-title"
            >
                <div className="modal-header">
                    <h2 className="modal-title" id="remove-event-task-assignment-title">
                        Remove assignee slot?
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
                    <p className="event-task-remove-modal-message">
                        Remove {memberName} from &ldquo;{taskTitle}&rdquo;? Other assignees on this task will stay scheduled.
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
