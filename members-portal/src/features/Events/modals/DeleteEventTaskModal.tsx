'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import './RemoveEventTaskAssignmentModal.css';

interface DeleteEventTaskModalProps {
    taskTitle: string;
    assigneeCount: number;
    onConfirm: () => Promise<void> | void;
    onClose: () => void;
}

export default function DeleteEventTaskModal({
    taskTitle,
    assigneeCount,
    onConfirm,
    onClose,
}: DeleteEventTaskModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        setLoading(true);
        setError('');
        try {
            await onConfirm();
            onClose();
        } catch {
            setError('Failed to delete task. Please try again.');
            setLoading(false);
        }
    };

    const assigneeLabel = assigneeCount === 1
        ? '1 assignee'
        : `${assigneeCount} assignees`;

    return (
        <>
            <div className="modal-backdrop event-task-remove-modal-backdrop" onClick={onClose} />
            <div
                className="modal-container event-task-remove-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-event-task-title"
            >
                <div className="modal-header">
                    <h2 className="modal-title" id="delete-event-task-title">
                        Delete task?
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
                        Delete &ldquo;{taskTitle}&rdquo; and remove all {assigneeLabel} scheduled on it?
                    </p>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => void handleConfirm()} disabled={loading}>
                        {loading ? 'Deleting…' : 'Delete task'}
                    </button>
                </div>
            </div>
        </>
    );
}
