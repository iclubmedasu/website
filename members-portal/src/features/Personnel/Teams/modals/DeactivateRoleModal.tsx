'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { teamRolesAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

interface TeamRoleItem {
    id: Id;
    roleName: string;
    isActive?: boolean;
}

interface DeactivateRoleErrors {
    fetch?: string;
    role?: string;
    submit?: string;
}

interface DeactivateRoleModalProps {
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

const DeactivateRoleModal = ({ isOpen, onClose, onSubmit, teamId, initialRoleId }: DeactivateRoleModalProps) => {
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [roles, setRoles] = useState<TeamRoleItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [errors, setErrors] = useState<DeactivateRoleErrors>({});
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
    const isConfirmed = Boolean(selectedRole) && confirmText.toLowerCase() === 'deactivate';

    const handleConfirm = async () => {
        if (!isConfirmed || selectedRoleIdNum == null || Number.isNaN(selectedRoleIdNum)) return;

        setIsSubmitting(true);
        setErrors((prev) => ({ ...prev, submit: '' }));

        try {
            await onSubmit(selectedRoleIdNum);
            handleClose();
        } catch (err: unknown) {
            setErrors((prev) => ({ ...prev, submit: getErrorMessage(err, 'Failed to deactivate role') }));
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

    const activeRoles = roles.filter((role) => role.isActive !== false);

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">Deactivate Role</h2>
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
                                Select Role to Deactivate *
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
                                {activeRoles.length > 0 ? (
                                    activeRoles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.roleName}
                                        </option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoading ? 'Loading roles...' : 'No active roles available'}
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
                            <div className="warning-box">
                                <p className="warning-text">
                                    You are about to deactivate the role:
                                </p>
                                <p className="team-name-highlight">
                                    {selectedRole.roleName}
                                </p>
                                <p className="warning-text">
                                    The role will be hidden from active lists. You can reactivate it later.
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
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || isSubmitting}
                    >
                        {isSubmitting ? 'Deactivating...' : 'Deactivate Role'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default DeactivateRoleModal;
