'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { membersAPI, teamMembersAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

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
    isActive?: boolean;
}

interface TeamMemberSummary {
    roleId?: Id | null;
    isActive?: boolean;
}

interface AddMembersFormData {
    fullName: string;
    phoneNumber: string;
    phoneNumber2: string;
    studentId: string;
    profilePhotoUrl: string;
    linkedInUrl: string;
    email2: string;
    email3: string;
    selectedTeamId: string;
    selectedRoleId: string;
    changeReason: string;
}

interface AddMembersErrors {
    fullName?: string;
    phoneNumber?: string;
    phoneNumber2?: string;
    studentId?: string;
    profilePhotoUrl?: string;
    linkedInUrl?: string;
    email2?: string;
    email3?: string;
    selectedTeamId?: string;
    selectedRoleId?: string;
    changeReason?: string;
    submit?: string;
}

interface CreatedMember {
    id: Id;
    [key: string]: unknown;
}

interface AssignmentData {
    memberId: Id;
    teamId: number;
    roleId: number;
    changeReason: string;
}

interface AddMemberSubmitPayload {
    member: CreatedMember;
    assignmentData: AssignmentData;
}

interface AddMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: AddMemberSubmitPayload) => Promise<void> | void;
    selectedTeamId?: Id | null;
    teams: ModalTeam[];
    roles: ModalRole[];
}

interface CreateMemberPayload {
    studentId: number;
    profilePhotoUrl: string | null;
    linkedInUrl: string | null;
    fullName?: string;
    phoneNumber?: string;
    phoneNumber2?: string;
    email2?: string;
    email3?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const AddMembersModal = ({ isOpen, onClose, onSubmit, selectedTeamId, teams, roles }: AddMembersModalProps) => {
    const [formData, setFormData] = useState<AddMembersFormData>({
        fullName: '',
        phoneNumber: '',
        phoneNumber2: '',
        studentId: '',
        profilePhotoUrl: '',
        linkedInUrl: '',
        email2: '',
        email3: '',
        selectedTeamId: selectedTeamId != null ? String(selectedTeamId) : '',
        selectedRoleId: '',
        changeReason: 'Initial assignment',
    });

    // Only student ID + team + role required. Official email = StudentID@med.asu.edu.eg (auto).
    const [errors, setErrors] = useState<AddMembersErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableRoles, setAvailableRoles] = useState<ModalRole[]>([]);
    const [teamMembersForTeam, setTeamMembersForTeam] = useState<TeamMemberSummary[]>([]);

    useEffect(() => {
        if (isOpen && selectedTeamId != null) {
            setFormData((prev) => ({
                ...prev,
                selectedTeamId: String(selectedTeamId),
            }));
        }
    }, [isOpen, selectedTeamId]);

    useEffect(() => {
        if (!formData.selectedTeamId) {
            setAvailableRoles([]);
            return;
        }

        const selectedTeamIdNum = parseInt(formData.selectedTeamId, 10);
        const teamRoles = roles.filter((role) => role.teamId === selectedTeamIdNum);
        setAvailableRoles(teamRoles);

        if (formData.selectedRoleId && !teamRoles.some((role) => role.id === parseInt(formData.selectedRoleId, 10))) {
            setFormData((prev) => ({ ...prev, selectedRoleId: '' }));
        }
    }, [formData.selectedTeamId, formData.selectedRoleId, roles]);

