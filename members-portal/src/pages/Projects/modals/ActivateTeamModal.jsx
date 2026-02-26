import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

const ActivateTeamModal = ({ isOpen, onClose, onConfirm, team }) => {
    const [confirmText, setConfirmText] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'activate';

    const handleConfirm = async () => {
        if (!isConfirmed) return;

        setIsActivating(true);
        setError('');

        try {
            await onConfirm(team.id);
            handleClose();
        } catch (err) {
            setError(err.message || 'Failed to activate team');
        } finally {
            setIsActivating(false);
        }
    };

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setIsActivating(false);
        onClose();
    };

    if (!isOpen || !team) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-success">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-success">
                            <CheckCircle />
                        </div>
                        <h2 className="modal-title">Activate Team</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={isActivating}
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

                    <div className="info-box activate-info-box">
                        <p className="info-text">
                            You are about to activate the team:
                        </p>
                        <p className="team-name-highlight activate-highlight">
                            {team.name}
                        </p>
                        <p className="info-text">
                            The team will appear in active lists and be available for use.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmText" className="form-label">
                            Type <strong>ACTIVATE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="ACTIVATE"
                            disabled={isActivating}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={isActivating}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || isActivating}
                    >
                        {isActivating ? 'Activating...' : 'Activate Team'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ActivateTeamModal;
