import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { teamSubteamsAPI } from '../../../../services/api';
import { toTitleCase } from '../../../../utils/titleCase';
import type { Id } from '../../../../types/backend-contracts';

interface TeamSubteamItem {
    id: Id;
    name: string;
    description?: string | null;
    isActive?: boolean;
}

interface EditSubteamFormData {
    name: string;
    description: string;
    isActive: boolean;
}

interface EditSubteamErrors {
    fetch?: string;
    subteam?: string;
    name?: string;
    submit?: string;
}

interface EditSubteamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (subteamId: Id, formData: EditSubteamFormData) => Promise<void> | void;
    teamId?: Id | null;
    initialSubteamId?: Id | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const EditSubteamModal = ({ isOpen, onClose, onSubmit, teamId, initialSubteamId }: EditSubteamModalProps) => {
    const [selectedSubteamId, setSelectedSubteamId] = useState('');
    const [subteams, setSubteams] = useState<TeamSubteamItem[]>([]);
    const [isLoadingSubteams, setIsLoadingSubteams] = useState(false);
    const [formData, setFormData] = useState<EditSubteamFormData>({
        name: '',
        description: '',
        isActive: true,
    });
    const [errors, setErrors] = useState<EditSubteamErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && teamId != null) {
            void fetchSubteams();
        }
    }, [isOpen, teamId]);

    useEffect(() => {
        if (
            isOpen &&
            initialSubteamId != null &&
            subteams.length > 0 &&
            subteams.some((subteam) => subteam.id === initialSubteamId)
        ) {
            setSelectedSubteamId(String(initialSubteamId));
        }
    }, [isOpen, initialSubteamId, subteams]);

    useEffect(() => {
        if (selectedSubteamId) {
            const selectedSubteamIdNum = parseInt(selectedSubteamId, 10);
            const subteam = subteams.find((item) => item.id === selectedSubteamIdNum);
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
        if (teamId == null) return;
        setIsLoadingSubteams(true);
        setErrors((prev) => ({ ...prev, fetch: '' }));
        try {
            const data = await teamSubteamsAPI.getAll(teamId);
            setSubteams(Array.isArray(data) ? (data as TeamSubteamItem[]) : []);
        } catch {
            setSubteams([]);
        } finally {
            setIsLoadingSubteams(false);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        } as EditSubteamFormData));

        const key = name as keyof EditSubteamErrors;
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const validate = () => {
        const newErrors: EditSubteamErrors = {};
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
        const selectedSubteamIdNum = selectedSubteamId ? parseInt(selectedSubteamId, 10) : NaN;
        if (Number.isNaN(selectedSubteamIdNum) || !validate()) return;

        setIsSubmitting(true);
        try {
            await onSubmit(selectedSubteamIdNum, formData);
            handleClose();
        } catch (error: unknown) {
            setErrors({ submit: getErrorMessage(error, 'Failed to update subteam') });
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
                    <button className="modal-close-btn" onClick={handleClose} type="button" title="Close" aria-label="Close">
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
                                    subteams.map((subteam) => (
                                        <option key={subteam.id} value={subteam.id}>
                                            {subteam.name}{subteam.isActive === false ? ' (Inactive)' : ''}
                                        </option>
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
                                        onBlur={(e) => setFormData((prev) => ({ ...prev, name: toTitleCase(e.target.value) }))}
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