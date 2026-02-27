import { useState, useEffect } from "react";
import { ArrowRightLeft, LogOut, X } from "lucide-react";


const MODES = {
    RETIRE: 'retire',
    HANDOVER: 'handover',
};

const RETIRE_TYPE_OPTIONS = [
    { value: 'Retirement', label: 'Retirement' },
    { value: 'Resignation', label: 'Resignation' },
];

function OfficerHandoverModal({
    isOpen,
    onClose,
    currentOfficerAssignee,
    onRetire,
    onHandover,
}) {
    const [mode, setMode] = useState(MODES.RETIRE);
    const [retireData, setRetireData] = useState({
        changeType: 'Retirement',
        changeReason: '',
        notes: '',
    });
    const [handoverData, setHandoverData] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        profilePhotoUrl: '',
        linkedInUrl: '',
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && currentOfficerAssignee) {
            setMode(MODES.RETIRE);
            setRetireData({ changeType: 'Retirement', changeReason: '', notes: '' });
            setHandoverData({
                fullName: '',
                email: '',
                phoneNumber: '',
                profilePhotoUrl: '',
                linkedInUrl: '',
            });
            setError('');
        }
    }, [isOpen, currentOfficerAssignee]);

    const handleRetireSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await onRetire({
                changeType: retireData.changeType,
                changeReason: retireData.changeReason.trim() || retireData.changeType,
                notes: retireData.notes.trim() || null,
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to record retirement');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleHandoverSubmit = async (e) => {
        e.preventDefault();
        const name = handoverData.fullName.trim();
        if (!name) {
            setError('Full name is required for the new officer.');
            return;
        }
        if (!handoverData.email.trim()) {
            setError('Email is required for the new officer.');
            return;
        }
        if (!handoverData.phoneNumber.trim()) {
            setError('Phone number is required for the new officer.');
            return;
        }
        setError('');
        setIsSubmitting(true);
        try {
            await onHandover({
                fullName: name,
                email: handoverData.email.trim(),
                phoneNumber: handoverData.phoneNumber.trim(),
                profilePhotoUrl: handoverData.profilePhotoUrl.trim() || null,
                linkedInUrl: handoverData.linkedInUrl.trim() || null,
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to complete handover');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e) => {
        if (mode === MODES.RETIRE) handleRetireSubmit(e);
        else handleHandoverSubmit(e);
    };

    if (!isOpen || !currentOfficerAssignee) return null;

    const currentName = currentOfficerAssignee.member?.fullName || 'Current officer';

    return (
        <div className="modal-backdrop officer-handover-modal" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Officer handover</h2>
                        <p className="modal-subtitle">{currentName}</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-section">
                            <h3 className="form-section-title">What do you want to do?</h3>
                            <div className="radio-group-list">
                                <label className={`radio-option-card ${mode === MODES.RETIRE ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="officerMode"
                                        value={MODES.RETIRE}
                                        checked={mode === MODES.RETIRE}
                                        onChange={() => setMode(MODES.RETIRE)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">1. Retire</span>
                                    <span className="radio-option-desc">Record the current officer leaving the role (retirement or resignation).</span>
                                </label>
                                <label className={`radio-option-card ${mode === MODES.HANDOVER ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="officerMode"
                                        value={MODES.HANDOVER}
                                        checked={mode === MODES.HANDOVER}
                                        onChange={() => setMode(MODES.HANDOVER)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">2. Handover</span>
                                    <span className="radio-option-desc">Hand the position to a new officer. Enter the new officer&apos;s details; the current officer will be retired automatically.</span>
                                </label>
                            </div>
                        </div>

                        {mode === MODES.RETIRE && (
                            <div className="form-section conditional-section">
                                <h3 className="form-section-title">Retire</h3>
                                <div className="form-group">
                                    <label htmlFor="retire-changeType" className="form-label">Type *</label>
                                    <select
                                        id="retire-changeType"
                                        className="form-input"
                                        value={retireData.changeType}
                                        onChange={(e) => setRetireData((prev) => ({ ...prev, changeType: e.target.value }))}
                                        disabled={isSubmitting}
                                    >
                                        {RETIRE_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="retire-changeReason" className="form-label">Reason</label>
                                    <textarea
                                        id="retire-changeReason"
                                        className="form-input form-textarea"
                                        value={retireData.changeReason}
                                        onChange={(e) => setRetireData((prev) => ({ ...prev, changeReason: e.target.value }))}
                                        placeholder="Optional"
                                        rows={2}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="retire-notes" className="form-label">Notes</label>
                                    <textarea
                                        id="retire-notes"
                                        className="form-input form-textarea"
                                        value={retireData.notes}
                                        onChange={(e) => setRetireData((prev) => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Optional"
                                        rows={2}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        )}

                        {mode === MODES.HANDOVER && (
                            <>
                                <div className="form-section info-section">
                                    <h3 className="form-section-title">Assignment for new officer</h3>
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
                                    <h3 className="form-section-title">New officer details</h3>
                                    <div className="form-group">
                                        <label htmlFor="handover-fullName" className="form-label">Full name *</label>
                                        <input
                                            id="handover-fullName"
                                            type="text"
                                            value={handoverData.fullName}
                                            onChange={(e) => setHandoverData((prev) => ({ ...prev, fullName: e.target.value }))}
                                            className="form-input"
                                            placeholder="e.g. Dr. Jane Smith"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="handover-email" className="form-label">Email *</label>
                                        <input
                                            id="handover-email"
                                            type="email"
                                            value={handoverData.email}
                                            onChange={(e) => setHandoverData((prev) => ({ ...prev, email: e.target.value }))}
                                            className="form-input"
                                            placeholder="e.g. jane.smith@university.edu"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="handover-phone" className="form-label">Phone number *</label>
                                        <input
                                            id="handover-phone"
                                            type="tel"
                                            value={handoverData.phoneNumber}
                                            onChange={(e) => setHandoverData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                                            className="form-input"
                                            placeholder="e.g. +1 234 567 8900"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="handover-profilePhotoUrl" className="form-label">Profile Photo URL</label>
                                        <input
                                            id="handover-profilePhotoUrl"
                                            type="url"
                                            value={handoverData.profilePhotoUrl}
                                            onChange={(e) => setHandoverData((prev) => ({ ...prev, profilePhotoUrl: e.target.value }))}
                                            className="form-input"
                                            placeholder="e.g., https://example.com/photo.jpg"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="handover-linkedInUrl" className="form-label">LinkedIn URL</label>
                                        <input
                                            id="handover-linkedInUrl"
                                            type="url"
                                            value={handoverData.linkedInUrl}
                                            onChange={(e) => setHandoverData((prev) => ({ ...prev, linkedInUrl: e.target.value }))}
                                            className="form-input"
                                            placeholder="e.g., https://linkedin.com/in/johndoe"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
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
                            {isSubmitting ? (
                                (mode === MODES.HANDOVER ? 'Completing handover...' : 'Retiring...')
                            ) : mode === MODES.HANDOVER ? (
                                <>
                                    {/* <ArrowRightLeft size={18} /> */}
                                    Complete handover
                                </>
                            ) : (
                                <>
                                    {/* <LogOut size={18} /> */}
                                    Retire
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default OfficerHandoverModal;
