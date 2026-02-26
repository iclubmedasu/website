import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { teamRolesAPI } from '../../../services/api';
import './ActivateTeamModal.css';
import './ActivateRoleModal.css';

const ActivateRoleModal = ({ isOpen, onClose, onSubmit, teamId, initialRoleId }) => {
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && teamId) {
            fetchRoles();
        }
    }, [isOpen, teamId]);

    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            const data = await teamRolesAPI.getAll(teamId);
            setRoles(data);
        } catch (error) {
            setErrors({ fetch: 'Failed to load roles. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Pre-select role when initialRoleId is provided (e.g. opened from dropdown row)
    useEffect(() => {
        if (isOpen && initialRoleId && roles.length > 0 && roles.some(r => r.id === initialRoleId)) {
            setSelectedRoleId(String(initialRoleId));
        }
    }, [isOpen, initialRoleId, roles]);

    const selectedRole = roles.find(r => r.id === parseInt(selectedRoleId));
    const isConfirmed = selectedRole && confirmText.toLowerCase() === 'activate';

    const handleConfirm = async () => {
        if (!isConfirmed || !selectedRoleId) return;

        setIsSubmitting(true);
        setErrors((prev) => ({ ...prev, submit: '' }));

        try {
            await onSubmit(selectedRoleId);
            handleClose();
        } catch (err) {
            setErrors((prev) => ({ ...prev, submit: err.message || 'Failed to activate role' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedRoleId('');
        setConfirmText('');
        setRoles([]);
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    const inactiveRoles = roles.filter(r => r.isActive === false);

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-success">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-success">
                            <CheckCircle />
                        </div>
                        <h2 className="modal-title">Activate Role</h2>
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

                    {initialRoleId && isLoading && (
                        <p className="form-hint">Loading...</p>
                    )}

                    {!initialRoleId && (
                        <div className="form-group">
                            <label htmlFor="roleSelect" className="form-label">
                                Select Role to Activate *
                            </label>
                            <select
                                id="roleSelect"
                                className={`form-input ${errors.role ? 'error' : ''}`}
                                value={selectedRoleId}
                                onChange={(e) => {
                                    setSelectedRoleId(e.target.value);
                                    setConfirmText('');
                                    if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
                                }}
                                disabled={isSubmitting || isLoading}
                            >
                                <option value="">-- Choose a role --</option>
                                {inactiveRoles.length > 0 ? (
                                    inactiveRoles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.roleName}
                                        </option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoading ? 'Loading roles...' : 'No inactive roles available'}
                                    </option>
                                )}
                            </select>
                            {errors.role && (
                                <span className="field-error">{errors.role}</span>
                            )}
                        </div>
                    )}

                    {selectedRole && (!initialRoleId || !isLoading) && (
                        <>
                            <div className="info-box activate-info-box">
                                <p className="info-text">
                                    You are about to activate the role:
                                </p>
                                <p className="team-name-highlight activate-highlight">
                                    {selectedRole.roleName}
                                </p>
                                <p className="info-text">
                                    The role will appear in active lists and be available for use.
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
                        {isSubmitting ? 'Activating...' : 'Activate Role'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ActivateRoleModal;
