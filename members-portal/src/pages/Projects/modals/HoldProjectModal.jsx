import { useState } from 'react';
import { X, PauseCircle } from 'lucide-react';
import { projectsAPI } from '../../../services/api';

function HoldProjectModal({ project, onClose, onHeld }) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'hold';

    const handleConfirm = async () => {
        if (!isConfirmed) return;
        setLoading(true);
        setError('');
        try {
            await projectsAPI.deactivate(project.id);
            onHeld(project.id);
            handleClose();
        } catch (err) {
            setError(err.message || 'Failed to hold project');
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
            <div className="modal-container modal-warning">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-warning">
                            <PauseCircle />
                        </div>
                        <h2 className="modal-title">Hold Project</h2>
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

                    <div className="warning-info-box">
                        <p className="info-text">
                            You are about to hold the project:
                        </p>
                        <p className="warning-highlight">
                            {project.title}
                        </p>
                        <p className="info-text">
                            The project will be paused and removed from the active workflow. It can be reactivated later.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmHoldText" className="form-label">
                            Type <strong>HOLD</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmHoldText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="HOLD"
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
                        onClick={handleConfirm}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Holding…' : 'Hold Project'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default HoldProjectModal;