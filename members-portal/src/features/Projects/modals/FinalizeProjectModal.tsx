'use client';

import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { projectsAPI } from '../../../services/api';
import type { Id } from '../../../types/backend-contracts';

interface ProjectModalTarget {
    id: Id;
    title: string;
}

interface FinalizeProjectModalProps {
    project: ProjectModalTarget | null;
    onClose: () => void;
    onFinalized: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to finalize project';
}

function FinalizeProjectModal({ project, onClose, onFinalized }: FinalizeProjectModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'finalize';

    const handleConfirm = async () => {
        if (!isConfirmed || !project) return;
        setLoading(true);
        setError('');
        try {
            await projectsAPI.finalize(project.id);
            onFinalized();
            handleClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setLoading(false);
        onClose();
    };

    if (!project) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-success">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-success">
                            <CheckCircle />
                        </div>
                        <h2 className="modal-title">Finalize Project</h2>
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
                    {error && (
                        <div className="error-message">{error}</div>
                    )}

                    <div className="success-info-box">
                        <p className="info-text">
                            You are about to finalize the project:
                        </p>
                        <p className="success-highlight">
                            {project.title}
                        </p>
                        <p className="info-text">
                            This will mark the project as completed. It will no longer be editable, and no tasks can be added or modified.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmFinalizeText" className="form-label">
                            Type <strong>FINALIZE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmFinalizeText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="FINALIZE"
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
                        className="btn btn-success"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Finalizing...' : 'Finalize Project'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default FinalizeProjectModal;
