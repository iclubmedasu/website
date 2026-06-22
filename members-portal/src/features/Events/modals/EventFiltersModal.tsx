'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import './EventFiltersModal.css';
import type { EventQueryParams, ProjectStatus, TeamRef } from '@/types/backend-contracts';

const WORK_STATUSES: ProjectStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];

const STATUS_LABELS: Record<ProjectStatus | 'DELAYED' | 'BLOCKED', string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

export interface EventFiltersState {
    status: EventQueryParams['status'] | '';
    dateFrom: string;
    dateTo: string;
    filterTeam: string;
    filterCategory: string;
    filterPriority: string;
}

interface EventFiltersModalProps {
    status: EventQueryParams['status'] | '';
    dateFrom: string;
    dateTo: string;
    filterTeam: string;
    filterCategory: string;
    filterPriority: string;
    allTeams: TeamRef[];
    allCategories: string[];
    onClose: () => void;
    onApply: (filters: EventFiltersState) => void;
    onClear: () => void;
}

export default function EventFiltersModal({
    status,
    dateFrom,
    dateTo,
    filterTeam,
    filterCategory,
    filterPriority,
    allTeams,
    allCategories,
    onClose,
    onApply,
    onClear,
}: EventFiltersModalProps) {
    const [draftStatus, setDraftStatus] = useState<EventQueryParams['status'] | ''>(status);
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);
    const [draftTeam, setDraftTeam] = useState(filterTeam);
    const [draftCategory, setDraftCategory] = useState(filterCategory);
    const [draftPriority, setDraftPriority] = useState(filterPriority);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container events-filters-modal" role="dialog" aria-modal="true" aria-labelledby="event-filters-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="event-filters-title">Advanced Filters</h2>
                        <p className="modal-subtitle">Narrow the list by status, team, category, priority, and event date.</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close filters">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-section">
                        <h3 className="form-section-title">Status</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="event-filter-status">Work status</label>
                            <select
                                id="event-filter-status"
                                className="form-input"
                                value={draftStatus}
                                onChange={(event) => setDraftStatus(event.target.value as EventQueryParams['status'] | '')}
                            >
                                <option value="">All statuses</option>
                                {WORK_STATUSES.map((value) => (
                                    <option key={value} value={value}>{STATUS_LABELS[value]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Team</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="event-filter-team">Assigned team</label>
                            <select
                                id="event-filter-team"
                                className="form-input"
                                value={draftTeam}
                                onChange={(event) => setDraftTeam(event.target.value)}
                            >
                                <option value="">All teams</option>
                                {allTeams.map((team) => (
                                    <option key={team.id} value={String(team.id)}>{team.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Category</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="event-filter-category">Event category</label>
                            <select
                                id="event-filter-category"
                                className="form-input"
                                value={draftCategory}
                                onChange={(event) => setDraftCategory(event.target.value)}
                            >
                                <option value="">All categories</option>
                                {allCategories.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Priority</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="event-filter-priority">Priority</label>
                            <select
                                id="event-filter-priority"
                                className="form-input"
                                value={draftPriority}
                                onChange={(event) => setDraftPriority(event.target.value)}
                            >
                                <option value="">All priorities</option>
                                {PRIORITIES.map((priority) => (
                                    <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Date range</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="event-filter-date-from">From</label>
                                <input
                                    id="event-filter-date-from"
                                    type="date"
                                    className="form-input"
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="event-filter-date-to">To</label>
                                <input
                                    id="event-filter-date-to"
                                    type="date"
                                    className="form-input"
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setDraftStatus('');
                            setDraftDateFrom('');
                            setDraftDateTo('');
                            setDraftTeam('');
                            setDraftCategory('');
                            setDraftPriority('');
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
                            status: draftStatus,
                            dateFrom: draftDateFrom,
                            dateTo: draftDateTo,
                            filterTeam: draftTeam,
                            filterCategory: draftCategory,
                            filterPriority: draftPriority,
                        })}
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
}
