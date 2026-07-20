'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface CertificateIssuedFilters {
    dateFrom: string;
    dateTo: string;
}

export const EMPTY_CERTIFICATE_ISSUED_FILTERS: CertificateIssuedFilters = {
    dateFrom: '',
    dateTo: '',
};

export function isCertificateIssuedFunnelActive(filters: CertificateIssuedFilters): boolean {
    return Boolean(filters.dateFrom || filters.dateTo);
}

interface CertificateIssuedFilterModalProps {
    open: boolean;
    dateFrom: string;
    dateTo: string;
    onClose: () => void;
    onApply: (filters: CertificateIssuedFilters) => void;
    onClear: () => void;
}

export default function CertificateIssuedFilterModal({
    open,
    dateFrom,
    dateTo,
    onClose,
    onApply,
    onClear,
}: CertificateIssuedFilterModalProps) {
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);

    useEffect(() => {
        if (open) {
            setDraftDateFrom(dateFrom);
            setDraftDateTo(dateTo);
        }
    }, [dateFrom, dateTo, open]);

    if (!open) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container events-filters-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="certificate-issued-filter-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="certificate-issued-filter-title">
                            Advanced Filters
                        </h2>
                        <p className="modal-subtitle">
                            Narrow issued certificates by issue date range.
                        </p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="form-section">
                        <h3 className="form-section-title">Issued date</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="cert-issued-date-from">
                                    Issued from
                                </label>
                                <input
                                    id="cert-issued-date-from"
                                    type="date"
                                    className="form-input"
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="cert-issued-date-to">
                                    Issued to
                                </label>
                                <input
                                    id="cert-issued-date-to"
                                    type="date"
                                    className="form-input"
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                        <p className="form-hint-text">
                            Uses issue date when present, otherwise created date.
                        </p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
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
                        onClick={() => {
                            onApply({
                                dateFrom: draftDateFrom,
                                dateTo: draftDateTo,
                            });
                            onClose();
                        }}
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
}

interface CertificateIssuedFilterChipsProps {
    filters: CertificateIssuedFilters;
    onClear: () => void;
}

export function CertificateIssuedFilterChips({
    filters,
    onClear,
}: CertificateIssuedFilterChipsProps) {
    if (!isCertificateIssuedFunnelActive(filters)) return null;

    const parts: string[] = [];
    if (filters.dateFrom) parts.push(`From ${filters.dateFrom}`);
    if (filters.dateTo) parts.push(`To ${filters.dateTo}`);

    return (
        <div className="event-registration-filter-chips">
            <button
                type="button"
                className="event-registration-filter-chip"
                onClick={onClear}
                aria-label={`Remove date filter: ${parts.join(' · ')}`}
            >
                <span>{parts.join(' · ')}</span>
                <X size={12} />
            </button>
            <button type="button" className="event-registration-filter-clear" onClick={onClear}>
                Clear all
            </button>
        </div>
    );
}
