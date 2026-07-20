'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { certificatesAPI } from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';
import type { TemplateModalTarget } from './DeactivateTemplateModal';

interface DeleteTemplateModalProps {
    template: TemplateModalTarget | null;
    hasIssuedCertificates?: boolean;
    onClose: () => void;
    onDeleted: (templateId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to delete template';
}

export default function DeleteTemplateModal({
    template,
    hasIssuedCertificates = false,
    onClose,
    onDeleted,
}: DeleteTemplateModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'delete';
    const blocked = hasIssuedCertificates;

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setLoading(false);
        onClose();
    };

    const handleConfirm = async () => {
        if (!isConfirmed || !template || blocked) return;
        setLoading(true);
        setError('');
        try {
            await certificatesAPI.deleteTemplate(template.id);
            onDeleted(template.id);
            handleClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (!template) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">Delete Template</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={loading}
                    >
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}
                    <div className="danger-info-box">
                        <p className="info-text">You are about to permanently delete the template:</p>
                        <p className="danger-highlight">{template.name}</p>
                        {blocked ? (
                            <p className="info-text">
                                This template cannot be deleted while issued certificates still use it.
                                Revoke those certificates first, or deactivate the template instead.
                            </p>
                        ) : (
                            <p className="info-text">
                                This cannot be undone. The template and its background file will be
                                removed. Certificates that only referenced this template will keep their
                                content fields but lose the layout link.
                            </p>
                        )}
                    </div>
                    {!blocked && (
                        <div className="form-group">
                            <label htmlFor="confirmDeleteTemplateText" className="form-label">
                                Type <strong>DELETE</strong> to confirm
                            </label>
                            <input
                                type="text"
                                id="confirmDeleteTemplateText"
                                className="form-input"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="DELETE"
                                disabled={loading}
                                autoComplete="off"
                            />
                        </div>
                    )}
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
                    {!blocked && (
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => void handleConfirm()}
                            disabled={!isConfirmed || loading}
                        >
                            {loading ? 'Deleting…' : 'Delete Template'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
