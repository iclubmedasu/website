import { useState, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { toTitleCase } from '../../../../utils/titleCase';

type RoleType = 'Leadership' | 'Special Roles' | 'Regular';

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

interface AddRoleErrors {
    roleName?: string;
    roleType?: string;
    maxCount?: string;
    submit?: string;
}

interface AddRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (formData: RoleSubmitData) => Promise<void> | void;
    teamId?: number | string | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const AddRoleModal = ({ isOpen, onClose, onSubmit }: AddRoleModalProps) => {
    const [formData, setFormData] = useState<RoleFormData>({
        roleName: '',
        roleType: 'Regular',
        maxCount: '',
        isActive: true,
    });
    const [errors, setErrors] = useState<AddRoleErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Only 3 types: Leadership (max 1, shows in Leadership card), Special Roles, Regular (table)
    const roleTypeOptions: Array<{ value: RoleType; label: string }> = [
        { value: 'Leadership', label: 'Leadership (max 1 per team)' },
        { value: 'Special Roles', label: 'Special Roles' },
        { value: 'Regular', label: 'Regular' },
    ];

    const isLeadership = formData.roleType === 'Leadership';

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const next: RoleFormData = {
            ...formData,
            [name]: name === 'roleType' ? (value as RoleType) : value,
        } as RoleFormData;
        if (name === 'roleType' && value === 'Leadership') {
            next.maxCount = '1';
        }
        setFormData(next);
        const key = name as keyof AddRoleErrors;
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
    };

    const validate = (): boolean => {
        const newErrors: AddRoleErrors = {};
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
            await onSubmit({
                ...formData,
                maxCount: isLeadership ? 1 : (formData.maxCount ? parseInt(formData.maxCount) : null),
            });
            handleClose();
        } catch (error: unknown) {
            setErrors({ submit: getErrorMessage(error, 'Failed to create role') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({
            roleName: '',
            roleType: 'Regular',
            maxCount: '',
            isActive: true,
        });
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
                    <h2 className="modal-title">Add New Role</h2>
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
                                Leadership → Leadership card (max 1). Special Roles → Special card. Regular → Team Members table.
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
                            {isSubmitting ? 'Creating...' : 'Create Role'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddRoleModal;