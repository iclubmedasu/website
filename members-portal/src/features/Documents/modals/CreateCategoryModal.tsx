'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { documentsAPI, type DocumentCategory } from '@/services/documentsAPI';
import '@/components/modal/modal.css';

interface CreateCategoryModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    category?: DocumentCategory | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function CreateCategoryModal({
    isOpen,
    mode,
    category = null,
    onClose,
    onSaved,
}: CreateCategoryModalProps) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isEdit = mode === 'edit';

    useEffect(() => {
        if (!isOpen) return;
        setName(isEdit && category ? category.name : '');
        setError('');
        setLoading(false);
    }, [isOpen, isEdit, category]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Folder name is required');
            return;
        }

        setLoading(true);
        setError('');
        try {
            if (isEdit) {
                if (!category) {
                    setError('Folder not found');
                    return;
                }
                await documentsAPI.updateCategory(category.id, { name: trimmed });
            } else {
                await documentsAPI.createCategory({
                    name: trimmed,
                });
            }
            await onSaved();
            onClose();
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    isEdit ? 'Failed to rename folder' : 'Failed to create folder',
                ),
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {isEdit ? 'Edit folder' : 'New Folder'}
                    </h2>
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
                        <div className="form-group">
                            <label htmlFor="documentCategoryName" className="form-label">
                                Folder name *
                            </label>
                            <input
                                id="documentCategoryName"
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={loading}
                                required
                                autoFocus
                                maxLength={120}
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
                            {loading
                                ? isEdit
                                    ? 'Saving…'
                                    : 'Creating…'
                                : isEdit
                                  ? 'Save'
                                  : 'Create Folder'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
