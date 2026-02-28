import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ title, itemName, message, confirmLabel = 'Delete', onConfirm, onClose }) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'delete';

    const handleConfirm = async () => {
        if (!isConfirmed) return;
        setLoading(true);
        setError('');
        try {
            await onConfirm();
            handleClose();
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
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

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">{title}</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}

                    <div className="warning-box">
                        <p className="warning-text">You are about to permanently delete:</p>
                        {itemName && (
                            <p className="project-name-highlight">{itemName}</p>
                        )}
                        <p className="warning-text">{message}</p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmDeleteText" className="form-label">
                            Type <strong>DELETE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmDeleteText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="DELETE"
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
                        {loading ? 'Deleting…' : confirmLabel}
                    </button>
                </div>
            </div>
        </>
    );
}
