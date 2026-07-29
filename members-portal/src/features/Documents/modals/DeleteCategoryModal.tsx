'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { documentsAPI, type DocumentCategory } from '@/services/documentsAPI';
import '@/components/modal/modal.css';

interface DeleteCategoryModalProps {
    category: DocumentCategory | null;
    onClose: () => void;
    onDeleted: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function DeleteCategoryModal({
    category,
    onClose,
    onDeleted,
}: DeleteCategoryModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!category) return null;

    const handleClose = () => {
        if (loading) return;
        setError('');
        setLoading(false);
        onClose();
    };

    const handleConfirm = async () => {
        setLoading(true);
        setError('');
        try {
            await documentsAPI.deleteCategory(category.id);
            await onDeleted();
            onClose();
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    'Failed to delete folder. Remove or move its documents first.',
                ),
            );
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div
                className="modal-container modal-danger"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-document-folder-title"
            >
                <div className="modal-header">
                    <h2 className="modal-title" id="delete-document-folder-title">
                        Delete Folder?
                    </h2>
                    <button
                        className="modal-close-btn"
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error ? <div className="error-message">{error}</div> : null}
                    <div className="warning-box">
                        <p className="warning-text">You are about to permanently delete:</p>
                        <p className="project-name-highlight">{category.name}</p>
                        <p className="warning-text">
                            Folders with documents cannot be deleted. Move or remove those
                            documents first.
                        </p>
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
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void handleConfirm()}
                        disabled={loading}
                    >
                        {loading ? 'Deleting…' : 'Delete Folder'}
                    </button>
                </div>
            </div>
        </>
    );
}
