import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { teamSubteamsAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

interface TeamSubteamItem {
    id: Id;
    name: string;
    isActive?: boolean;
}

interface ActivateSubteamErrors {
    fetch?: string;
    subteam?: string;
    submit?: string;
}

interface ActivateSubteamModalProps {
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

const ActivateSubteamModal = ({ isOpen, onClose, onSubmit, teamId, initialSubteamId }: ActivateSubteamModalProps) => {
    const [selectedSubteamId, setSelectedSubteamId] = useState('');
    const [subteams, setSubteams] = useState<TeamSubteamItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [errors, setErrors] = useState<ActivateSubteamErrors>({});
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
    const isConfirmed = Boolean(selectedSubteam) && confirmText.toLowerCase() === 'activate';

    const handleConfirm = async () => {
        if (!isConfirmed || selectedSubteamIdNum == null || Number.isNaN(selectedSubteamIdNum)) return;

        setIsSubmitting(true);
        setErrors((prev) => ({ ...prev, submit: '' }));

        try {
            await onSubmit(selectedSubteamIdNum);
            handleClose();
        } catch (err: unknown) {
            setErrors((prev) => ({ ...prev, submit: getErrorMessage(err, 'Failed to activate subteam') }));
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

    const inactiveSubteams = subteams.filter((subteam) => subteam.isActive === false);

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose}></div>
            <div className="modal-container modal-success">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-icon-success">
                            <CheckCircle />
                        </div>
                        <h2 className="modal-title">Activate Subteam</h2>
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
                                Select Subteam to Activate *
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
                                {inactiveSubteams.length > 0 ? (
                                    inactiveSubteams.map((subteam) => (
                                        <option key={subteam.id} value={subteam.id}>{subteam.name}</option>
                                    ))
                                ) : (
                                    <option disabled>
                                        {isLoading ? 'Loading subteams...' : 'No inactive subteams available'}
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
                            <div className="info-box activate-info-box">
                                <p className="info-text">
                                    You are about to activate the subteam:
                                </p>
                                <p className="team-name-highlight activate-highlight">
                                    {selectedSubteam.name}
                                </p>
                                <p className="info-text">
                                    The subteam will appear in active lists and be available for use.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmText" className="form-label">
                                    Type <strong>ACTIVATE</strong> to confirm
                                </label>
                                <input
                                    type="text"
                                    id="confirmText"
                                    className="form-input"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="ACTIVATE"
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
                        className="btn btn-success"
                        onClick={handleConfirm}
                        disabled={!isConfirmed || isSubmitting}
                    >
                        {isSubmitting ? 'Activating...' : 'Activate Subteam'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ActivateSubteamModal;