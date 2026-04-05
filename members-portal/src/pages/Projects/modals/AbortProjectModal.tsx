import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { projectsAPI } from '../../../services/api';
import type { Id } from '../../../types/backend-contracts';

interface ProjectModalTarget {
    id: Id;
    title: string;
}

interface AbortProjectModalProps {
    project: ProjectModalTarget | null;
    onClose: () => void;
    onAborted: (projectId: Id) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to abort project';
}

function AbortProjectModal({ project, onClose, onAborted }: AbortProjectModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'abort';

    const handleConfirm = async () => {
        if (!isConfirmed || !project) return;
        setLoading(true);
        setError('');
        try {
            await projectsAPI.abort(project.id);
            onAborted(project.id);
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
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertCircle />
                        </div>
                        <h2 className="modal-title">Abort Project</h2>
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

                    <div className="warning-box">
                        <p className="warning-text">
                            You are about to abort the project:
                        </p>
                        <p className="project-name-highlight">
                            {project.title}
                        </p>
                        <p className="warning-text">
                            The project will be marked as cancelled. It can later be archived.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmAbortText" className="form-label">
                            Type <strong>ABORT</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmAbortText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="ABORT"
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
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Aborting...' : 'Abort Project'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default AbortProjectModal;
