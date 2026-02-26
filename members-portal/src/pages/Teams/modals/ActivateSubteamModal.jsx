import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { teamSubteamsAPI } from '../../../services/api';
import './ActivateTeamModal.css';
import './ActivateSubteamModal.css';

const ActivateSubteamModal = ({ isOpen, onClose, onSubmit, teamId, initialSubteamId }) => {
    const [selectedSubteamId, setSelectedSubteamId] = useState('');
    const [subteams, setSubteams] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && teamId) {
            fetchSubteams();
        }
    }, [isOpen, teamId]);

    const fetchSubteams = async () => {
        setIsLoading(true);
        setErrors((prev) => ({ ...prev, fetch: '' }));
        try {
            const data = await teamSubteamsAPI.getAll(teamId);
            setSubteams(Array.isArray(data) ? data : []);
        } catch (error) {
            console.warn('Subteams fetch failed in ActivateSubteamModal:', error?.message);
            setSubteams([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Pre-select subteam when initialSubteamId is provided (e.g. opened from dropdown row)
    useEffect(() => {
        if (isOpen && initialSubteamId && subteams.length > 0 && subteams.some(s => s.id === initialSubteamId)) {
            setSelectedSubteamId(String(initialSubteamId));
        }
    }, [isOpen, initialSubteamId, subteams]);

    const selectedSubteam = subteams.find(s => s.id === parseInt(selectedSubteamId));
    const isConfirmed = selectedSubteam && confirmText.toLowerCase() === 'activate';

    const handleConfirm = async () => {
        if (!isConfirmed || !selectedSubteamId) return;

        setIsSubmitting(true);
        setErrors((prev) => ({ ...prev, submit: '' }));

        try {
            await onSubmit(selectedSubteamId);
            handleClose();
        } catch (err) {
            setErrors((prev) => ({ ...prev, submit: err.message || 'Failed to activate subteam' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedSubteamId('');
        setConfirmText('');
        setSubteams([]);
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    const inactiveSubteams = subteams.filter(s => s.isActive === false);

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-success">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-success">
                            <CheckCircle />
                        </div>
                        <h2 className="modal-title">Activate Subteam</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={isSubmitting}
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {errors.submit && (
                        <div className="error-message">{errors.submit}</div>
                    )}
                    {errors.fetch && (
                        <div className="error-message">{errors.fetch}</div>
                    )}

                    {initialSubteamId && isLoading && (
                        <p className="form-hint">Loading...</p>
                    )}

                    {!initialSubteamId && (
                        <div className="form-group">
                            <label htmlFor="subteamSelect" className="form-label">
                                Select Subteam to Activate *
                            </label>
                            <select
                                id="subteamSelect"
                                className={`form-input ${errors.subteam ? 'error' : ''}`}
                                value={selectedSubteamId}
                                onChange={(e) => {
                                    setSelectedSubteamId(e.target.value);
                                    setConfirmText('');
                                    if (errors.subteam) setErrors((prev) => ({ ...prev, subteam: '' }));
                                }}
                                disabled={isSubmitting || isLoading}
                            >
                                <option value="">-- Choose a subteam --</option>
                                {inactiveSubteams.length > 0 ? (
                                    inactiveSubteams.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoading ? 'Loading subteams...' : 'No inactive subteams available'}
                                    </option>
                                )}
                            </select>
                            {errors.subteam && (
                                <span className="field-error">{errors.subteam}</span>
                            )}
                        </div>
                    )}

                    {selectedSubteam && (!initialSubteamId || !isLoading) && (
                        <>
                            <div className="info-box activate-info-box">
                                <p className="info-text">
                                    You are about to activate the subteam:
                                </p>
                                <p className="team-name-highlight activate-highlight">
                                    {selectedSubteam.name}
                                </p>
                                <p className="info-text">
                                    The subteam will appear in active lists and be available for use.
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
                                    disabled={isSubmitting}
                                    autoComplete="off"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || isSubmitting}
                    >
                        {isSubmitting ? 'Activating...' : 'Activate Subteam'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ActivateSubteamModal;
