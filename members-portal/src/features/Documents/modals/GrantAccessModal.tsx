'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { teamsAPI } from '@/services/api';
import {
    documentsAPI,
    type DocumentAccessTarget,
    type DurationPreset,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';

interface NamedOption {
    id: Id;
    name: string;
}

interface GrantAccessModalProps {
    targetType?: DocumentAccessTarget;
    targetId?: Id | null;
    targetTitle?: string;
    documentId?: Id | null;
    documentTitle?: string;
    /** Led team IDs to hide from the picker (own-team grants are redundant). */
    excludeTeamIds?: Id[];
    onClose: () => void;
    onGranted?: () => void | Promise<void>;
}

const DURATION_OPTIONS: { value: DurationPreset; label: string }[] = [
    { value: 'DAY', label: 'Day' },
    { value: 'WEEK', label: 'Week' },
    { value: 'MONTH', label: 'Month' },
    { value: 'INDEFINITE', label: 'Indefinite' },
];

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function GrantAccessModal({
    targetType = 'document',
    targetId = null,
    targetTitle,
    documentId,
    documentTitle,
    excludeTeamIds = [],
    onClose,
    onGranted,
}: GrantAccessModalProps) {
    const resolvedId = targetId ?? documentId ?? null;
    const resolvedTitle = targetTitle ?? documentTitle;
    const isCategory = targetType === 'category';
    const [teams, setTeams] = useState<NamedOption[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<Id | null>(null);
    const [durationPreset, setDurationPreset] = useState<DurationPreset>('WEEK');
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (resolvedId == null) return;

        setSelectedTeamId(null);
        setDurationPreset('WEEK');
        setError('');
        setSubmitting(false);

        let cancelled = false;
        const load = async () => {
            setLoadingOptions(true);
            try {
                const teamsRaw = await teamsAPI.getAll(true, 'all');
                if (cancelled) return;

                const teamOptions: NamedOption[] = Array.isArray(teamsRaw)
                    ? teamsRaw
                          .filter(
                              (team): team is { id: Id; name: string } =>
                                  typeof team === 'object' &&
                                  team != null &&
                                  'id' in team &&
                                  'name' in team &&
                                  typeof (team as { name: unknown }).name === 'string',
                          )
                          .map((team) => ({ id: team.id, name: team.name }))
                    : [];

                setTeams(teamOptions);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err, 'Failed to load teams'));
                    setTeams([]);
                }
            } finally {
                if (!cancelled) setLoadingOptions(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [resolvedId]);

    if (resolvedId == null) return null;

    const excludeSet = new Set(excludeTeamIds.map((id) => Number(id)));
    const visibleTeams = teams.filter((team) => !excludeSet.has(Number(team.id)));

    const handleClose = () => {
        if (submitting) return;
        onClose();
    };

    const canSubmit = selectedTeamId != null;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (selectedTeamId == null) return;

        setSubmitting(true);
        setError('');
        try {
            const payload = {
                grantedToType: 'TEAM' as const,
                teamId: selectedTeamId,
                durationPreset,
            };
            if (isCategory) {
                await documentsAPI.createCategoryGrant(resolvedId, payload);
            } else {
                await documentsAPI.createGrant(resolvedId, payload);
            }
            await onGranted?.();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to grant access'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">
                            {isCategory ? 'Grant folder access' : 'Grant access'}
                        </h2>
                        {resolvedTitle ? (
                            <p className="modal-subtitle">{resolvedTitle}</p>
                        ) : null}
                    </div>
                    <button
                        className="modal-close-btn"
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)}>
                    <div className="modal-body">
                        {error ? <div className="error-message">{error}</div> : null}
                        <p className="form-hint-text">
                            Recipients can view and download only — they cannot grant further.
                            {isCategory
                                ? ' Folder grants apply to every document in this folder, including future uploads.'
                                : ''}
                        </p>

                        <div className="form-section">
                            <h3 className="form-section-title">Team</h3>
                            {loadingOptions ? (
                                <div className="loading-state">
                                    <div className="spinner" />
                                    <p>Loading teams…</p>
                                </div>
                            ) : (
                                <>
                                    <p className="form-hint-text">
                                        Grants access to that team&apos;s Head and Vice.
                                    </p>
                                    {visibleTeams.length === 0 ? (
                                        <p className="form-hint-text">
                                            {excludeTeamIds.length > 0 || teams.length > 0
                                                ? 'No other teams to grant.'
                                                : 'No teams found.'}
                                        </p>
                                    ) : (
                                        <div
                                            className="team-badge-picker"
                                            role="listbox"
                                            aria-label="Team"
                                        >
                                            {visibleTeams.map((team) => {
                                                const selected =
                                                    selectedTeamId != null &&
                                                    Number(selectedTeamId) === Number(team.id);
                                                return (
                                                    <button
                                                        key={team.id}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={selected}
                                                        className={`team-badge-option${
                                                            selected
                                                                ? ' team-badge-option--selected'
                                                                : ''
                                                        }`}
                                                        onClick={() =>
                                                            setSelectedTeamId((prev) =>
                                                                prev != null &&
                                                                Number(prev) === Number(team.id)
                                                                    ? null
                                                                    : team.id,
                                                            )
                                                        }
                                                        disabled={submitting}
                                                    >
                                                        {team.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Duration</h3>
                            <div
                                className="modal-segmented"
                                role="group"
                                aria-label="Grant duration"
                            >
                                {DURATION_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`modal-segmented-btn${
                                            durationPreset === option.value
                                                ? ' modal-segmented-btn--active'
                                                : ''
                                        }`}
                                        onClick={() => setDurationPreset(option.value)}
                                        disabled={submitting}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleClose}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || !canSubmit}
                        >
                            {submitting ? 'Granting…' : 'Grant access'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
