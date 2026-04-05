import { useState } from 'react';
import { X, PlayCircle } from 'lucide-react';
import { projectsAPI } from '../../../services/api';
import type { Id } from '../../../types/backend-contracts';

interface ProjectModalTarget {
    id: Id;
    title: string;
}

interface ReactivateProjectModalProps {
    project: ProjectModalTarget | null;
    onClose: () => void;
    onReactivated: (projectId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to reactivate project';
}

function ReactivateProjectModal({ project, onClose, onReactivated }: ReactivateProjectModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'reactivate';

    const handleConfirm = async () => {
        if (!isConfirmed || !project) return;
        setLoading(true);
        setError('');
        try {
            await projectsAPI.reactivate(project.id);
            onReactivated(project.id);
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
            <div className="modal-container modal-info">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-info">
                            <PlayCircle />
                        </div>
                        <h2 className="modal-title">Reactivate Project</h2>
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

                    <div className="info-box">
                        <p className="info-text">
                            You are about to reactivate the project:
                        </p>
                        <p className="info-highlight">
                            {project.title}
                        </p>
                        <p className="info-text">
                            The project will return to the active workflow and can be edited again.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmReactivateText" className="form-label">
                            Type <strong>REACTIVATE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmReactivateText"
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
                        onClick={handleConfirm}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Reactivating...' : 'Reactivate Project'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default ReactivateProjectModal;
