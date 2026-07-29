'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { documentsAPI, type DocumentFull } from '@/services/documentsAPI';
import '@/components/modal/modal.css';

interface RenameDocumentModalProps {
    document: DocumentFull | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function RenameDocumentModal({
    document,
    onClose,
    onSaved,
}: RenameDocumentModalProps) {
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!document) return;
        setTitle(document.title);
        setError('');
        setLoading(false);
    }, [document]);

    if (!document) return null;

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) {
            setError('Document title is required');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await documentsAPI.updateDocument(document.id, { title: trimmed });
            await onSaved();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to rename document'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div
                className="modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rename-document-title"
            >
                <div className="modal-header">
                    <h2 className="modal-title" id="rename-document-title">
                        Edit document
                    </h2>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={loading}
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>
                <form onSubmit={(e) => void handleSubmit(e)}>
                    <div className="modal-body">
                        {error ? <div className="error-message">{error}</div> : null}
                        <div className="form-group">
                            <label htmlFor="documentTitle" className="form-label">
                                Title *
                            </label>
                            <input
                                id="documentTitle"
                                type="text"
                                className="form-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={loading}
                                required
                                autoFocus
                                maxLength={200}
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
                            {loading ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
