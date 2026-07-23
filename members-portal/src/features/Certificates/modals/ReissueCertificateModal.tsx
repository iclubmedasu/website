'use client';

import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { certificatesAPI } from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';

export interface ReissueCertificateTarget {
    id: Id;
    recipientName: string;
}

interface ReissueCertificateModalProps {
    target: ReissueCertificateTarget | null;
    onClose: () => void;
    onReissued: (certificateId: Id) => void | Promise<void>;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Failed to reissue certificate';
}

export default function ReissueCertificateModal({
    target,
    onClose,
    onReissued,
}: ReissueCertificateModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleClose = () => {
        setError('');
        setLoading(false);
        onClose();
    };

    const handleConfirm = async () => {
        if (!target) return;
        setLoading(true);
        setError('');
        try {
            await certificatesAPI.reissue(target.id);
            await onReissued(target.id);
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
            <div className="modal-container modal-info">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-info">
                            <RefreshCw />
                        </div>
                        <h2 className="modal-title">Reissue Certificate</h2>
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
                    <div className="info-box">
                        <p className="info-text">You are about to reissue the certificate for:</p>
                        <p className="info-highlight">{target.recipientName}</p>
                        <p className="info-text">
                            The certificate will become valid again with the same verification code,
                            and a certificate email will be sent to the recipient.
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
                        className="btn btn-info"
                        onClick={() => void handleConfirm()}
                        disabled={loading}
                    >
                        {loading ? 'Reissuing…' : 'Reissue'}
                    </button>
                </div>
            </div>
        </>
    );
}
