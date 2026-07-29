'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Folder, FolderOpen, X } from 'lucide-react';
import {
    documentsAPI,
    type DocumentCategory,
    type DocumentFull,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';
import '../DocumentsPage.css';

interface MoveDocumentModalProps {
    document: DocumentFull | null;
    categories: DocumentCategory[];
    onClose: () => void;
    onMoved: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

const nameCollator = { numeric: true, sensitivity: 'base' } as const;

export default function MoveDocumentModal({
    document,
    categories,
    onClose,
    onMoved,
}: MoveDocumentModalProps) {
    const [destinationId, setDestinationId] = useState<Id | null | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const currentCategoryId = document?.categoryId ?? null;

    useEffect(() => {
        if (!document) return;
        setDestinationId(undefined);
        setError('');
        setLoading(false);
    }, [document]);

    const folderOptions = useMemo(
        () =>
            categories
                .filter((cat) => Number(cat.id) !== Number(currentCategoryId))
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, undefined, nameCollator)),
        [categories, currentCategoryId],
    );

    if (!document) return null;

    const showRootOption = currentCategoryId != null;

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    const canSubmit = destinationId !== undefined;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (destinationId === undefined) return;

        setLoading(true);
        setError('');
        try {
            await documentsAPI.updateDocument(document.id, {
                categoryId: destinationId,
            });
            await onMoved();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to move document'));
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
                aria-labelledby="move-document-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="move-document-title">
                            Move document
                        </h2>
                        <p className="modal-subtitle">{document.title}</p>
                    </div>
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
                <form onSubmit={(e) => void handleSubmit(e)}>
                    <div className="modal-body">
                        {error ? <div className="error-message">{error}</div> : null}
                        <p className="form-hint-text">
                            Choose a destination folder, or Root to keep the document at the top
                            level.
                        </p>

                        <div className="form-section">
                            <h3 className="form-section-title">Destination</h3>
                            {!showRootOption && folderOptions.length === 0 ? (
                                <p className="form-hint-text">No other folders to move to.</p>
                            ) : (
                                <div
                                    className="documents-explorer-grid"
                                    role="listbox"
                                    aria-label="Destination"
                                >
                                    {showRootOption ? (
                                        <div
                                            className={`documents-folder-tile${
                                                destinationId === null
                                                    ? ' documents-folder-tile--selected'
                                                    : ''
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={destinationId === null}
                                                className="documents-folder-tile-main"
                                                onClick={() =>
                                                    setDestinationId((prev) =>
                                                        prev === null ? undefined : null,
                                                    )
                                                }
                                                disabled={loading}
                                            >
                                                <FolderOpen
                                                    className="documents-folder-tile-icon"
                                                    size={36}
                                                    aria-hidden
                                                />
                                                <span className="documents-folder-tile-name">
                                                    Root
                                                </span>
                                            </button>
                                        </div>
                                    ) : null}
                                    {folderOptions.map((category) => {
                                        const selected =
                                            destinationId != null &&
                                            Number(destinationId) === Number(category.id);
                                        return (
                                            <div
                                                key={category.id}
                                                className={`documents-folder-tile${
                                                    selected
                                                        ? ' documents-folder-tile--selected'
                                                        : ''
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selected}
                                                    className="documents-folder-tile-main"
                                                    onClick={() =>
                                                        setDestinationId((prev) =>
                                                            prev != null &&
                                                            Number(prev) === Number(category.id)
                                                                ? undefined
                                                                : category.id,
                                                        )
                                                    }
                                                    disabled={loading}
                                                >
                                                    <Folder
                                                        className="documents-folder-tile-icon"
                                                        size={36}
                                                        aria-hidden
                                                    />
                                                    <span
                                                        className="documents-folder-tile-name"
                                                        title={category.name}
                                                    >
                                                        {category.name}
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !canSubmit}
                        >
                            {loading ? 'Moving…' : 'Move'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
