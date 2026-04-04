import { useState, useEffect } from 'react';
import { X } from 'lucide-react';


function AddOfficerModal({ isOpen, onClose, onSubmit }) {
    const [identifier, setIdentifier] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIdentifier('');
            setError('');
            setSuccess('');
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const value = identifier.trim();
        if (!value) {
            setError('Please enter an email or phone number.');
            return;
        }
        setError('');
        setSuccess('');
        setIsSubmitting(true);
        try {
            await onSubmit({ identifier: value });
            setSuccess('Officer added. They can now sign in to complete their profile.');
            setTimeout(() => onClose(), 1500);
        } catch (err) {
            setError(err.message || 'Failed to add officer');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop add-officer-modal" onClick={onClose}>
            <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Add Officer</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">{success}</div>}

                        <div className="form-section info-section">
                            <h3 className="form-section-title">Assignment to Administration</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label className="info-label">Team</label>
                                    <p className="info-value">Administration</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Role</label>
                                    <p className="info-value">Officer</p>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Officer Identifier</h3>
                            <div className="form-group">
                                <label htmlFor="officer-identifier" className="form-label">Officer Email or Phone Number *</label>
                                <input
                                    id="officer-identifier"
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. name.surname@med.asu.edu.eg or 01012345678"
                                    disabled={isSubmitting}
                                    autoFocus
                                />
                                <p className="form-hint-text">
                                    Enter their official @med.asu.edu.eg email, or their primary phone number. They will complete their profile on first sign-in.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Adding...' : 'Add Officer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddOfficerModal;
