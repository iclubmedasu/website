'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { teamMembersAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

const EDIT_MODES = {
    ASSIGNMENT: 'assignment',
    PROMOTION_DEMOTION: 'promotion_demotion',
    TRANSFER: 'transfer',
    LEAVE: 'leave',
} as const;

type EditMode = (typeof EDIT_MODES)[keyof typeof EDIT_MODES];
type PromoDemotionType = 'Promotion' | 'Demotion';
type LeaveType = 'Graduation' | 'Expulsion' | 'Resignation' | 'Retirement';

const promoDemotionOptions: Array<{ value: PromoDemotionType; label: string }> = [
    { value: 'Promotion', label: 'Promotion' },
    { value: 'Demotion', label: 'Demotion' },
];

const leaveTypeOptions: Array<{ value: LeaveType; label: string }> = [
    { value: 'Graduation', label: 'Graduation' },
    { value: 'Expulsion', label: 'Expulsion' },
    { value: 'Resignation', label: 'Resignation' },
    { value: 'Retirement', label: 'Retirement' },
];

const DEFAULT_MEMBER_SYSTEM_ROLE_KEY = 3;

interface ModalMember {
    id?: Id;
    memberId?: Id;
    fullName?: string;
    name?: string;
}

interface TeamAssignment {
    id: Id | string | null;
    memberId?: Id;
    teamId: Id | null;
    roleId: Id | null;
    subteamId?: Id | null;
    joinedDate?: string | null;
    isActive?: boolean;
    leftDate?: string | null;
}

interface ModalTeam {
    id: Id;
    name: string;
    isActive?: boolean;
}

interface ModalRole {
    id: Id;
    teamId: Id;
    roleName: string;
    maxCount?: number | null;
    systemRoleKey?: number | null;
    isActive?: boolean;
}

interface ModalSubteam {
    id: Id;
    teamId: Id;
    name: string;
    isActive?: boolean;
}

interface TeamMemberSummary {
    roleId?: Id | null;
    isActive?: boolean;
}

interface EditMembersFormData {
    newTeamId: string;
    newRoleId: string;
    newSubteamId: string;
    promoDemotionType: PromoDemotionType;
    leaveType: LeaveType;
    changeReason: string;
    notes: string;
}

interface EditMembersErrors {
    newTeamId?: string;
    newRoleId?: string;
    newSubteamId?: string;
    leaveType?: string;
    changeReason?: string;
    notes?: string;
    submit?: string;
}

interface EditMembersSubmitPayload {
    member: ModalMember;
    changes: {
        editMode: EditMode;
        formData: EditMembersFormData;
    };
}

