import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { teamSubteamsAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

interface TeamSubteamItem {
    id: Id;
    name: string;
    isActive?: boolean;
}

interface DeactivateSubteamErrors {
    fetch?: string;
    subteam?: string;
    submit?: string;
}

interface DeactivateSubteamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (subteamId: Id) => Promise<void> | void;
    teamId?: Id | null;
    initialSubteamId?: Id | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const DeactivateSubteamModal = ({ isOpen, onClose, onSubmit, teamId, initialSubteamId }: DeactivateSubteamModalProps) => {
    const [selectedSubteamId, setSelectedSubteamId] = useState('');
    const [subteams, setSubteams] = useState<TeamSubteamItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [errors, setErrors] = useState<DeactivateSubteamErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && teamId != null) {
            void fetchSubteams();
        }
    }, [isOpen, teamId]);

    const fetchSubteams = async () => {
        if (teamId == null) return;
        setIsLoading(true);
        setErrors((prev) => ({ ...prev, fetch: '' }));
        try {
            const data = await teamSubteamsAPI.getAll(teamId);
            setSubteams(Array.isArray(data) ? (data as TeamSubteamItem[]) : []);
        } catch {
            setSubteams([]);
        } finally {
            setIsLoading(false);
        }
    };

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

    const selectedSubteamIdNum = selectedSubteamId ? parseInt(selectedSubteamId, 10) : null;
    const selectedSubteam = selectedSubteamIdNum != null
        ? subteams.find((subteam) => subteam.id === selectedSubteamIdNum)
        : undefined;
    const isConfirmed = Boolean(selectedSubteam) && confirmText.toLowerCase() === 'deactivate';

    const handleConfirm = async () => {
        if (!isConfirmed || selectedSubteamIdNum == null || Number.isNaN(selectedSubteamIdNum)) return;

        setIsSubmitting(true);
        setErrors((prev) => ({ ...prev, submit: '' }));

        try {
            await onSubmit(selectedSubteamIdNum);
            handleClose();
        } catch (err: unknown) {
            setErrors((prev) => ({ ...prev, submit: getErrorMessage(err, 'Failed to deactivate subteam') }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedSubteamId('');
        setConfirmText('');
        setSubteams([]);
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    const activeSubteams = subteams.filter((subteam) => subteam.isActive !== false);

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-danger">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-danger">
                            <AlertTriangle />
                        </div>
                        <h2 className="modal-title">Deactivate Subteam</h2>
                    </div>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={isSubmitting}
                        title="Close"
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {errors.submit && (
                        <div className="error-message">{errors.submit}</div>
                    )}
                    {errors.fetch && (
                        <div className="error-message">{errors.fetch}</div>
                    )}

                    {initialSubteamId != null && isLoading && (
                        <p className="form-hint">Loading...</p>
                    )}

                    {initialSubteamId == null && (
                        <div className="form-group">
                            <label htmlFor="subteamSelect" className="form-label">
                                Select Subteam to Deactivate *
                            </label>
                            <select
                                id="subteamSelect"
                                className={`form-input ${errors.subteam ? 'error' : ''}`}
                                value={selectedSubteamId}
                                onChange={(e) => {
                                    setSelectedSubteamId(e.target.value);
                                    setConfirmText('');
                                    if (errors.subteam) setErrors((prev) => ({ ...prev, subteam: '' }));
                                }}
                                disabled={isSubmitting || isLoading}
                            >
                                <option value="">-- Choose a subteam --</option>
                                {activeSubteams.length > 0 ? (
                                    activeSubteams.map((subteam) => (
                                        <option key={subteam.id} value={subteam.id}>{subteam.name}</option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoading ? 'Loading subteams...' : 'No active subteams available'}
                                    </option>
                                )}
                            </select>
                            {errors.subteam && (
                                <span className="field-error">{errors.subteam}</span>
                            )}
                        </div>
                    )}

                    {selectedSubteam && (initialSubteamId == null || !isLoading) && (
                        <>
                            <div className="warning-box">
                                <p className="warning-text">
                                    You are about to deactivate the subteam:
                                </p>
                                <p className="team-name-highlight">
                                    {selectedSubteam.name}
                                </p>
                                <p className="warning-text">
                                    The subteam will be hidden from active lists. You can reactivate it later.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmText" className="form-label">
                                    Type <strong>DEACTIVATE</strong> to confirm
                                </label>
                                <input
                                    type="text"
                                    id="confirmText"
                                    className="form-input"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="DEACTIVATE"
                                    disabled={isSubmitting}
                                    autoComplete="off"
                                />
                            </div>
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
                        type="button"
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || isSubmitting}
                    >
                        {isSubmitting ? 'Deactivating...' : 'Deactivate Subteam'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default DeactivateSubteamModal;