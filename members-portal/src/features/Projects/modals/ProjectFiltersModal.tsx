'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { DateInput } from '@/components/input/DateInput';
import { FormSelect } from '@/components/input/FormSelect';
import type { ProjectStatus, TeamRef } from '@/types/backend-contracts';

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

export interface ProjectFiltersState {
    filterTeam: string;
    filterCategory: string;
    filterPriority: string;
    filterStatus: string;
    dateFrom: string;
    dateTo: string;
}

interface ProjectFiltersModalProps {
    filterTeam: string;
    filterCategory: string;
    filterPriority: string;
    filterStatus: string;
    dateFrom: string;
    dateTo: string;
    allTeams: TeamRef[];
    allCategories: string[];
    dateRangeLabel?: string;
    onClose: () => void;
    onApply: (filters: ProjectFiltersState) => void;
    onClear: () => void;
}

export default function ProjectFiltersModal({
    filterTeam,
    filterCategory,
    filterPriority,
    filterStatus,
    dateFrom,
    dateTo,
    allTeams,
    allCategories,
    dateRangeLabel = 'Due date range',
    onClose,
    onApply,
    onClear,
}: ProjectFiltersModalProps) {
    const [draftStatus, setDraftStatus] = useState(filterStatus);
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);
    const [draftTeam, setDraftTeam] = useState(filterTeam);
    const [draftCategory, setDraftCategory] = useState(filterCategory);
    const [draftPriority, setDraftPriority] = useState(filterPriority);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container events-filters-modal" role="dialog" aria-modal="true" aria-labelledby="project-filters-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="project-filters-title">Advanced Filters</h2>
                        <p className="modal-subtitle">Narrow the list by status, team, category, priority, and date.</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close filters">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-section">
                        <h3 className="form-section-title">Status</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="project-filter-status">Work status</label>
                            <FormSelect
                                id="project-filter-status"
                                value={draftStatus}
                                onChange={(event) => setDraftStatus(event.target.value)}
                                placeholder="All statuses"
                                options={[
                                    { value: '', label: 'All statuses' },
                                    ...WORK_STATUSES.map((value) => ({
                                        value,
                                        label: STATUS_LABELS[value],
                                    })),
                                ]}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Team</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="project-filter-team">Assigned team</label>
                            <FormSelect
                                id="project-filter-team"
                                value={draftTeam}
                                onChange={(event) => setDraftTeam(event.target.value)}
                                placeholder="All teams"
                                options={[
                                    { value: '', label: 'All teams' },
                                    ...allTeams.map((team) => ({
                                        value: String(team.id),
                                        label: team.name,
                                    })),
                                ]}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Category</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="project-filter-category">Project category</label>
                            <FormSelect
                                id="project-filter-category"
                                value={draftCategory}
                                onChange={(event) => setDraftCategory(event.target.value)}
                                placeholder="All categories"
                                options={[
                                    { value: '', label: 'All categories' },
                                    ...allCategories.map((category) => ({
                                        value: category,
                                        label: category,
                                    })),
                                ]}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Priority</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="project-filter-priority">Priority</label>
                            <FormSelect
                                id="project-filter-priority"
                                value={draftPriority}
                                onChange={(event) => setDraftPriority(event.target.value)}
                                placeholder="All priorities"
                                options={[
                                    { value: '', label: 'All priorities' },
                                    ...PRIORITIES.map((priority) => ({
                                        value: priority,
                                        label: PRIORITY_LABELS[priority],
                                    })),
                                ]}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Date range</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="project-filter-date-from">From</label>
                                <DateInput
                                    id="project-filter-date-from"
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="project-filter-date-to">To</label>
                                <DateInput
                                    id="project-filter-date-to"
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                        <p className="form-hint-text">{dateRangeLabel}</p>
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
                            filterTeam: draftTeam,
                            filterCategory: draftCategory,
                            filterPriority: draftPriority,
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
