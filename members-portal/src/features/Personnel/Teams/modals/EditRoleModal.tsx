'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { teamRolesAPI } from '../../../../services/api';
import { toTitleCase } from '../../../../utils/titleCase';

type RoleType = 'Leadership' | 'Special Roles' | 'Regular';

interface RoleItem {
    id: number | string;
    roleName?: string;
    roleType?: string;
    maxCount?: number | null;
    isActive?: boolean;
}

interface RoleFormData {
    roleName: string;
    roleType: RoleType;
    maxCount: string;
    isActive: boolean;
}

interface RoleSubmitData {
    roleName: string;
    roleType: RoleType;
    maxCount: number | null;
    isActive: boolean;
}

interface EditRoleErrors {
    role?: string;
    roleName?: string;
    roleType?: string;
    maxCount?: string;
    fetch?: string;
    submit?: string;
}

interface EditRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (roleId: number | string, formData: RoleSubmitData) => Promise<void> | void;
    teamId?: number | string | null;
    initialRoleId?: number | string | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const EditRoleModal = ({ isOpen, onClose, onSubmit, teamId, initialRoleId }: EditRoleModalProps) => {
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [formData, setFormData] = useState<RoleFormData>({
        roleName: '',
        roleType: 'Regular',
        maxCount: '',
        isActive: true,
    });
    const [errors, setErrors] = useState<EditRoleErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const roleTypeOptions: Array<{ value: RoleType; label: string }> = [
        { value: 'Leadership', label: 'Leadership (max 1 per team)' },
        { value: 'Special Roles', label: 'Special Roles' },
        { value: 'Regular', label: 'Regular' },
    ];

    const isLeadership = formData.roleType === 'Leadership';

    // Fetch roles when modal opens
    useEffect(() => {
        if (isOpen && teamId) {
            void fetchRoles();
        }
    }, [isOpen, teamId]);

    // Pre-select role when initialRoleId is provided (e.g. opened from dropdown row)
    useEffect(() => {
        if (isOpen && initialRoleId && roles.length > 0 && roles.some((r) => r.id === initialRoleId)) {
            setSelectedRoleId(String(initialRoleId));
        }
    }, [isOpen, initialRoleId, roles]);

    // Populate form when role is selected (map legacy roleType to new values)
    useEffect(() => {
        if (selectedRoleId) {
            const role = roles.find((r) => r.id === parseInt(selectedRoleId, 10));
            if (role) {
                let roleType = role.roleType || 'Regular';
                if (!['Leadership', 'Special Roles', 'Regular'].includes(roleType)) {
                    roleType = roleType === 'Leader' ? 'Leadership' : 'Regular';
                }
                setFormData({
                    roleName: role.roleName || '',
                    roleType: roleType as RoleType,
                    maxCount: role.maxCount != null ? role.maxCount.toString() : '',
                    isActive: role.isActive ?? true,
                });
                setErrors({});
            }
        } else {
            setFormData({
                roleName: '',
                roleType: 'Regular',
                maxCount: '',
                isActive: true,
            });
        }
    }, [selectedRoleId, roles]);

    const fetchRoles = async (): Promise<void> => {
        setIsLoadingRoles(true);
        try {
            const data = await teamRolesAPI.getAll(teamId);
            setRoles(Array.isArray(data) ? (data as RoleItem[]) : []);
        } catch {
            setErrors({ fetch: 'Failed to load roles. Please try again.' });
        } finally {
            setIsLoadingRoles(false);
        }
    };

    const handleRoleSelect = (roleId: string): void => {
        setSelectedRoleId(roleId);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const { name } = target;
        const isCheckboxInput = target instanceof HTMLInputElement && target.type === 'checkbox';
        const nextValue = isCheckboxInput ? target.checked : target.value;
        const next: RoleFormData = {
            ...formData,
            [name]: name === 'roleType' ? (String(nextValue) as RoleType) : nextValue,
        } as RoleFormData;
        if (name === 'roleType' && nextValue === 'Leadership') next.maxCount = '1';
        setFormData(next);
        const key = name as keyof EditRoleErrors;
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
    };

    const validate = (): boolean => {
        const newErrors: EditRoleErrors = {};
        if (!formData.roleName.trim()) {
            newErrors.roleName = 'Role name is required';
        } else if (formData.roleName.length < 3) {
            newErrors.roleName = 'Role name must be at least 3 characters';
        }
        if (!formData.roleType) newErrors.roleType = 'Role type is required';
        if (!isLeadership && formData.maxCount && isNaN(parseInt(formData.maxCount))) {
            newErrors.maxCount = 'Max count must be a number';
        } else if (!isLeadership && formData.maxCount && parseInt(formData.maxCount) < 1) {
            newErrors.maxCount = 'Max count must be at least 1';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);

        try {
            await onSubmit(selectedRoleId, {
                ...formData,
                maxCount: isLeadership ? 1 : (formData.maxCount ? parseInt(formData.maxCount) : null),
            });
            handleClose();
        } catch (error: unknown) {
            setErrors({ submit: getErrorMessage(error, 'Failed to update role') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedRoleId('');
        setFormData({
            roleName: '',
            roleType: 'Regular',
            maxCount: '',
            isActive: true,
        });
        setRoles([]);
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Edit Role</h2>
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

                        {errors.fetch && (
                            <div className="error-message">
                                {errors.fetch}
                            </div>
                        )}

                        {/* ROLE SELECTION - FIRST STEP */}
                        <div className="form-group">
                            <label htmlFor="roleSelect" className="form-label">
                                Select Role to Edit *
                            </label>
                            <select
                                id="roleSelect"
                                className={`form-input ${errors.role ? 'error' : ''}`}
                                value={selectedRoleId}
                                onChange={(e) => handleRoleSelect(e.target.value)}
                                disabled={isSubmitting || isLoadingRoles}
                            >
                                <option value="">-- Choose a role --</option>
                                {roles.length > 0 ? (
                                    roles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.roleName}{role.isActive === false ? ' (Inactive)' : ''}
                                        </option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoadingRoles ? 'Loading roles...' : 'No roles available'}
                                    </option>
                                )}
                            </select>
                            {errors.role && (
                                <span className="field-error">{errors.role}</span>
                            )}
                        </div>

                        {/* FORM FIELDS - ONLY SHOW WHEN ROLE IS SELECTED */}
                        {selectedRoleId && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="roleName" className="form-label">
                                        Role Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="roleName"
                                        name="roleName"
                                        className={`form-input ${errors.roleName ? 'error' : ''}`}
                                        value={formData.roleName}
                                        onChange={handleChange}
                                        onBlur={(e) => setFormData(prev => ({ ...prev, roleName: toTitleCase(e.target.value) }))}
                                        placeholder="e.g., Lead Developer"
                                        disabled={isSubmitting}
                                    />
                                    {errors.roleName && (
                                        <span className="field-error">{errors.roleName}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="roleType" className="form-label">
                                        Role Type *
                                    </label>
                                    <select
                                        id="roleType"
                                        name="roleType"
                                        className={`form-input ${errors.roleType ? 'error' : ''}`}
                                        value={formData.roleType}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    >
                                        {roleTypeOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="form-hint-small">
                                        Leadership → Leadership card. Special Roles → Special card. Regular → Team Members table.
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="maxCount" className="form-label">
                                        Max Count {isLeadership ? '(always 1 for Leadership)' : '(Optional)'}
                                    </label>
                                    <input
                                        type="number"
                                        id="maxCount"
                                        name="maxCount"
                                        className={`form-input ${errors.maxCount ? 'error' : ''}`}
                                        value={isLeadership ? '1' : formData.maxCount}
                                        onChange={handleChange}
                                        placeholder={isLeadership ? '' : 'e.g., 5 (leave empty for unlimited)'}
                                        disabled={isSubmitting || isLeadership}
                                        min="1"
                                    />
                                    {errors.maxCount && (
                                        <span className="field-error">{errors.maxCount}</span>
                                    )}
                                    {!isLeadership && (
                                        <p className="form-hint-small">
                                            Maximum number of people who can hold this role
                                        </p>
                                    )}
                                </div>

                                <p className="form-hint">
                                    * Required fields
                                </p>
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
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting || !selectedRoleId}
                        >
                            {isSubmitting ? 'Updating...' : 'Update Role'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default EditRoleModal;

