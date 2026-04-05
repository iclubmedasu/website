import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { teamMembersAPI, teamRolesAPI, membersAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

const MODES = {
    ASSIGN: 'assign',
    LEAVE: 'leave',
} as const;

type Mode = (typeof MODES)[keyof typeof MODES];
type LeaveType = 'Graduation' | 'Expulsion' | 'Resignation' | 'Retirement';

interface ModalMember {
    memberId?: Id;
    id?: Id;
    fullName?: string;
    name?: string;
}

interface ModalTeam {
    id: Id;
    name: string;
    isActive?: boolean;
}

interface ModalRole {
    id: Id;
    roleName: string;
    maxCount?: number | null;
}

interface TeamMemberSummary {
    roleId?: Id | null;
    isActive?: boolean;
}

interface AssignFormData {
    teamId: string;
    roleId: string;
    leaveType: LeaveType;
    changeReason: string;
    notes: string;
}

interface AssignFormErrors {
    teamId?: string;
    roleId?: string;
    leaveType?: string;
    changeReason?: string;
    submit?: string;
}

interface AssignToTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: () => Promise<void> | void;
    member?: ModalMember | null;
    teams: ModalTeam[];
    roles?: ModalRole[];
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const leaveTypeOptions = [
    { value: 'Graduation', label: 'Graduation' },
    { value: 'Expulsion', label: 'Expulsion' },
    { value: 'Resignation', label: 'Resignation' },
    { value: 'Retirement', label: 'Retirement' },
] as const;

const AssignToTeamModal = ({
    isOpen,
    onClose,
    onSubmit,
    member,
    teams,
    roles = [],
}: AssignToTeamModalProps) => {
    void roles;
    const [mode, setMode] = useState<Mode>(MODES.ASSIGN);
    const [formData, setFormData] = useState<AssignFormData>({
        teamId: '',
        roleId: '',
        leaveType: 'Resignation',
        changeReason: '',
        notes: '',
    });
    const [errors, setErrors] = useState<AssignFormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Roles fetched for the selected team
    const [rolesForTeam, setRolesForTeam] = useState<ModalRole[]>([]);
    // Active team members (for maxCount validation)
    const [teamMembersForTeam, setTeamMembersForTeam] = useState<TeamMemberSummary[]>([]);

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
            setTeamMembersForTeam([]);
        }
    }, [isOpen, member]);

    // Fetch roles for the selected team
    const teamIdNum: number | null = formData.teamId ? parseInt(formData.teamId, 10) : null;
    useEffect(() => {
        if (!isOpen || !teamIdNum) {
            setRolesForTeam([]);
            return;
        }
        let cancelled = false;
        teamRolesAPI.getAll(teamIdNum, true)
            .then((data: unknown) => {
                if (!cancelled) setRolesForTeam(Array.isArray(data) ? (data as ModalRole[]) : []);
            })
            .catch(() => {
                if (!cancelled) setRolesForTeam([]);
            });
        return () => { cancelled = true; };
    }, [isOpen, teamIdNum]);

    // Fetch active team members for maxCount validation
    useEffect(() => {
        if (!isOpen || !teamIdNum) {
            setTeamMembersForTeam([]);
            return;
        }
        let cancelled = false;
        teamMembersAPI.getAll(teamIdNum, undefined, true)
            .then((data: unknown) => {
                if (!cancelled) setTeamMembersForTeam(Array.isArray(data) ? (data as TeamMemberSummary[]) : []);
            })
            .catch(() => {
                if (!cancelled) setTeamMembersForTeam([]);
            });
        return () => { cancelled = true; };
    }, [isOpen, teamIdNum]);

    // Clear roleId if the selected team changes and the role doesn't belong
    useEffect(() => {
        const selectedRoleId = parseInt(formData.roleId, 10);
        if (
            mode === MODES.ASSIGN &&
            formData.teamId &&
            (!selectedRoleId || !rolesForTeam.some((r) => r.id === selectedRoleId))
        ) {
            setFormData((prev) => ({ ...prev, roleId: '' }));
        }
    }, [formData.teamId, rolesForTeam, formData.roleId, mode]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            if (name === 'leaveType') {
                return { ...prev, leaveType: value as LeaveType };
            }
            return { ...prev, [name]: value } as AssignFormData;
        });

        const key = name as keyof AssignFormErrors;
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const setModeHandler = (newMode: Mode) => {
        setMode(newMode);
        setErrors(prev => ({ ...prev, teamId: '', roleId: '', leaveType: '', submit: '' }));
        if (newMode === MODES.ASSIGN) {
            setFormData(prev => ({ ...prev, teamId: '', roleId: '' }));
        }
    };

    const validate = (): boolean => {
        const newErrors: AssignFormErrors = {};

        if (mode === MODES.ASSIGN) {
            if (!formData.teamId) newErrors.teamId = 'Team is required';
            if (!formData.roleId) {
                newErrors.roleId = 'Role is required';
            } else {
                // Check role maxCount
                const selectedRole = rolesForTeam.find((r) => r.id === parseInt(formData.roleId, 10));
                if (selectedRole && selectedRole.maxCount != null) {
                    const currentCount = teamMembersForTeam.filter(
                        (tm) => tm.roleId === selectedRole.id && tm.isActive
                    ).length;
                    if (currentCount >= selectedRole.maxCount) {
                        newErrors.roleId = `This role already has ${currentCount}/${selectedRole.maxCount} member${selectedRole.maxCount !== 1 ? 's' : ''}`;
                    }
                }
            }
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

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        if (!member?.memberId && !member?.id) return;

        setIsSubmitting(true);
        setSuccessMessage('');

        const memberId = member.memberId ?? member.id;
        if (!memberId) {
            setIsSubmitting(false);
            return;
        }
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
        } catch (error: unknown) {
            const msg = getErrorMessage(error, 'Failed to update member');
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
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={handleClose}
                        title="Close dialog"
                        aria-label="Close dialog"
                    >
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
                                        {rolesForTeam.map(r => {
                                            const currentCount = teamMembersForTeam.filter(
                                                (tm) => tm.roleId === r.id && tm.isActive
                                            ).length;
                                            const isFull = r.maxCount != null && currentCount >= r.maxCount;
                                            const suffix = r.maxCount != null ? ` (${currentCount}/${r.maxCount})` : '';
                                            return (
                                                <option key={r.id} value={String(r.id)} disabled={isFull}>
                                                    {r.roleName}{suffix}{isFull ? ' — Full' : ''}
                                                </option>
                                            );
                                        })}
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
