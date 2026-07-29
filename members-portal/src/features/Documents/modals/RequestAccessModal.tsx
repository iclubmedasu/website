'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
    documentsAPI,
    type DocumentAccessTarget,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';

interface RequestAccessModalProps {
    targetType: DocumentAccessTarget | null;
    targetId: Id | null;
    targetTitle: string;
    onClose: () => void;
    onRequested: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function RequestAccessModal({
    targetType,
    targetId,
    targetTitle,
    onClose,
    onRequested,
}: RequestAccessModalProps) {
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (targetId == null || targetType == null) return;
        setNote('');
        setError('');
        setLoading(false);
    }, [targetId, targetType]);

    if (targetId == null || targetType == null) return null;

    const isFolder = targetType === 'category';
    const itemLabel = isFolder ? 'folder' : 'document';

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const trimmed = note.trim();
            const payload = trimmed ? { note: trimmed } : {};
            if (isFolder) {
                await documentsAPI.requestCategoryAccess(targetId, payload);
            } else {
                await documentsAPI.requestAccess(targetId, payload);
            }
            await onRequested();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to request access'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Request Access</h2>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={loading}
                    >
                        <X />
                    </button>
                </div>
                <form onSubmit={(e) => void handleSubmit(e)}>
                    <div className="modal-body">
                        {error ? <div className="error-message">{error}</div> : null}
                        <p className="form-hint-text">
                            You do not have access to <strong>{targetTitle}</strong>. If
                            approved, access is granted to your team&apos;s Head and Vice
                            together for this {itemLabel}.
                        </p>
                        <div className="form-group">
                            <label htmlFor="accessRequestNote" className="form-label">
                                Note (optional)
                            </label>
                            <textarea
                                id="accessRequestNote"
                                className="form-input"
                                rows={3}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Why do you need access?"
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Sending…' : 'Request access'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
