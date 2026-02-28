import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { phasesAPI } from '../../../services/api';
import { toTitleCase } from '../../../utils/titleCase';

export default function EditPhaseModal({ phase, onClose, onPhaseUpdated }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (phase) {
            setTitle(phase.title || '');
            setDescription(phase.description || '');
        }
    }, [phase]);

    const handleSubmit = async () => {
        if (!title.trim()) { setError('Title is required'); return; }
        setLoading(true);
        setError('');
        try {
            await phasesAPI.update(phase.id, {
                title: title.trim(),
                description: description.trim() || null,
            });
            onPhaseUpdated();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to update phase');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Edit Phase</h2>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Title *</label>
                        <input
                            className="form-input"
                            placeholder="Phase title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={(e) => setTitle(toTitleCase(e.target.value))}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-input form-textarea"
                            placeholder="Optional description…"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
