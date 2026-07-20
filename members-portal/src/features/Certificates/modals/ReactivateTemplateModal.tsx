'use client';

import { useState } from 'react';
import { PlayCircle, X } from 'lucide-react';
import { certificatesAPI } from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';
import type { TemplateModalTarget } from './DeactivateTemplateModal';

interface ReactivateTemplateModalProps {
    template: TemplateModalTarget | null;
    onClose: () => void;
    onReactivated: (templateId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to reactivate template';
}

export default function ReactivateTemplateModal({
    template,
    onClose,
    onReactivated,
}: ReactivateTemplateModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isConfirmed = confirmText.toLowerCase() === 'reactivate';

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
            await certificatesAPI.reactivateTemplate(template.id);
            onReactivated(template.id);
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
            <div className="modal-container modal-info">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-info">
                            <PlayCircle />
                        </div>
                        <h2 className="modal-title">Reactivate Template</h2>
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
                    <div className="info-box">
                        <p className="info-text">You are about to reactivate the template:</p>
                        <p className="info-highlight">{template.name}</p>
                        <p className="info-text">
                            It will be available again when issuing new certificates.
                        </p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmReactivateTemplateText" className="form-label">
                            Type <strong>REACTIVATE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmReactivateTemplateText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="REACTIVATE"
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
                        className="btn btn-info"
                        onClick={() => void handleConfirm()}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Reactivating…' : 'Reactivate Template'}
                    </button>
                </div>
            </div>
        </>
    );
}
