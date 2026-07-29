'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { documentsAPI } from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';

interface UploadDocumentModalProps {
    isOpen: boolean;
    categoryId?: Id | null;
    categoryName?: string;
    onClose: () => void;
    onUploaded: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function UploadDocumentModal({
    isOpen,
    categoryId = null,
    categoryName,
    onClose,
    onUploaded,
}: UploadDocumentModalProps) {
    const [title, setTitle] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isBatch = files.length > 1;
    const destinationLabel = categoryName?.trim()
        ? `Uploading to folder: ${categoryName}`
        : 'Uploading to root (no folder)';

    useEffect(() => {
        if (!isOpen) return;
        setTitle('');
        setFiles([]);
        setError('');
        setLoading(false);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const next = Array.from(event.target.files ?? []);
        setFiles(next);
        if (next.length === 1 && !title.trim()) {
            const base = next[0].name.replace(/\.[^.]+$/, '');
            setTitle(base);
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (files.length === 0) {
            setError('Please choose at least one file');
            return;
        }
        if (!isBatch && !title.trim()) {
            setError('Title is required');
            return;
        }

        setLoading(true);
        setError('');
        try {
            if (files.length === 1) {
                const formData = new FormData();
                formData.append('title', title.trim() || files[0].name.replace(/\.[^.]+$/, ''));
                if (categoryId != null) {
                    formData.append('categoryId', String(categoryId));
                }
                formData.append('file', files[0]);
                await documentsAPI.uploadDocument(formData);
            } else {
                const formData = new FormData();
                if (categoryId != null) {
                    formData.append('categoryId', String(categoryId));
                }
                const titles = files.map((file) => file.name.replace(/\.[^.]+$/, ''));
                formData.append('titles', JSON.stringify(titles));
                for (const file of files) {
                    formData.append('files', file);
                }
                await documentsAPI.uploadDocumentsBatch(formData);
            }
            await onUploaded();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to upload document'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Upload Document</h2>
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
                        <p className="form-hint-text">{destinationLabel}</p>

                        {!isBatch ? (
                            <div className="form-section">
                                <h3 className="form-section-title">Title</h3>
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
                                        required={!isBatch}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="form-section">
                                <h3 className="form-section-title">Title</h3>
                                <p className="form-hint-text">
                                    {files.length} files selected — titles will use each filename.
                                </p>
                            </div>
                        )}

                        <div className="form-section">
                            <h3 className="form-section-title">File</h3>
                            <div className="form-group">
                                <label htmlFor="documentFile" className="form-label">
                                    File{isBatch ? 's' : ''} *
                                </label>
                                <input
                                    id="documentFile"
                                    type="file"
                                    className="form-input"
                                    multiple
                                    onChange={handleFileChange}
                                    disabled={loading}
                                    required
                                />
                            </div>
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
                                ? 'Uploading…'
                                : isBatch
                                  ? `Upload ${files.length} files`
                                  : 'Upload'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
