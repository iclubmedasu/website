'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { DateInput } from '@/components/input/DateInput';
import type { CertificateStatus, CertificateType } from '@/services/certificatesAPI';
import '../../Events/modals/EventFiltersModal.css';

export type CertificatesFiltersVariant = 'certificates' | 'templates';
export type CertificatesNameSort = '' | 'asc' | 'desc';
export type TemplateActiveFilter = '' | 'active' | 'inactive';

export interface CertificatesFiltersState {
    status: CertificateStatus | '';
    type: CertificateType | '';
    activeFilter: TemplateActiveFilter;
    dateFrom: string;
    dateTo: string;
    nameSort: CertificatesNameSort;
}

export const EMPTY_CERTIFICATES_FILTERS: CertificatesFiltersState = {
    status: '',
    type: '',
    activeFilter: '',
    dateFrom: '',
    dateTo: '',
    nameSort: '',
};

const CERTIFICATE_TYPES: CertificateType[] = [
    'ATTENDANCE',
    'ORGANIZATION',
    'CONTRIBUTION',
    'LEADERSHIP',
    'ADMINISTRATION',
    'SUPERVISION',
    'PARTICIPATION',
    'CUSTOM',
];

const CERTIFICATE_STATUSES: CertificateStatus[] = ['DRAFT', 'ISSUED', 'REVOKED'];

function formatCertificateType(type: CertificateType): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
}

interface CertificatesFiltersModalProps {
    variant: CertificatesFiltersVariant;
    status: CertificateStatus | '';
    type: CertificateType | '';
    activeFilter: TemplateActiveFilter;
    dateFrom: string;
    dateTo: string;
    nameSort: CertificatesNameSort;
    onClose: () => void;
    onApply: (filters: CertificatesFiltersState) => void;
    onClear: () => void;
}

export default function CertificatesFiltersModal({
    variant,
    status,
    type,
    activeFilter,
    dateFrom,
    dateTo,
    nameSort,
    onClose,
    onApply,
    onClear,
}: CertificatesFiltersModalProps) {
    const [draftStatus, setDraftStatus] = useState<CertificateStatus | ''>(status);
    const [draftType, setDraftType] = useState<CertificateType | ''>(type);
    const [draftActiveFilter, setDraftActiveFilter] = useState<TemplateActiveFilter>(activeFilter);
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);
    const [draftNameSort, setDraftNameSort] = useState<CertificatesNameSort>(nameSort);

    const isCertificates = variant === 'certificates';
    const titleId = isCertificates ? 'certificates-filters-title' : 'templates-filters-title';

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container events-filters-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id={titleId}>
                            Advanced Filters
                        </h2>
                        <p className="modal-subtitle">
                            {isCertificates
                                ? 'Narrow certificates by status, type, issue date, and name sort.'
                                : 'Narrow templates by status, created date, and name sort.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onClose}
                        aria-label="Close filters"
                    >
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {isCertificates ? (
                        <>
                            <div className="form-section">
                                <h3 className="form-section-title">Status</h3>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="certificates-filter-status">
                                        Certificate status
                                    </label>
                                    <select
                                        id="certificates-filter-status"
                                        className="form-input"
                                        value={draftStatus}
                                        onChange={(event) =>
                                            setDraftStatus(event.target.value as CertificateStatus | '')
                                        }
                                    >
                                        <option value="">All statuses</option>
                                        {CERTIFICATE_STATUSES.map((value) => (
                                            <option key={value} value={value}>
                                                {value.charAt(0) + value.slice(1).toLowerCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Type</h3>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="certificates-filter-type">
                                        Certificate type
                                    </label>
                                    <select
                                        id="certificates-filter-type"
                                        className="form-input"
                                        value={draftType}
                                        onChange={(event) =>
                                            setDraftType(event.target.value as CertificateType | '')
                                        }
                                    >
                                        <option value="">All types</option>
                                        {CERTIFICATE_TYPES.map((value) => (
                                            <option key={value} value={value}>
                                                {formatCertificateType(value)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="form-section">
                            <h3 className="form-section-title">Status</h3>
                            <div className="form-group">
                                <label className="form-label" htmlFor="templates-filter-active">
                                    Template status
                                </label>
                                <select
                                    id="templates-filter-active"
                                    className="form-input"
                                    value={draftActiveFilter}
                                    onChange={(event) =>
                                        setDraftActiveFilter(event.target.value as TemplateActiveFilter)
                                    }
                                >
                                    <option value="">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="form-section">
                        <h3 className="form-section-title">Date range</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor={
                                        isCertificates
                                            ? 'certificates-filter-date-from'
                                            : 'templates-filter-date-from'
                                    }
                                >
                                    From
                                </label>
                                <DateInput
                                    id={
                                        isCertificates
                                            ? 'certificates-filter-date-from'
                                            : 'templates-filter-date-from'
                                    }
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label
                                    className="form-label"
                                    htmlFor={
                                        isCertificates
                                            ? 'certificates-filter-date-to'
                                            : 'templates-filter-date-to'
                                    }
                                >
                                    To
                                </label>
                                <DateInput
                                    id={
                                        isCertificates
                                            ? 'certificates-filter-date-to'
                                            : 'templates-filter-date-to'
                                    }
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                        <p className="form-hint-text">
                            {isCertificates
                                ? 'Filters by issue date, falling back to created date when not issued.'
                                : 'Filters by template created date.'}
                        </p>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Sort</h3>
                        <div className="form-group">
                            <label
                                className="form-label"
                                htmlFor={
                                    isCertificates
                                        ? 'certificates-filter-name-sort'
                                        : 'templates-filter-name-sort'
                                }
                            >
                                {isCertificates ? 'Recipient name' : 'Template name'}
                            </label>
                            <select
                                id={
                                    isCertificates
                                        ? 'certificates-filter-name-sort'
                                        : 'templates-filter-name-sort'
                                }
                                className="form-input"
                                value={draftNameSort}
                                onChange={(event) =>
                                    setDraftNameSort(event.target.value as CertificatesNameSort)
                                }
                            >
                                <option value="">Default order</option>
                                <option value="asc">A→Z</option>
                                <option value="desc">Z→A</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setDraftStatus('');
                            setDraftType('');
                            setDraftActiveFilter('');
                            setDraftDateFrom('');
                            setDraftDateTo('');
                            setDraftNameSort('');
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
                        onClick={() =>
                            onApply({
                                status: draftStatus,
                                type: draftType,
                                activeFilter: draftActiveFilter,
                                dateFrom: draftDateFrom,
                                dateTo: draftDateTo,
                                nameSort: draftNameSort,
                            })
                        }
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
}
