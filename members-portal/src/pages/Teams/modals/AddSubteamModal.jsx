import { useState } from 'react';
import { X } from 'lucide-react';

const AddSubteamModal = ({ isOpen, onClose, onSubmit, teamId }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Subteam name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Subteam name must be at least 2 characters';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
            handleClose();
        } catch (error) {
            setErrors({ submit: error.message || 'Failed to create subteam' });
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
                    <button className="modal-close-btn" onClick={handleClose} type="button">
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
