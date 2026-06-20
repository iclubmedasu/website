'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { TeamRef } from '@/types/backend-contracts';

export interface MembersFiltersState {
    filterTeamId: string;
    filterStatus: string;
    dateFrom: string;
    dateTo: string;
}

interface MembersFiltersModalProps {
    filterTeamId: string;
    filterStatus: string;
    dateFrom: string;
    dateTo: string;
    allTeams: TeamRef[];
    onClose: () => void;
    onApply: (filters: MembersFiltersState) => void;
    onClear: () => void;
}

export default function MembersFiltersModal({
    filterTeamId,
    filterStatus,
    dateFrom,
    dateTo,
    allTeams,
    onClose,
    onApply,
    onClear,
}: MembersFiltersModalProps) {
    const [draftTeamId, setDraftTeamId] = useState(filterTeamId);
    const [draftStatus, setDraftStatus] = useState(filterStatus);
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container events-filters-modal" role="dialog" aria-modal="true" aria-labelledby="members-filters-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="members-filters-title">Advanced Filters</h2>
                        <p className="modal-subtitle">Narrow the list by team, membership status, and join date.</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close filters">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-section">
                        <h3 className="form-section-title">Team</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="members-filter-team">Team</label>
                            <select
                                id="members-filter-team"
                                className="form-input"
                                value={draftTeamId}
                                onChange={(event) => setDraftTeamId(event.target.value)}
                            >
                                <option value="">All teams</option>
                                {allTeams.map((team) => (
                                    <option key={team.id} value={String(team.id)}>{team.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Status</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="members-filter-status">Membership status</label>
                            <select
                                id="members-filter-status"
                                className="form-input"
                                value={draftStatus}
                                onChange={(event) => setDraftStatus(event.target.value)}
                            >
                                <option value="">All statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="unassigned">Unassigned</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Date range</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="members-filter-date-from">From</label>
                                <input
                                    id="members-filter-date-from"
                                    type="date"
                                    className="form-input"
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="members-filter-date-to">To</label>
                                <input
                                    id="members-filter-date-to"
                                    type="date"
                                    className="form-input"
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                        <p className="form-hint-text">Filters by team join date.</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setDraftTeamId('');
                            setDraftStatus('');
                            setDraftDateFrom('');
                            setDraftDateTo('');
                            onClear();
                        }}
                    >
                        Clear
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => onApply({
                            filterTeamId: draftTeamId,
                            filterStatus: draftStatus,
                            dateFrom: draftDateFrom,
                            dateTo: draftDateTo,
                        })}
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
}
