import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { teamRolesAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

interface TeamRoleItem {
    id: Id;
    roleName: string;
    isActive?: boolean;
}

interface ActivateRoleErrors {
    fetch?: string;
    role?: string;
    submit?: string;
}

interface ActivateRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (roleId: Id) => Promise<void> | void;
    teamId?: Id | null;
    initialRoleId?: Id | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const ActivateRoleModal = ({ isOpen, onClose, onSubmit, teamId, initialRoleId }: ActivateRoleModalProps) => {
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [roles, setRoles] = useState<TeamRoleItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [errors, setErrors] = useState<ActivateRoleErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && teamId != null) {
            void fetchRoles();
        }
    }, [isOpen, teamId]);

    const fetchRoles = async () => {
        if (teamId == null) return;
        setIsLoading(true);
        try {
            const data = await teamRolesAPI.getAll(teamId);
            setRoles(Array.isArray(data) ? (data as TeamRoleItem[]) : []);
        } catch {
            setErrors({ fetch: 'Failed to load roles. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && initialRoleId != null && roles.length > 0 && roles.some((role) => role.id === initialRoleId)) {
            setSelectedRoleId(String(initialRoleId));
        }
    }, [isOpen, initialRoleId, roles]);

    const selectedRoleIdNum = selectedRoleId ? parseInt(selectedRoleId, 10) : null;
    const selectedRole = selectedRoleIdNum != null ? roles.find((role) => role.id === selectedRoleIdNum) : undefined;
    const isConfirmed = Boolean(selectedRole) && confirmText.toLowerCase() === 'activate';

    const handleConfirm = async () => {
        if (!isConfirmed || selectedRoleIdNum == null || Number.isNaN(selectedRoleIdNum)) return;

        setIsSubmitting(true);
        setErrors((prev) => ({ ...prev, submit: '' }));

        try {
            await onSubmit(selectedRoleIdNum);
            handleClose();
        } catch (err: unknown) {
            setErrors((prev) => ({ ...prev, submit: getErrorMessage(err, 'Failed to activate role') }));
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

    const inactiveRoles = roles.filter((role) => role.isActive === false);

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
                        title="Close"
                        aria-label="Close"
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

                    {initialRoleId != null && isLoading && (
                        <p className="form-hint">Loading...</p>
                    )}

                    {initialRoleId == null && (
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

                    {selectedRole && (initialRoleId == null || !isLoading) && (
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
                        className="btn btn-success"
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