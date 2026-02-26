import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { projectsAPI } from '../../../services/api';
import './DeactivateProjectModal.css';

function DeactivateProjectModal({ project, onClose, onConfirmed }) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'deactivate';

    const handleConfirm = async () => {
        if (!isConfirmed) return;
        setLoading(true);
        setError('');
        try {
            await projectsAPI.deactivate(project.id);
            onConfirmed(project.id);
            handleClose();
        } catch (err) {
            setError(err.message || 'Failed to deactivate project');
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
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">Deactivate Project</h2>
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
                            You are about to deactivate the project:
                        </p>
                        <p className="project-name-highlight">
                            {project.title}
                        </p>
                        <p className="warning-text">
                            The project will be hidden from the active list. All data is kept and the project can be reactivated later.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmDeactivateText" className="form-label">
                            Type <strong>DEACTIVATE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmDeactivateText"
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
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Deactivating…' : 'Deactivate Project'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default DeactivateProjectModal;
