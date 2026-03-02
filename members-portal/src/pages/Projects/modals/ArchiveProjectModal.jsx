import { useState } from 'react';
import { X, Archive } from 'lucide-react';
import { projectsAPI } from '../../../services/api';

function ArchiveProjectModal({ project, onClose, onArchived }) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isConfirmed = confirmText.toLowerCase() === 'archive';

    const handleConfirm = async () => {
        if (!isConfirmed) return;
        setLoading(true);
        setError('');
        try {
            await projectsAPI.archive(project.id);
            onArchived();
            handleClose();
        } catch (err) {
            setError(err.message || 'Failed to archive project');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setConfirmText('');
        setError('');
        setLoading(false);
        onClose();
    };

    if (!project) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-neutral">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-neutral">
                            <Archive />
                        </div>
                        <h2 className="modal-title">Archive Project</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={loading}
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="error-message">{error}</div>
                    )}

                    <div className="neutral-info-box">
                        <p className="info-text">
                            You are about to archive the project:
                        </p>
                        <p className="neutral-highlight">
                            {project.title}
                        </p>
                        <p className="info-text">
                            This will finalize and archive the project. It will be moved to Past Projects and will no longer be editable.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmArchiveText" className="form-label">
                            Type <strong>ARCHIVE</strong> to confirm
                        </label>
                        <input
                            type="text"
                            id="confirmArchiveText"
                            className="form-input"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="ARCHIVE"
                            disabled={loading}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-neutral"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || loading}
                    >
                        {loading ? 'Archiving…' : 'Archive Project'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default ArchiveProjectModal;
