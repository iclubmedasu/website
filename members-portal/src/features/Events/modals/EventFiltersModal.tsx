'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { EventQueryParams } from '@/types/backend-contracts';

interface EventFiltersModalProps {
    status: EventQueryParams['status'] | '';
    dateFrom: string;
    dateTo: string;
    onClose: () => void;
    onApply: (filters: {
        status: EventQueryParams['status'] | '';
        dateFrom: string;
        dateTo: string;
    }) => void;
    onClear: () => void;
}

export default function EventFiltersModal({
    status,
    dateFrom,
    dateTo,
    onClose,
    onApply,
    onClear,
}: EventFiltersModalProps) {
    const [draftStatus, setDraftStatus] = useState<EventQueryParams['status'] | ''>(status);
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container events-filters-modal" role="dialog" aria-modal="true" aria-labelledby="event-filters-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="event-filters-title">Advanced Filters</h2>
                        <p className="modal-subtitle">Narrow the list by status and event date range.</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close filters">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-section">
                        <h3 className="form-section-title">Status</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="event-filter-status">Event status</label>
                            <select
                                id="event-filter-status"
                                className="form-input"
                                value={draftStatus}
                                onChange={(event) => setDraftStatus(event.target.value as EventQueryParams['status'] | '')}
                            >
                                <option value="">All statuses</option>
                                <option value="DRAFT">Draft</option>
                                <option value="PUBLISHED">Published</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
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
                        onClick={() => onApply({ status: draftStatus, dateFrom: draftDateFrom, dateTo: draftDateTo })}
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
}