import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { teamSubteamsAPI } from '../../../services/api';

const EditSubteamModal = ({ isOpen, onClose, onSubmit, teamId, initialSubteamId }) => {
    const [selectedSubteamId, setSelectedSubteamId] = useState('');
    const [subteams, setSubteams] = useState([]);
    const [isLoadingSubteams, setIsLoadingSubteams] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && teamId) {
            fetchSubteams();
        }
    }, [isOpen, teamId]);

    // Pre-select subteam when initialSubteamId is provided (e.g. opened from dropdown row)
    useEffect(() => {
        if (isOpen && initialSubteamId && subteams.length > 0 && subteams.some(s => s.id === initialSubteamId)) {
            setSelectedSubteamId(String(initialSubteamId));
        }
    }, [isOpen, initialSubteamId, subteams]);

    useEffect(() => {
        if (selectedSubteamId) {
            const subteam = subteams.find(s => s.id === parseInt(selectedSubteamId));
            if (subteam) {
                setFormData({
                    name: subteam.name || '',
                    description: subteam.description || '',
                    isActive: subteam.isActive ?? true,
                });
                setErrors({});
            }
        } else {
            setFormData({ name: '', description: '', isActive: true });
        }
    }, [selectedSubteamId, subteams]);

    const fetchSubteams = async () => {
        setIsLoadingSubteams(true);
        setErrors((prev) => ({ ...prev, fetch: '' }));
        try {
            const data = await teamSubteamsAPI.getAll(teamId);
            setSubteams(Array.isArray(data) ? data : []);
        } catch (error) {
            console.warn('Subteams fetch failed in EditSubteamModal:', error?.message);
            setSubteams([]);
        } finally {
            setIsLoadingSubteams(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
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
            await onSubmit(selectedSubteamId, formData);
            handleClose();
        } catch (error) {
            setErrors({ submit: error.message || 'Failed to update subteam' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedSubteamId('');
        setFormData({ name: '', description: '', isActive: true });
        setSubteams([]);
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
                    <h2 className="modal-title">Edit Subteam</h2>
                    <button className="modal-close-btn" onClick={handleClose} type="button">
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {errors.submit && <div className="error-message">{errors.submit}</div>}
                        {errors.fetch && <div className="error-message">{errors.fetch}</div>}

                        <div className="form-group">
                            <label htmlFor="subteamSelect" className="form-label">Select Subteam to Edit *</label>
                            <select
                                id="subteamSelect"
                                className={`form-input ${errors.subteam ? 'error' : ''}`}
                                value={selectedSubteamId}
                                onChange={(e) => setSelectedSubteamId(e.target.value)}
                                disabled={isSubmitting || isLoadingSubteams}
                            >
                                <option value="">-- Choose a subteam --</option>
                                {subteams.length > 0 ? (
                                    subteams.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}{s.isActive === false ? ' (Inactive)' : ''}</option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoadingSubteams ? 'Loading subteams...' : 'No subteams available'}
                                    </option>
                                )}
                            </select>
                            {errors.subteam && <span className="field-error">{errors.subteam}</span>}
                        </div>

                        {selectedSubteamId && (
                            <>
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
                                    {errors.name && <span className="field-error">{errors.name}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description" className="form-label">Description (Optional)</label>
                                    <textarea
                                        id="description"
                                        name="description"
                                        className="form-input"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Brief description"
                                        disabled={isSubmitting}
                                        rows={3}
                                    />
                                </div>

                                <p className="form-hint">* Required fields</p>
                            </>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !selectedSubteamId}>
                            {isSubmitting ? 'Updating...' : 'Update Subteam'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default EditSubteamModal;
