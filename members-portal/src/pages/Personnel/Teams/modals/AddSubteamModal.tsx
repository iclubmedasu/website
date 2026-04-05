import { useState, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { toTitleCase } from '../../../../utils/titleCase';
import type { Id } from '../../../../types/backend-contracts';

interface AddSubteamFormData {
    name: string;
    description: string;
}

interface AddSubteamErrors {
    name?: string;
    description?: string;
    submit?: string;
}

interface AddSubteamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (formData: AddSubteamFormData) => Promise<void> | void;
    teamId?: Id | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const AddSubteamModal = ({ isOpen, onClose, onSubmit }: AddSubteamModalProps) => {
    const [formData, setFormData] = useState<AddSubteamFormData>({
        name: '',
        description: '',
    });
    const [errors, setErrors] = useState<AddSubteamErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        } as AddSubteamFormData));

        const key = name as keyof AddSubteamErrors;
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const validate = () => {
        const newErrors: AddSubteamErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Subteam name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Subteam name must be at least 2 characters';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
            handleClose();
        } catch (error: unknown) {
            setErrors({ submit: getErrorMessage(error, 'Failed to create subteam') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({ name: '', description: '' });
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
                    <h2 className="modal-title">Add New Subteam</h2>
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
                            <div className="error-message">{errors.submit}</div>
                        )}

                        <div className="form-group">
                            <label htmlFor="name" className="form-label">Subteam Name *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                className={`form-input ${errors.name ? 'error' : ''}`}
                                value={formData.name}
                                onChange={handleChange}
                                onBlur={(e) => setFormData((prev) => ({ ...prev, name: toTitleCase(e.target.value) }))}
                                placeholder="e.g., Technical, Marketing"
                                disabled={isSubmitting}
                            />
                            {errors.name && (
                                <span className="field-error">{errors.name}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="description" className="form-label">Description (Optional)</label>
                            <textarea
                                id="description"
                                name="description"
                                className={`form-input ${errors.description ? 'error' : ''}`}
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Brief description of this subteam"
                                disabled={isSubmitting}
                                rows={3}
                            />
                        </div>

                        <p className="form-hint">* Required fields</p>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Subteam'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddSubteamModal;