import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { toTitleCase } from '../../../../utils/titleCase';

interface TeamFormData {
    name: string;
    establishedDate: string;
    isActive: boolean;
}

interface TeamItem {
    id: number | string;
    name?: string;
    establishedDate?: string | null;
    isActive?: boolean;
}

interface EditTeamErrors {
    name?: string;
    establishedDate?: string;
    submit?: string;
}

interface EditTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (teamId: number | string, formData: TeamFormData) => Promise<void> | void;
    team?: TeamItem | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const EditTeamModal = ({ isOpen, onClose, onSubmit, team }: EditTeamModalProps) => {
    const [formData, setFormData] = useState<TeamFormData>({
        name: '',
        establishedDate: '',
        isActive: true,
    });
    const [errors, setErrors] = useState<EditTeamErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Populate form when team changes
    useEffect(() => {
        if (team) {
            setFormData({
                name: team.name || '',
                establishedDate: team.establishedDate
                    ? new Date(team.establishedDate).toISOString().split('T')[0]
                    : '',
                isActive: team.isActive ?? true,
            });
        }
    }, [team]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        // Clear error when user starts typing
        const key = name as keyof EditTeamErrors;
        if (errors[key]) {
            setErrors((prev) => ({
                ...prev,
                [key]: '',
            }));
        }
    };

    const validate = (): boolean => {
        const newErrors: EditTeamErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Team name is required';
        } else if (formData.name.length < 3) {
            newErrors.name = 'Team name must be at least 3 characters';
        }

        if (!formData.establishedDate) {
            newErrors.establishedDate = 'Established date is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!validate()) return;
        if (!team) return;

        setIsSubmitting(true);

        try {
            await onSubmit(team.id, formData);
            handleClose();
        } catch (error: unknown) {
            setErrors({ submit: getErrorMessage(error, 'Failed to update team') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen || !team) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Edit Team</h2>
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
                            <label htmlFor="name" className="form-label">
                                Team Name *
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                className={`form-input ${errors.name ? 'error' : ''}`}
                                value={formData.name}
                                onChange={handleChange}
                                onBlur={(e) => setFormData(prev => ({ ...prev, name: toTitleCase(e.target.value) }))}
                                placeholder="e.g., Engineering Team"
                                disabled={isSubmitting}
                            />
                            {errors.name && (
                                <span className="field-error">{errors.name}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="establishedDate" className="form-label">
                                Established Date *
                            </label>
                            <input
                                type="date"
                                id="establishedDate"
                                name="establishedDate"
                                className={`form-input ${errors.establishedDate ? 'error' : ''}`}
                                value={formData.establishedDate}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                            {errors.establishedDate && (
                                <span className="field-error">{errors.establishedDate}</span>
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
                            {isSubmitting ? 'Updating...' : 'Update Team'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default EditTeamModal;