    useEffect(() => {
        const teamIdNum = formData.selectedTeamId ? parseInt(formData.selectedTeamId, 10) : null;
        if (!isOpen || !teamIdNum) {
            setTeamMembersForTeam([]);
            return;
        }

        let cancelled = false;
        teamMembersAPI.getAll(teamIdNum, undefined, true)
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
    }, [isOpen, formData.selectedTeamId]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        } as AddMembersFormData));

        const key = name as keyof AddMembersErrors;
        if (errors[key]) {
            setErrors((prev) => ({
                ...prev,
                [key]: '',
            }));
        }
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhoneNumber = (phone: string): boolean => {
        return phone.replace(/\D/g, '').length >= 10;
    };

    const validate = (): boolean => {
        const newErrors: AddMembersErrors = {};

        if (!formData.studentId.trim()) {
            newErrors.studentId = 'Student ID is required';
        } else if (!/^\d+$/.test(formData.studentId.trim())) {
            newErrors.studentId = 'Student ID must be numeric';
        }

        if (!formData.selectedTeamId) {
            newErrors.selectedTeamId = 'Team selection is required';
        }

        if (!formData.selectedRoleId) {
            newErrors.selectedRoleId = 'Role selection is required';
        } else {
            const selectedRole = availableRoles.find((role) => role.id === parseInt(formData.selectedRoleId, 10));
            if (selectedRole && selectedRole.maxCount != null) {
                const currentCount = teamMembersForTeam.filter(
                    (teamMember) => teamMember.roleId === selectedRole.id && teamMember.isActive
                ).length;
                if (currentCount >= selectedRole.maxCount) {
                    newErrors.selectedRoleId = `This role already has ${currentCount}/${selectedRole.maxCount} member${selectedRole.maxCount !== 1 ? 's' : ''}`;
                }
            }
        }

        if (formData.fullName.trim() && formData.fullName.trim().length < 3) {
            newErrors.fullName = 'Full name must be at least 3 characters';
        }
        if (formData.email2.trim() && !validateEmail(formData.email2.trim())) {
            newErrors.email2 = 'Please enter a valid email address';
        }
        if (formData.email3.trim() && !validateEmail(formData.email3.trim())) {
            newErrors.email3 = 'Please enter a valid email address';
        }
        if (formData.phoneNumber.trim() && !validatePhoneNumber(formData.phoneNumber.trim())) {
            newErrors.phoneNumber = 'Please enter a valid phone number (at least 10 digits)';
        }
        if (formData.phoneNumber2.trim() && !validatePhoneNumber(formData.phoneNumber2.trim())) {
            newErrors.phoneNumber2 = 'Please enter a valid phone number (at least 10 digits)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);

        try {
            const payload: CreateMemberPayload = {
                studentId: parseInt(formData.studentId.trim(), 10),
                profilePhotoUrl: formData.profilePhotoUrl.trim() || null,
                linkedInUrl: formData.linkedInUrl.trim() || null,
            };

            if (formData.fullName.trim()) payload.fullName = formData.fullName.trim();
            if (formData.phoneNumber.trim()) payload.phoneNumber = formData.phoneNumber.trim();
            if (formData.phoneNumber2.trim()) payload.phoneNumber2 = formData.phoneNumber2.trim();
            if (formData.email2.trim()) payload.email2 = formData.email2.trim();
            if (formData.email3.trim()) payload.email3 = formData.email3.trim();

            const created = await membersAPI.create(payload);
            const newMember = created as CreatedMember;
            if (!newMember?.id) {
                throw new Error('Failed to add member');
            }

            const assignmentData: AssignmentData = {
                memberId: newMember.id,
                teamId: parseInt(formData.selectedTeamId, 10),
                roleId: parseInt(formData.selectedRoleId, 10),
                changeReason: formData.changeReason,
            };

            await teamMembersAPI.assign(assignmentData);

            try {
                await onSubmit({
                    member: newMember,
                    assignmentData,
                });
            } catch (submitError) {
                console.error('Error in onSubmit callback:', submitError);
            }

            handleClose();
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Failed to add member');

            if (errorMessage.includes('already exists')) {
                setErrors({ submit: 'Email, phone number, or student ID already exists' });
            } else if (errorMessage.includes('not found')) {
                setErrors({ submit: 'Selected team or role not found' });
            } else {
                setErrors({ submit: errorMessage });
            }

            console.error('Error adding member:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({
            fullName: '',
            phoneNumber: '',
            phoneNumber2: '',
            studentId: '',
            profilePhotoUrl: '',
            linkedInUrl: '',
            email2: '',
            email3: '',
            selectedTeamId: selectedTeamId != null ? String(selectedTeamId) : '',
            selectedRoleId: '',
            changeReason: 'Initial assignment',
        });
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-large">
                <div className="modal-header">
                    <h2 className="modal-title">Add New Member</h2>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        title="Close"
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {errors.submit && (
                            <div className="error-message">
                                {errors.submit}
                            </div>
                        )}

                        {/* Personal Information â€“ Student ID required; official email = StudentID@med.asu.edu.eg (auto) */}
                        <div className="form-section">
                            <h3 className="form-section-title">Personal Information</h3>
                            {/*  <p className="form-section-hint">
                                Only Student ID is required. Official email will be set automatically to <strong>StudentID@med.asu.edu.eg</strong>.
                            </p>*/}

                            <div className="form-row">
                                <div className="form-group form-group-student-id-with-email">
                                    <label htmlFor="studentId" className="form-label">
                                        Student ID *
                                    </label>
                                    <div className="student-id-input-row">
                                        <input
                                            type="text"
                                            id="studentId"
                                            name="studentId"
                                            className={`form-input ${errors.studentId ? 'error' : ''}`}
                                            value={formData.studentId}
                                            onChange={handleChange}
                                            placeholder="e.g., 213256"
                                            disabled={isSubmitting}
                                        />
                                        <div className="official-email-hint">
                                            <span className="official-email-label">Official email:</span>
                                            <span className="official-email-value">
                                                {formData.studentId.trim() ? `${formData.studentId.trim()}@med.asu.edu.eg` : 'StudentID@med.asu.edu.eg'}
                                            </span>
                                        </div>
                                    </div>
                                    {errors.studentId && (
                                        <span className="field-error">{errors.studentId}</span>
                                    )}
                                </div>
                            </div>

                            {/* <div className="form-row">
                                <div className="form-group">
                                    <PhoneInput
                                        id="phoneNumber"
                                        label="Phone (optional)"
                                        value={formData.phoneNumber}
                                        onChange={(v) => setFormData(prev => ({ ...prev, phoneNumber: v }))}
                                        placeholder="Member can complete at first sign-in"
                                        disabled={isSubmitting}
                                        error={errors.phoneNumber}
                                    />
                                </div>
                                <div className="form-group">
                                    <PhoneInput
                                        id="phoneNumber2"
                                        label="Phone 2 (optional)"
                                        value={formData.phoneNumber2}
                                        onChange={(v) => setFormData(prev => ({ ...prev, phoneNumber2: v }))}
                                        placeholder="Optional second number"
                                        disabled={isSubmitting}
                                        error={errors.phoneNumber2}
                                    />
                                </div>
                            </div> */}

                            {/* Full Name â€“ commented out
                                <div className="form-group">
                                    <label htmlFor="fullName" className="form-label">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        id="fullName"
                                        name="fullName"
                                        className={`form-input ${errors.fullName ? 'error' : ''}`}
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        placeholder="Optional â€“ member completes at first sign-in"
                                        disabled={isSubmitting}
                                    />
                                    {errors.fullName && (
                                        <span className="field-error">{errors.fullName}                                    </span>
                                    )}
                                </div>
                                */}

                            {/* Phone Number & Additional email 2 â€“ commented out
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="phoneNumber" className="form-label">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        className={`form-input ${errors.phoneNumber ? 'error' : ''}`}
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        placeholder="Optional â€“ member completes at first sign-in"
                                        disabled={isSubmitting}
                                    />
                                    {errors.phoneNumber && (
                                        <span className="field-error">{errors.phoneNumber}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="email2" className="form-label">
                                        Additional email 2
                                    </label>
                                    <input
                                        type="email"
                                        id="email2"
                                        name="email2"
                                        className={`form-input ${errors.email2 ? 'error' : ''}`}
                                        value={formData.email2}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                        disabled={isSubmitting}
                                    />
                                    {errors.email2 && (
                                        <span className="field-error">{errors.email2}</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="email3" className="form-label">
                                        Additional email 3
                                    </label>
                                    <input
                                        type="email"
                                        id="email3"
                                        name="email3"
                                        className={`form-input ${errors.email3 ? 'error' : ''}`}
                                        value={formData.email3}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                        disabled={isSubmitting}
                                    />
                                    {errors.email3 && (
                                        <span className="field-error">{errors.email3}</span>
                                    )}
                                </div>
                                <div className="form-group" />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="profilePhotoUrl" className="form-label">
                                        Profile Photo URL
                                    </label>
                                    <input
                                        type="url"
                                        id="profilePhotoUrl"
                                        name="profilePhotoUrl"
                                        className={`form-input ${errors.profilePhotoUrl ? 'error' : ''}`}
                                        value={formData.profilePhotoUrl}
                                        onChange={handleChange}
                                        placeholder="e.g., https://example.com/photo.jpg"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="linkedInUrl" className="form-label">
                                        LinkedIn URL
                                    </label>
                                    <input
                                        type="url"
                                        id="linkedInUrl"
                                        name="linkedInUrl"
                                        className={`form-input ${errors.linkedInUrl ? 'error' : ''}`}
                                        value={formData.linkedInUrl}
                                        onChange={handleChange}
                                        placeholder="e.g., https://linkedin.com/in/johndoe"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            */}
                        </div>

                        {/* Team Assignment Section */}
                        <div className="form-section">
                            <h3 className="form-section-title">Team Assignment</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="selectedTeamId" className="form-label">
                                        Select Team *
                                    </label>
                                    <select
                                        id="selectedTeamId"
                                        name="selectedTeamId"
                                        className={`form-input ${errors.selectedTeamId ? 'error' : ''}`}
                                        value={formData.selectedTeamId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">-- Select a Team --</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.selectedTeamId && (
                                        <span className="field-error">{errors.selectedTeamId}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="selectedRoleId" className="form-label">
                                        Select Role *
                                    </label>
                                    <select
                                        id="selectedRoleId"
                                        name="selectedRoleId"
                                        className={`form-input ${errors.selectedRoleId ? 'error' : ''}`}
                                        value={formData.selectedRoleId}
                                        onChange={handleChange}
                                        disabled={!formData.selectedTeamId || isSubmitting}
                                    >
                                        <option value="">-- Select a Role --</option>
                                        {availableRoles.map((role) => {
                                            const currentCount = teamMembersForTeam.filter(
                                                (teamMember) => teamMember.roleId === role.id && teamMember.isActive
                                            ).length;
                                            const isFull = role.maxCount != null && currentCount >= role.maxCount;
                                            const suffix = role.maxCount != null ? ` (${currentCount}/${role.maxCount})` : '';
                                            return (
                                                <option key={role.id} value={role.id} disabled={isFull}>
                                                    {role.roleName}{suffix}{isFull ? ' â€” Full' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {errors.selectedRoleId && (
                                        <span className="field-error">{errors.selectedRoleId}</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="changeReason" className="form-label">
                                    Assignment Reason
                                </label>
                                <textarea
                                    id="changeReason"
                                    name="changeReason"
                                    className="form-input form-textarea"
                                    value={formData.changeReason}
                                    onChange={handleChange}
                                    placeholder="e.g., Initial assignment as team member"
                                    disabled={isSubmitting}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <p className="form-hint">
                            * Required: Student ID, Team, and Role. Official email is set to StudentID@med.asu.edu.eg. The member can complete name/phone and add extra emails when they sign in for the first time.
                        </p>
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
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Adding Member...' : 'Add Member'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddMembersModal;
