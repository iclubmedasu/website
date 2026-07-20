'use client';

import { useState } from 'react';
import { PauseCircle, X } from 'lucide-react';
import { certificatesAPI } from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';

export interface TemplateModalTarget {
    id: Id;
    name: string;
}

interface DeactivateTemplateModalProps {
    template: TemplateModalTarget | null;
    onClose: () => void;
    onDeactivated: (templateId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to deactivate template';
}

export default function DeactivateTemplateModal({
    template,
    onClose,
    onDeactivated,
}: DeactivateTemplateModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'deactivate';

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setLoading(false);
        onClose();
    };

    const handleConfirm = async () => {
        if (!isConfirmed || !template) return;
        setLoading(true);
        setError('');
        try {
            await certificatesAPI.deactivateTemplate(template.id);
            onDeactivated(template.id);
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
            <div className="modal-container modal-warning">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-warning">
                            <PauseCircle />
                        </div>
                        <h2 className="modal-title">Deactivate Template</h2>
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
                    <div className="warning-info-box">
                        <p className="info-text">You are about to deactivate the template:</p>
                        <p className="warning-highlight">{template.name}</p>
                        <p className="info-text">
                            It will be hidden from new certificate issuance. Existing certificates are
                            not deleted and can still use this template&apos;s layout. You can reactivate
                            it later.
                        </p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmDeactivateTemplateText" className="form-label">
                            Type <strong>DEACTIVATE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmDeactivateTemplateText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="DEACTIVATE"
                            disabled={loading}
                            autoComplete="off"
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
                    <button
                        type="button"
                        className="btn btn-warning"
                        onClick={() => void handleConfirm()}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Deactivating…' : 'Deactivate Template'}
                    </button>
                </div>
            </div>
        </>
    );
}
