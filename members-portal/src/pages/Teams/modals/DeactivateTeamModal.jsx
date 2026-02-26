import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import './DeactivateTeamModal.css';

const DeactivateTeamModal = ({ isOpen, onClose, onConfirm, team }) => {
    const [confirmText, setConfirmText] = useState('');
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'deactivate';

    const handleConfirm = async () => {
        if (!isConfirmed) return;

        setIsDeactivating(true);
        setError('');

        try {
            await onConfirm(team.id);
            handleClose();
        } catch (err) {
            setError(err.message || 'Failed to deactivate team');
        } finally {
            setIsDeactivating(false);
        }
    };

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setIsDeactivating(false);
        onClose();
    };

    if (!isOpen || !team) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">Deactivate Team</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={isDeactivating}
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="warning-box">
                        <p className="warning-text">
                            You are about to deactivate the team:
                        </p>
                        <p className="team-name-highlight">
                            {team.name}
                        </p>
                        <p className="warning-text">
                            The team will be hidden from active lists. Members and data are kept; you can reactivate the team later.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmText" className="form-label">
                            Type <strong>DEACTIVATE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="DEACTIVATE"
                            disabled={isDeactivating}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={isDeactivating}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || isDeactivating}
                    >
                        {isDeactivating ? 'Deactivating...' : 'Deactivate Team'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default DeactivateTeamModal;