interface EditMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (payload: EditMembersSubmitPayload) => Promise<void> | void;
    member?: ModalMember | null;
    currentTeamAssignment?: TeamAssignment | null;
    teams: ModalTeam[];
    roles: ModalRole[];
    subteams?: ModalSubteam[];
    occupiedRoleIds?: Id[];
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const EditMembersModal = ({
    isOpen,
    onClose,
    onSubmit,
    member,
    currentTeamAssignment,
    teams,
    roles,
    subteams = [],
}: EditMembersModalProps) => {
    const [editMode, setEditMode] = useState<EditMode>(EDIT_MODES.ASSIGNMENT);
    const [formData, setFormData] = useState<EditMembersFormData>({
        newTeamId: '',
        newRoleId: '',
        newSubteamId: '',
        promoDemotionType: 'Promotion',
        leaveType: 'Resignation',
        changeReason: '',
        notes: '',
    });

    const [errors, setErrors] = useState<EditMembersErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [availableRoles, setAvailableRoles] = useState<ModalRole[]>([]);
    const [availableSubteams, setAvailableSubteams] = useState<ModalSubteam[]>([]);
    const [teamMembersForTeam, setTeamMembersForTeam] = useState<TeamMemberSummary[]>([]);

    const currentTeamId = currentTeamAssignment?.teamId ?? null;

    useEffect(() => {
        if (currentTeamId == null) {
            setAvailableRoles([]);
            setAvailableSubteams([]);
            return;
        }

        setAvailableRoles(roles.filter((role) => role.teamId === currentTeamId));
        setAvailableSubteams(subteams.filter((subteam) => subteam.teamId === currentTeamId));
    }, [currentTeamId, roles, subteams]);

    useEffect(() => {
        if (!isOpen || currentTeamId == null) {
            setTeamMembersForTeam([]);
            return;
        }

        let cancelled = false;
        teamMembersAPI.getAll(currentTeamId, undefined, true)
            .then((data: unknown) => {
                if (!cancelled) {
                    setTeamMembersForTeam(Array.isArray(data) ? (data as TeamMemberSummary[]) : []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTeamMembersForTeam([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, currentTeamId]);

    useEffect(() => {
        if (isOpen && member && currentTeamAssignment) {
            setEditMode(EDIT_MODES.ASSIGNMENT);
            setFormData({
                newTeamId: '',
                newRoleId: currentTeamAssignment.roleId != null ? String(currentTeamAssignment.roleId) : '',
                newSubteamId: currentTeamAssignment.subteamId != null ? String(currentTeamAssignment.subteamId) : '',
                promoDemotionType: 'Promotion',
                leaveType: 'Resignation',
                changeReason: '',
                notes: '',
            });
            setErrors({});
            setSuccessMessage('');
        }
    }, [isOpen, member, currentTeamAssignment]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        } as EditMembersFormData));

        const key = name as keyof EditMembersErrors;
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const setMode = (mode: EditMode) => {
        setEditMode(mode);
        setErrors((prev) => ({ ...prev, newTeamId: '', newRoleId: '', newSubteamId: '', leaveType: '', submit: '' }));

        if (mode === EDIT_MODES.TRANSFER) {
            setFormData((prev) => ({ ...prev, newTeamId: '', newRoleId: '', newSubteamId: '' }));
        } else if (mode === EDIT_MODES.ASSIGNMENT || mode === EDIT_MODES.PROMOTION_DEMOTION) {
            setFormData((prev) => ({
                ...prev,
                newRoleId: currentTeamAssignment?.roleId != null ? String(currentTeamAssignment.roleId) : '',
                newSubteamId: currentTeamAssignment?.subteamId != null ? String(currentTeamAssignment.subteamId) : '',
            }));
        }
    };

    const validate = (): boolean => {
        const newErrors: EditMembersErrors = {};

        const checkMaxCount = (roleIdStr: string): string | null => {
            const newRoleId = parseInt(roleIdStr, 10);
            if (newRoleId !== currentTeamAssignment?.roleId) {
                const selectedRole = availableRoles.find((role) => role.id === newRoleId);
                if (selectedRole && selectedRole.maxCount != null) {
                    const currentCount = teamMembersForTeam.filter(
                        (teamMember) => teamMember.roleId === selectedRole.id && teamMember.isActive
                    ).length;
                    if (currentCount >= selectedRole.maxCount) {
                        return `This role already has ${currentCount}/${selectedRole.maxCount} member${selectedRole.maxCount !== 1 ? 's' : ''}`;
                    }
                }
            }
            return null;
        };

        if (editMode === EDIT_MODES.ASSIGNMENT) {
            if (!formData.newRoleId) {
                newErrors.newRoleId = 'Role is required';
            } else {
                const err = checkMaxCount(formData.newRoleId);
                if (err) newErrors.newRoleId = err;
            }
        }

        if (editMode === EDIT_MODES.PROMOTION_DEMOTION) {
            if (formData.newRoleId && formData.newRoleId !== String(currentTeamAssignment?.roleId ?? '')) {
                const err = checkMaxCount(formData.newRoleId);
                if (err) newErrors.newRoleId = err;
            }
        }

        if (editMode === EDIT_MODES.TRANSFER) {
            if (!formData.newTeamId) {
                newErrors.newTeamId = 'Target team is required';
            } else if (formData.newTeamId === String(currentTeamId ?? '')) {
                newErrors.newTeamId = 'Select a different team to transfer to';
            }
        }

        if (formData.changeReason && formData.changeReason.trim().length > 0 && formData.changeReason.trim().length < 3) {
            newErrors.changeReason = 'Reason must be at least 3 characters if provided';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const getDefaultMemberRoleIdForTeam = (teamId: string): Id | null => {
        const teamIdNum = parseInt(teamId, 10);
        const memberRole = roles.find(
            (role) => role.teamId === teamIdNum && role.systemRoleKey === DEFAULT_MEMBER_SYSTEM_ROLE_KEY
        );
        return memberRole ? memberRole.id : null;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate() || !member || !currentTeamAssignment) return;

        if (currentTeamAssignment.id == null || currentTeamAssignment.roleId == null) {
            setErrors({ submit: 'Current assignment data is incomplete' });
            return;
        }

        const assignmentId = currentTeamAssignment.id;
        const assignmentRoleId = currentTeamAssignment.roleId;

        setIsSubmitting(true);
        setSuccessMessage('');

        const changeReason = formData.changeReason.trim() || null;
        const notes = formData.notes.trim() || null;

        try {
            if (editMode === EDIT_MODES.ASSIGNMENT) {
                const newSubteamIdParam = formData.newSubteamId ? parseInt(formData.newSubteamId, 10) : null;
                await teamMembersAPI.changeRole(assignmentId, {
                    newRoleId: parseInt(formData.newRoleId, 10),
                    newSubteamId: newSubteamIdParam,
                    changeType: 'Assignment',
                    changeReason: changeReason || 'Assignment update',
                    notes,
                });
            } else if (editMode === EDIT_MODES.PROMOTION_DEMOTION) {
                const newRoleId = formData.newRoleId ? parseInt(formData.newRoleId, 10) : assignmentRoleId;
                const newSubteamIdParam = formData.newSubteamId
                    ? parseInt(formData.newSubteamId, 10)
                    : (currentTeamAssignment.subteamId ?? null);
                await teamMembersAPI.changeRole(assignmentId, {
                    newRoleId,
                    newSubteamId: newSubteamIdParam,
                    changeType: formData.promoDemotionType,
                    changeReason: changeReason || formData.promoDemotionType,
                    notes,
                });
            } else if (editMode === EDIT_MODES.TRANSFER) {
                const newTeamId = parseInt(formData.newTeamId, 10);
                const defaultRoleId = getDefaultMemberRoleIdForTeam(formData.newTeamId);
                if (!defaultRoleId) {
                    setErrors({ submit: 'Default Member role not found for the selected team' });
                    setIsSubmitting(false);
                    return;
                }
                await teamMembersAPI.transfer(assignmentId, {
                    newTeamId,
                    newRoleId: defaultRoleId,
                    newSubteamId: null,
                    changeType: 'Transfer',
                    changeReason: changeReason || 'Transfer',
                    notes,
                });
            } else {
                await teamMembersAPI.updateStatus(assignmentId, {
                    isActive: false,
                    changeType: formData.leaveType,
                    changeReason: changeReason || formData.leaveType,
                    notes,
                });
            }

            setSuccessMessage('Member updated successfully.');
            try {
                await onSubmit?.({ member, changes: { editMode, formData } });
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
        setEditMode(EDIT_MODES.ASSIGNMENT);
        setFormData({
            newTeamId: currentTeamAssignment?.teamId != null ? String(currentTeamAssignment.teamId) : '',
            newRoleId: currentTeamAssignment?.roleId != null ? String(currentTeamAssignment.roleId) : '',
            newSubteamId: currentTeamAssignment?.subteamId != null ? String(currentTeamAssignment.subteamId) : '',
            promoDemotionType: 'Promotion',
            leaveType: 'Resignation',
            changeReason: '',
            notes: '',
        });
        setErrors({});
        setSuccessMessage('');
        setIsSubmitting(false);
        onClose();
    };

    const currentTeam = currentTeamId ? teams.find((team) => team.id === currentTeamId) : null;
    const currentRole = currentTeamAssignment?.roleId != null
        ? roles.find((role) => role.id === currentTeamAssignment.roleId)
        : null;
    const currentSubteam = currentTeamAssignment?.subteamId != null && subteams.length
        ? subteams.find((subteam) => subteam.id === currentTeamAssignment.subteamId)
        : null;

    const getTitle = () => {
        if (editMode === EDIT_MODES.ASSIGNMENT) return 'Edit Assignment';
        if (editMode === EDIT_MODES.PROMOTION_DEMOTION) return 'Promotion / Demotion';
        if (editMode === EDIT_MODES.TRANSFER) return 'Transfer Member';
        if (editMode === EDIT_MODES.LEAVE) return 'Remove from Club';
        return 'Edit Member';
    };

    const getSubmitLabel = () => {
        if (isSubmitting) return 'Updating...';
        if (editMode === EDIT_MODES.ASSIGNMENT) return 'Update member';
        if (editMode === EDIT_MODES.PROMOTION_DEMOTION) return 'Update member';
        if (editMode === EDIT_MODES.TRANSFER) return 'Transfer';
        if (editMode === EDIT_MODES.LEAVE) return 'Remove';
        return 'Update member';
    };

    const isLeaveMode = editMode === EDIT_MODES.LEAVE;
    const memberDisplayName = member?.fullName || member?.name || 'Member';

    if (!isOpen || !member || !currentTeamAssignment) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{getTitle()}</h2>
                        <p className="modal-subtitle">
                            {memberDisplayName} - {currentTeam?.name} - {currentRole?.roleName}
                        </p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={handleClose} title="Close" aria-label="Close">
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {successMessage && <div className="success-message">{successMessage}</div>}
                        {errors.submit && <div className="error-message">{errors.submit}</div>}

                        <div className="form-section info-section">
                            <h3 className="form-section-title">Current Assignment</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label className="info-label">Team</label>
                                    <p className="info-value">{currentTeam?.name}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Current Role</label>
                                    <p className="info-value">{currentRole?.roleName}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Current Subteam</label>
                                    <p className="info-value">{currentSubteam?.name || 'None'}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Status</label>
                                    <p className="info-value">{currentTeamAssignment.isActive !== false ? 'Active' : 'Inactive'}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Joined Date</label>
                                    <p className="info-value">
                                        {currentTeamAssignment.joinedDate && !Number.isNaN(new Date(currentTeamAssignment.joinedDate).getTime())
                                            ? new Date(currentTeamAssignment.joinedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                            : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">What do you want to do?</h3>
                            <p className="form-hint-text">Choose one option.</p>

                            <div className="radio-group-list">
                                <label className={`radio-option-card ${editMode === EDIT_MODES.ASSIGNMENT ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="editMode"
                                        value={EDIT_MODES.ASSIGNMENT}
                                        checked={editMode === EDIT_MODES.ASSIGNMENT}
                                        onChange={() => setMode(EDIT_MODES.ASSIGNMENT)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">1. Assignment</span>
                                    <span className="radio-option-desc">Assign the member to a role and subteam within the same team</span>
                                </label>

                                <label className={`radio-option-card ${editMode === EDIT_MODES.PROMOTION_DEMOTION ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="editMode"
                                        value={EDIT_MODES.PROMOTION_DEMOTION}
                                        checked={editMode === EDIT_MODES.PROMOTION_DEMOTION}
                                        onChange={() => setMode(EDIT_MODES.PROMOTION_DEMOTION)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">2. Promotion / Demotion</span>
                                    <span className="radio-option-desc">Promote or demote the member; optionally assign to a different role and subteam</span>
                                </label>

                                <label className={`radio-option-card ${editMode === EDIT_MODES.TRANSFER ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="editMode"
                                        value={EDIT_MODES.TRANSFER}
                                        checked={editMode === EDIT_MODES.TRANSFER}
                                        onChange={() => setMode(EDIT_MODES.TRANSFER)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">3. Transfer</span>
                                    <span className="radio-option-desc">Transfer the member to another team as Member with no subteam</span>
                                </label>

                                <label className={`radio-option-card ${editMode === EDIT_MODES.LEAVE ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="editMode"
                                        value={EDIT_MODES.LEAVE}
                                        checked={editMode === EDIT_MODES.LEAVE}
                                        onChange={() => setMode(EDIT_MODES.LEAVE)}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">4. Graduate / Expulsion / Resignation</span>
                                    <span className="radio-option-desc">Record the member leaving the team (graduation, expulsion, resignation, or retirement)</span>
                                </label>
                            </div>
                        </div>

                        {editMode === EDIT_MODES.ASSIGNMENT && (
                            <div className="form-section conditional-section">
                                <h3 className="form-section-title">Role &amp; Subteam</h3>
                                <div className="form-group">
                                    <label htmlFor="newRoleId" className="form-label">Role *</label>
                                    <select
                                        id="newRoleId"
                                        name="newRoleId"
                                        className={`form-input ${errors.newRoleId ? 'error' : ''}`}
                                        value={formData.newRoleId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">-- Select a role --</option>
                                        {availableRoles.map((role) => {
                                            const isOwnRole = role.id === currentTeamAssignment?.roleId;
                                            const count = teamMembersForTeam.filter((teamMember) => teamMember.roleId === role.id && teamMember.isActive).length;
                                            const effectiveCount = isOwnRole ? Math.max(0, count - 1) : count;
                                            const isFull = role.maxCount != null && effectiveCount >= role.maxCount;
                                            const label = role.maxCount != null
                                                ? `${role.roleName} (${effectiveCount}/${role.maxCount})${isFull ? ' - Full' : ''}`
                                                : role.roleName;
                                            return <option key={role.id} value={role.id} disabled={isFull}>{label}</option>;
                                        })}
                                    </select>
                                    {errors.newRoleId && <span className="field-error">{errors.newRoleId}</span>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="newSubteamId" className="form-label">Subteam (optional)</label>
                                    <select
                                        id="newSubteamId"
                                        name="newSubteamId"
                                        className="form-input"
                                        value={formData.newSubteamId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">None</option>
                                        {availableSubteams.map((subteam) => (
                                            <option key={subteam.id} value={subteam.id}>{subteam.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {editMode === EDIT_MODES.PROMOTION_DEMOTION && (
                            <div className="form-section conditional-section">
                                <h3 className="form-section-title">Promotion or Demotion</h3>
                                <div className="form-group">
                                    <label htmlFor="promoDemotionType" className="form-label">Record as *</label>
                                    <select
                                        id="promoDemotionType"
                                        name="promoDemotionType"
                                        className="form-input"
                                        value={formData.promoDemotionType}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        {promoDemotionOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="newRoleId" className="form-label">Role (optional)</label>
                                    <select
                                        id="newRoleId"
                                        name="newRoleId"
                                        className={`form-input ${errors.newRoleId ? 'error' : ''}`}
                                        value={formData.newRoleId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Keep current role</option>
                                        {availableRoles.map((role) => {
                                            const isOwnRole = role.id === currentTeamAssignment?.roleId;
                                            const count = teamMembersForTeam.filter((teamMember) => teamMember.roleId === role.id && teamMember.isActive).length;
                                            const effectiveCount = isOwnRole ? Math.max(0, count - 1) : count;
                                            const isFull = role.maxCount != null && effectiveCount >= role.maxCount;
                                            const label = role.maxCount != null
                                                ? `${role.roleName} (${effectiveCount}/${role.maxCount})${isFull ? ' - Full' : ''}`
                                                : role.roleName;
                                            return <option key={role.id} value={role.id} disabled={isFull}>{label}</option>;
                                        })}
                                    </select>
                                    {errors.newRoleId && <span className="field-error">{errors.newRoleId}</span>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="newSubteamId" className="form-label">Subteam (optional)</label>
                                    <select
                                        id="newSubteamId"
                                        name="newSubteamId"
                                        className="form-input"
                                        value={formData.newSubteamId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Keep current / None</option>
                                        {availableSubteams.map((subteam) => (
                                            <option key={subteam.id} value={subteam.id}>{subteam.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {editMode === EDIT_MODES.TRANSFER && (
                            <div className="form-section conditional-section">
                                <h3 className="form-section-title">Transfer to team</h3>
                                <div className="form-group">
                                    <label htmlFor="newTeamId" className="form-label">Target team *</label>
                                    <select
                                        id="newTeamId"
                                        name="newTeamId"
                                        className={`form-input ${errors.newTeamId ? 'error' : ''}`}
                                        value={formData.newTeamId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">-- Select a team --</option>
                                        {teams.filter((team) => team.isActive !== false && team.id !== currentTeamId).map((team) => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                    {errors.newTeamId && <span className="field-error">{errors.newTeamId}</span>}
                                    <p className="form-hint-inline">Member will be assigned the default Member role with no subteam.</p>
                                </div>
                            </div>
                        )}

                        {editMode === EDIT_MODES.LEAVE && (
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
                                        {leaveTypeOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="form-section">
                            <h3 className="form-section-title">Reason &amp; Notes</h3>
                            <div className="form-group">
                                <label htmlFor="changeReason" className="form-label">Reason for change</label>
                                <textarea
                                    id="changeReason"
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
                                <label htmlFor="notes" className="form-label">Notes</label>
                                <textarea
                                    id="notes"
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

export default EditMembersModal;
