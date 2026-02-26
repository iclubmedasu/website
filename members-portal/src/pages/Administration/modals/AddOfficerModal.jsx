import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import "../../Teams/TeamsPage.css";

/** Unique placeholder studentId for faculty/officer (not a student). DB still requires studentId; we use a negative unique value. */
export function officerPlaceholderStudentId() {
    return -Math.abs(Date.now() % 2147483647);
}

function AddOfficerModal({ isOpen, onClose, onSubmit }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
    const [linkedInUrl, setLinkedInUrl] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFullName('');
            setEmail('');
            setPhoneNumber('');
            setProfilePhotoUrl('');
            setLinkedInUrl('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const name = fullName.trim();
        if (!name) {
            setError('Full name is required.');
            return;
        }
        if (!email.trim()) {
            setError('Email is required.');
            return;
        }
        if (!phoneNumber.trim()) {
            setError('Phone number is required.');
            return;
        }
        setError('');
        setIsSubmitting(true);
        try {
            await onSubmit({
                fullName: name,
                email: email.trim(),
                phoneNumber: phoneNumber.trim(),
                profilePhotoUrl: profilePhotoUrl.trim() || null,
                linkedInUrl: linkedInUrl.trim() || null,
                studentId: officerPlaceholderStudentId(),
            });
            onClose();
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
                            <h3 className="form-section-title">Personal Information</h3>
                            <div className="form-group">
                                <label htmlFor="officer-fullName" className="form-label">Full name *</label>
                                <input
                                    id="officer-fullName"
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. Dr. Jane Smith"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="officer-email" className="form-label">Email *</label>
                                <input
                                    id="officer-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. jane.smith@university.edu"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="officer-phone" className="form-label">Phone number *</label>
                                <input
                                    id="officer-phone"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. +1 234 567 8900"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="officer-profilePhotoUrl" className="form-label">Profile Photo URL</label>
                                <input
                                    id="officer-profilePhotoUrl"
                                    type="url"
                                    value={profilePhotoUrl}
                                    onChange={(e) => setProfilePhotoUrl(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g., https://example.com/photo.jpg"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="officer-linkedInUrl" className="form-label">LinkedIn URL</label>
                                <input
                                    id="officer-linkedInUrl"
                                    type="url"
                                    value={linkedInUrl}
                                    onChange={(e) => setLinkedInUrl(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g., https://linkedin.com/in/johndoe"
                                    disabled={isSubmitting}
                                />
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
