'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { certificatesAPI } from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';

export interface RevokeCertificateTarget {
    id: Id;
    recipientName: string;
}

interface RevokeCertificateModalProps {
    target: RevokeCertificateTarget | null;
    onClose: () => void;
    onRevoked: (certificateId: Id) => void | Promise<void>;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to revoke certificate';
}

export default function RevokeCertificateModal({
    target,
    onClose,
    onRevoked,
}: RevokeCertificateModalProps) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleClose = () => {
        setReason('');
        setError('');
        setLoading(false);
        onClose();
    };

    const handleConfirm = async () => {
        if (!target) return;
        setLoading(true);
        setError('');
        try {
            const trimmed = reason.trim();
            await certificatesAPI.revoke(target.id, trimmed || undefined);
            await onRevoked(target.id);
            handleClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (!target) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">Revoke Certificate</h2>
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
                    {error ? <div className="error-message">{error}</div> : null}
                    <div className="danger-info-box">
                        <p className="info-text">You are about to revoke the certificate for:</p>
                        <p className="danger-highlight">{target.recipientName}</p>
                        <p className="info-text">
                            The certificate will no longer be valid for verification. This action can
                            be reviewed later on the certificate record.
                        </p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="revokeCertificateReason" className="form-label">
                            Reason (optional)
                        </label>
                        <textarea
                            id="revokeCertificateReason"
                            className="form-input"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Why is this certificate being revoked?"
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
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void handleConfirm()}
                        disabled={loading}
                    >
                        {loading ? 'Revoking…' : 'Revoke'}
                    </button>
                </div>
            </div>
        </>
    );
}
