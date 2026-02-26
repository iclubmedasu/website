import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { membersAPI, teamMembersAPI, teamRolesAPI } from '../../../services/api';
import { PhoneInput } from '../../../components/PhoneInput/PhoneInput';

const AddMembersModal = ({ isOpen, onClose, onSubmit, selectedTeamId, teams, roles }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        phoneNumber: '',
        phoneNumber2: '',
        studentId: '',
        profilePhotoUrl: '',
        linkedInUrl: '',
        email2: '',
        email3: '',
        selectedTeamId: selectedTeamId || '',
        selectedRoleId: '',
        changeReason: 'Initial assignment',
    });

    // Only student ID + team + role required. Official email = StudentID@med.asu.edu.eg (auto). Optional: name, phone, email2, email3.

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableRoles, setAvailableRoles] = useState([]);

    // Initialize form with selectedTeamId when modal opens
    useEffect(() => {
        if (isOpen && selectedTeamId) {
            setFormData(prev => ({
                ...prev,
                selectedTeamId: selectedTeamId || ''
            }));
        }
    }, [isOpen, selectedTeamId]);

    // Update available roles when team selection changes
    useEffect(() => {
        if (formData.selectedTeamId) {
            const teamRoles = roles.filter(role => role.teamId === parseInt(formData.selectedTeamId));
            setAvailableRoles(teamRoles);
            // Clear role selection if previously selected role is not in new team
            if (formData.selectedRoleId && !teamRoles.some(r => r.id === parseInt(formData.selectedRoleId))) {
                setFormData(prev => ({ ...prev, selectedRoleId: '' }));
            }
        } else {
            setAvailableRoles([]);
        }
    }, [formData.selectedTeamId, roles]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhoneNumber = (phone) => {
        return phone && phone.replace(/\D/g, '').length >= 10;
    };

    const validate = () => {
        const newErrors = {};

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
        }

        // Optional fields: if provided, validate format
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);

        try {
            // Step 1: Create member (only studentId required; backend uses placeholders for name/email/phone if omitted)
            const payload = {
                studentId: parseInt(formData.studentId.trim(), 10),
                profilePhotoUrl: formData.profilePhotoUrl.trim() || null,
                linkedInUrl: formData.linkedInUrl.trim() || null,
            };
            if (formData.fullName.trim()) payload.fullName = formData.fullName.trim();
            if (formData.phoneNumber.trim()) payload.phoneNumber = formData.phoneNumber.trim();
            if (formData.phoneNumber2.trim()) payload.phoneNumber2 = formData.phoneNumber2.trim();
            if (formData.email2.trim()) payload.email2 = formData.email2.trim();
            if (formData.email3.trim()) payload.email3 = formData.email3.trim();

            const newMember = await membersAPI.create(payload);

            // Step 2 & 3: Assign to team and create role history
            const assignmentData = {
                memberId: newMember.id,
                teamId: parseInt(formData.selectedTeamId),
                roleId: parseInt(formData.selectedRoleId),
                changeReason: formData.changeReason,
            };

            await teamMembersAPI.assign(assignmentData);

            // Call the parent submit handler to update the UI
            try {
                await onSubmit({
                    member: newMember,
                    assignmentData
                });
            } catch (submitError) {
                console.error('Error in onSubmit callback:', submitError);
                // Don't fail the whole operation if the callback errors
            }

            handleClose();
        } catch (error) {
            // Parse error message from backend
            let errorMessage = error?.message || 'Failed to add member';

            // Handle specific error types
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
            selectedTeamId: selectedTeamId || '',
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

                        {/* Personal Information – Student ID required; official email = StudentID@med.asu.edu.eg (auto) */}
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

                            {/* Full Name – commented out
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
                                        placeholder="Optional – member completes at first sign-in"
                                        disabled={isSubmitting}
                                    />
                                    {errors.fullName && (
                                        <span className="field-error">{errors.fullName}                                    </span>
                                    )}
                                </div>
                                */}

                            {/* Phone Number & Additional email 2 – commented out
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
                                        placeholder="Optional – member completes at first sign-in"
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
                                        {teams.map(team => (
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
                                        {availableRoles.map(role => (
                                            <option key={role.id} value={role.id}>
                                                {role.roleName}
                                            </option>
                                        ))}
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
