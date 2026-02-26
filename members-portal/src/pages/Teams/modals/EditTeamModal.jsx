import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const EditTeamModal = ({ isOpen, onClose, onSubmit, team }) => {
    const [formData, setFormData] = useState({
        name: '',
        establishedDate: '',
        isActive: true,
    });
    const [errors, setErrors] = useState({});
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

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validate = () => {
        const newErrors = {};

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);

        try {
            await onSubmit(team.id, formData);
            handleClose();
        } catch (error) {
            setErrors({ submit: error.message || 'Failed to update team' });
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