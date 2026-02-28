import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { teamMembersAPI, teamRolesAPI, membersAPI } from '../../../services/api';

const MODES = {
    ASSIGN: 'assign',
    LEAVE: 'leave',
};

const leaveTypeOptions = [
    { value: 'Graduation', label: 'Graduation' },
    { value: 'Expulsion', label: 'Expulsion' },
    { value: 'Resignation', label: 'Resignation' },
    { value: 'Retirement', label: 'Retirement' },
];

const AssignToTeamModal = ({
    isOpen,
    onClose,
    onSubmit,
    member,
    teams,
    roles = [],
}) => {
    const [mode, setMode] = useState(MODES.ASSIGN);
    const [formData, setFormData] = useState({
        teamId: '',
        roleId: '',
        leaveType: 'Resignation',
        changeReason: '',
        notes: '',
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Roles fetched for the selected team
    const [rolesForTeam, setRolesForTeam] = useState([]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode(MODES.ASSIGN);
            setFormData({
                teamId: '',
                roleId: '',
                leaveType: 'Resignation',
                changeReason: '',
                notes: '',
            });
            setErrors({});
            setSuccessMessage('');
            setRolesForTeam([]);
        }
    }, [isOpen, member]);

    // Fetch roles for the selected team
    const teamIdNum = formData.teamId ? parseInt(formData.teamId, 10) : null;
    useEffect(() => {
        if (!isOpen || !teamIdNum) {
            setRolesForTeam([]);
            return;
        }
        let cancelled = false;
        teamRolesAPI.getAll(teamIdNum, true)
            .then((data) => {
                if (!cancelled) setRolesForTeam(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setRolesForTeam([]);
            });
        return () => { cancelled = true; };
    }, [isOpen, teamIdNum]);

    // Clear roleId if the selected team changes and the role doesn't belong
    useEffect(() => {
        if (mode === MODES.ASSIGN && formData.teamId && !rolesForTeam.some((r) => r.id === parseInt(formData.roleId, 10))) {
            setFormData((prev) => ({ ...prev, roleId: '' }));
        }
    }, [formData.teamId, rolesForTeam, formData.roleId, mode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const setModeHandler = (newMode) => {
        setMode(newMode);
        setErrors(prev => ({ ...prev, teamId: '', roleId: '', leaveType: '', submit: '' }));
        if (newMode === MODES.ASSIGN) {
            setFormData(prev => ({ ...prev, teamId: '', roleId: '' }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (mode === MODES.ASSIGN) {
            if (!formData.teamId) newErrors.teamId = 'Team is required';
            if (!formData.roleId) newErrors.roleId = 'Role is required';
        }

        if (mode === MODES.LEAVE) {
            if (!formData.leaveType) newErrors.leaveType = 'Leave type is required';
        }

        if (formData.changeReason && formData.changeReason.trim().length > 0 && formData.changeReason.trim().length < 3) {
            newErrors.changeReason = 'Reason must be at least 3 characters if provided';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        if (!member?.memberId && !member?.id) return;

        setIsSubmitting(true);
        setSuccessMessage('');

        const memberId = member.memberId ?? member.id;
        const changeReason = formData.changeReason.trim() || null;
        const notes = formData.notes.trim() || null;

        try {
            if (mode === MODES.ASSIGN) {
                await teamMembersAPI.assign({
                    memberId,
                    teamId: parseInt(formData.teamId, 10),
                    roleId: parseInt(formData.roleId, 10),
                    changeReason: changeReason || 'Initial assignment',
                });
            } else {
                // Leave: mark as alumni via member leave endpoint
                await membersAPI.leave(memberId, {
                    leaveType: formData.leaveType,
                    changeReason: changeReason || formData.leaveType,
                    notes,
                });
            }

            setSuccessMessage(
                mode === MODES.ASSIGN
                    ? 'Member assigned to team successfully.'
                    : `Member marked as alumni (${formData.leaveType}).`
            );
            try {
                await onSubmit?.();
            } catch (err) {
                console.error('onSubmit callback:', err);
            }
            setTimeout(handleClose, 1000);
        } catch (error) {
            const msg = error?.message || 'Failed to update member';
            if (msg.includes('already assigned')) setErrors({ submit: 'Member is already assigned to this team' });
            else if (msg.includes('not found')) setErrors({ submit: 'Selected team or role not found' });
            else if (msg.includes('does not belong')) setErrors({ submit: 'Selected role does not belong to the target team' });
            else setErrors({ submit: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setMode(MODES.ASSIGN);
        setFormData({
            teamId: '',
            roleId: '',
            leaveType: 'Resignation',
            changeReason: '',
            notes: '',
        });
        setErrors({});
        setSuccessMessage('');
        setIsSubmitting(false);
        onClose();
    };

    // Dynamic title
    const getTitle = () => {
        if (mode === MODES.ASSIGN) return 'Assign to Team';
        if (mode === MODES.LEAVE) return 'Remove from Club';
        return 'Manage Member';
    };

    // Dynamic submit button
    const getSubmitLabel = () => {
        if (isSubmitting) return 'Saving...';
        if (mode === MODES.ASSIGN) return 'Assign to team';
        if (mode === MODES.LEAVE) return 'Remove';
        return 'Save';
    };

    const isLeaveMode = mode === MODES.LEAVE;

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container assign-to-team-modal">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{getTitle()}</h2>
                        {member && (
                            <p className="modal-subtitle">
                                {member.fullName || member.name}
                            </p>
                        )}
                    </div>
                    <button type="button" className="modal-close-btn" onClick={handleClose}>
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {successMessage && <div className="success-message">{successMessage}</div>}
                        {errors.submit && <div className="error-message">{errors.submit}</div>}

                        {/* Member Info */}
                        <div className="form-section info-section">
                            <h3 className="form-section-title">Member Details</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label className="info-label">Name</label>
                                    <p className="info-value">{member?.fullName || member?.name || '—'}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Status</label>
                                    <p className="info-value">Unassigned</p>
                                </div>
                            </div>
                        </div>

                        {/* Mode selector */}
                        <div className="form-section">
                            <h3 className="form-section-title">What do you want to do?</h3>
                            <p className="form-hint-text">Choose one option.</p>

                            <div className="radio-group-list">
                                <label className={`radio-option-card ${mode === MODES.ASSIGN ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="mode"
                                        value={MODES.ASSIGN}
                                        checked={mode === MODES.ASSIGN}
                                        onChange={() => setModeHandler(MODES.ASSIGN)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">1. Assign to Team</span>
                                    <span className="radio-option-desc">Assign this unassigned member to a team and role</span>
                                </label>

                                <label className={`radio-option-card ${mode === MODES.LEAVE ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="mode"
                                        value={MODES.LEAVE}
                                        checked={mode === MODES.LEAVE}
                                        onChange={() => setModeHandler(MODES.LEAVE)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">2. Graduate / Expulsion / Resignation</span>
                                    <span className="radio-option-desc">Record the member leaving the club (graduation, expulsion, resignation, or retirement)</span>
                                </label>
                            </div>
                        </div>

                        {/* ASSIGN mode form */}
                        {mode === MODES.ASSIGN && (
                            <div className="form-section conditional-section">
                                <h3 className="form-section-title">Team &amp; Role</h3>
                                <div className="form-group">
                                    <label htmlFor="assign-teamId" className="form-label">Team *</label>
                                    <select
                                        id="assign-teamId"
                                        name="teamId"
                                        className={`form-input ${errors.teamId ? 'error' : ''}`}
                                        value={formData.teamId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">— Select team —</option>
                                        {(teams || []).filter(t => t.isActive !== false).map(t => (
                                            <option key={t.id} value={String(t.id)}>{t.name}</option>
                                        ))}
                                    </select>
                                    {errors.teamId && <span className="field-error">{errors.teamId}</span>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="assign-roleId" className="form-label">Role *</label>
                                    <select
                                        id="assign-roleId"
                                        name="roleId"
                                        className={`form-input ${errors.roleId ? 'error' : ''}`}
                                        value={formData.roleId}
                                        onChange={handleChange}
                                        disabled={isSubmitting || !formData.teamId}
                                    >
                                        <option value="">— Select role —</option>
                                        {rolesForTeam.map(r => (
                                            <option key={r.id} value={String(r.id)}>{r.roleName}</option>
                                        ))}
                                    </select>
                                    {errors.roleId && <span className="field-error">{errors.roleId}</span>}
                                </div>
                            </div>
                        )}

                        {/* LEAVE mode form */}
                        {mode === MODES.LEAVE && (
                            <div className="form-section conditional-section">
                                <h3 className="form-section-title">Leave type</h3>
                                <div className="form-group">
                                    <label htmlFor="leaveType" className="form-label">Type *</label>
                                    <select
                                        id="leaveType"
                                        name="leaveType"
                                        className="form-input"
                                        value={formData.leaveType}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        {leaveTypeOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Reason & Notes (always shown) */}
                        <div className="form-section">
                            <h3 className="form-section-title">Reason &amp; Notes</h3>
                            <div className="form-group">
                                <label htmlFor="assign-reason" className="form-label">Reason for change</label>
                                <textarea
                                    id="assign-reason"
                                    name="changeReason"
                                    className={`form-input form-textarea ${errors.changeReason ? 'error' : ''}`}
                                    value={formData.changeReason}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                    disabled={isSubmitting}
                                    rows={2}
                                />
                                {errors.changeReason && <span className="field-error">{errors.changeReason}</span>}
                            </div>
                            <div className="form-group">
                                <label htmlFor="assign-notes" className="form-label">Notes</label>
                                <textarea
                                    id="assign-notes"
                                    name="notes"
                                    className="form-input form-textarea"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                    disabled={isSubmitting}
                                    rows={2}
                                />
                            </div>
                        </div>

                        <p className="form-hint">* Required where shown. Changes may be recorded in history.</p>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`btn ${isLeaveMode ? 'btn-danger' : 'btn-primary'}`}
                            disabled={isSubmitting}
                        >
                            {getSubmitLabel()}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AssignToTeamModal;
