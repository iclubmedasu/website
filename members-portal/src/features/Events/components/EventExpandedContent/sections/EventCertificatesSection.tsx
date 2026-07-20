'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Filter, Search } from 'lucide-react';
import { formatDate } from '@iclub/shared/utils';
import { Checkbox } from '@/components/checkbox';
import CertificateStatusBadge from '@/components/certificates/CertificateStatusBadge';
import NewCustomCertificateModal from '@/features/Certificates/modals/NewCustomCertificateModal';
import RevokeCertificateModal, {
    type RevokeCertificateTarget,
} from '@/features/Certificates/modals/RevokeCertificateModal';
import CopyPublicVerifyLinkButton from '@/features/Events/components/CopyPublicVerifyLinkButton';
import { buildPublicVerifyUrl } from '@/lib/publicWebsiteUrl';
import {
    certificatesAPI,
    type BulkCertificateRecipient,
    type CertificateListItem,
    type CertificateStatus,
    type CertificateTemplate,
    type CertificateType,
    type EventEligibleCategory,
    type EventEligibleRecipient,
    type EventEligibleResponse,
} from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';
import { isDateWithinRange } from '@/utils/filterDateRange';
import {
    DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
    EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    EVENT_ELIGIBLE_COLUMNS,
    isCertificateEligibleFunnelActive,
    processCertificateEligibleRows,
    type CertificateEligibleFilter,
    type CertificateEligibleSortSpec,
    type CertificateIssueDateRange,
    type CertificateRowStatus,
} from '../certificateEligibleFilterUtils';
import CertificateEligibleFilterModal, {
    CertificateEligibleFilterChips,
} from './CertificateEligibleFilterModal';
import {
    REGISTRATION_EMAIL_DISPLAY_LIMIT,
    REGISTRATION_NAME_DISPLAY_LIMIT,
    REGISTRATION_PHONE_DISPLAY_LIMIT,
    truncateRegistrationCell,
} from '../customFieldUtils';
import type { CertificatesFunnelState } from '../eventExpandedFunnelState';

interface EventCertificatesSectionProps {
    eventId: Id | string;
    isFinalized: boolean;
    isCertifiable: boolean;
    canManage: boolean;
    funnel: CertificatesFunnelState;
    onFunnelChange: (
        next: CertificatesFunnelState | ((prev: CertificatesFunnelState) => CertificatesFunnelState),
    ) => void;
}

interface UnifiedCertificateRow {
    key: string;
    memberId: Id | null;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    type: CertificateType;
    category?: EventEligibleCategory;
    attendanceDaysCount?: number;
    sessionsAttendedCount?: number;
    status: CertificateRowStatus;
    alreadyIssued: boolean;
    issueDate: string | null;
    certificateId: Id | null;
    verificationCode: string | null;
    certStatus: CertificateStatus | null;
    selectable: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function formatCertificateType(type: CertificateType | string): string {
    return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
}

function formatStatusLabel(status: CertificateRowStatus): string {
    if (status === 'NOT_ISSUED') return 'Not issued';
    return status.charAt(0) + status.slice(1).toLowerCase();
}

function recipientKey(recipient: Pick<EventEligibleRecipient, 'memberId' | 'email' | 'type'>): string {
    if (recipient.memberId != null && Number(recipient.memberId) > 0) {
        return `m:${recipient.memberId}:${recipient.type}`;
    }
    return `e:${recipient.email.trim().toLowerCase()}:${recipient.type}`;
}

function certListKey(cert: CertificateListItem): string {
    if (cert.recipientMemberId != null && Number(cert.recipientMemberId) > 0) {
        return `m:${cert.recipientMemberId}:${cert.type}`;
    }
    return `e:${cert.recipientEmail.trim().toLowerCase()}:${cert.type}`;
}

function pickPreferredCert(
    current: CertificateListItem | undefined,
    next: CertificateListItem,
): CertificateListItem {
    if (!current) return next;
    const rank = (status: CertificateStatus) => {
        if (status === 'ISSUED') return 3;
        if (status === 'DRAFT') return 2;
        return 1;
    };
    return rank(next.status) >= rank(current.status) ? next : current;
}

function buildUnifiedRows(
    eligible: EventEligibleResponse | null,
    issued: CertificateListItem[],
): UnifiedCertificateRow[] {
    const certByKey = new Map<string, CertificateListItem>();
    for (const cert of issued) {
        const key = certListKey(cert);
        certByKey.set(key, pickPreferredCert(certByKey.get(key), cert));
    }

    const recipients: EventEligibleRecipient[] = eligible
        ? (eligible.recipients?.length
            ? eligible.recipients
            : [
                ...eligible.attendees.map((r) => ({ ...r, category: r.category ?? ('ATTENDEE' as const) })),
                ...eligible.staff.map((r) => ({ ...r, category: r.category ?? ('STAFF' as const) })),
            ])
        : [];

    const usedCertIds = new Set<Id>();
    const rows: UnifiedCertificateRow[] = recipients.map((recipient) => {
        const key = recipientKey(recipient);
        const cert = certByKey.get(key);
        if (cert) usedCertIds.add(cert.id);

        let status: CertificateRowStatus = 'NOT_ISSUED';
        if (cert?.status === 'ISSUED') status = 'ISSUED';
        else if (cert?.status === 'REVOKED') status = 'REVOKED';
        else if (recipient.alreadyIssued) status = 'ISSUED';

        const alreadyIssued = status === 'ISSUED';

        return {
            key,
            memberId: recipient.memberId ?? null,
            fullName: recipient.fullName,
            email: recipient.email,
            phoneNumber: recipient.phoneNumber ?? null,
            type: recipient.type,
            category: recipient.category,
            attendanceDaysCount: recipient.attendanceDaysCount,
            sessionsAttendedCount: recipient.sessionsAttendedCount,
            status,
            alreadyIssued,
            issueDate: cert?.issuedAt ?? cert?.createdAt ?? null,
            certificateId: cert?.id ?? null,
            verificationCode: cert?.verificationCode ?? null,
            certStatus: cert?.status ?? null,
            selectable: !alreadyIssued,
        };
    });

    for (const cert of issued) {
        if (usedCertIds.has(cert.id)) continue;
        const key = `cert:${cert.id}`;
        const status: CertificateRowStatus =
            cert.status === 'ISSUED' ? 'ISSUED' : cert.status === 'REVOKED' ? 'REVOKED' : 'NOT_ISSUED';
        rows.push({
            key,
            memberId: cert.recipientMemberId ?? null,
            fullName: cert.recipientName || cert.recipientMember?.fullName || '—',
            email: cert.recipientEmail,
            phoneNumber: null,
            type: cert.type,
            category: undefined,
            status,
            alreadyIssued: status === 'ISSUED',
            issueDate: cert.issuedAt ?? cert.createdAt ?? null,
            certificateId: cert.id,
            verificationCode: cert.verificationCode,
            certStatus: cert.status,
            selectable: false,
        });
    }

    return rows;
}

export default function EventCertificatesSection({
    eventId,
    isFinalized: _isFinalized,
    isCertifiable,
    canManage,
    funnel,
    onFunnelChange,
}: EventCertificatesSectionProps) {
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [eligible, setEligible] = useState<EventEligibleResponse | null>(null);
    const [issued, setIssued] = useState<CertificateListItem[]>([]);
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const [eligibleLoading, setEligibleLoading] = useState(false);
    const [issuedLoading, setIssuedLoading] = useState(false);
    const [issuing, setIssuing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const search = funnel.search;
    const columnFilters = funnel.columnFilters;
    const sortSpec = funnel.sortSpec;
    const issueDateRange = funnel.issueDateRange;
    const setSearch = (next: string) => {
        onFunnelChange((prev) => ({ ...prev, search: next }));
    };
    const setColumnFilters = (
        next: CertificateEligibleFilter[] | ((current: CertificateEligibleFilter[]) => CertificateEligibleFilter[]),
    ) => {
        onFunnelChange((prev) => ({
            ...prev,
            columnFilters: typeof next === 'function' ? next(prev.columnFilters) : next,
        }));
    };
    const setSortSpec = (
        next: CertificateEligibleSortSpec | ((current: CertificateEligibleSortSpec) => CertificateEligibleSortSpec),
    ) => {
        onFunnelChange((prev) => ({
            ...prev,
            sortSpec: typeof next === 'function' ? next(prev.sortSpec) : next,
        }));
    };
    const setIssueDateRange = (next: CertificateIssueDateRange) => {
        onFunnelChange((prev) => ({ ...prev, issueDateRange: next }));
    };
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<RevokeCertificateTarget | null>(null);

    useEffect(() => {
        let active = true;
        void certificatesAPI.getTemplates({ isActive: true })
            .then((data) => {
                if (!active) return;
                setTemplates(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!active) return;
                setTemplates([]);
            });
        return () => { active = false; };
    }, []);

    const loadIssued = useCallback(async () => {
        setIssuedLoading(true);
        try {
            const data = await certificatesAPI.getAll({ eventId });
            setIssued(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load issued certificates'));
            setIssued([]);
        } finally {
            setIssuedLoading(false);
        }
    }, [eventId]);

    const loadEligible = useCallback(async () => {
        if (!canManage) {
            setEligible(null);
            return;
        }
        setEligibleLoading(true);
        setError(null);
        try {
            const data = await certificatesAPI.getEventEligible(eventId);
            setEligible(data);
            setSelection(new Set());
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load eligible recipients'));
            setEligible(null);
        } finally {
            setEligibleLoading(false);
        }
    }, [canManage, eventId]);

    useEffect(() => {
        if (!isCertifiable) return;
        void loadIssued();
    }, [isCertifiable, loadIssued]);

    useEffect(() => {
        if (!isCertifiable || !canManage) return;
        void loadEligible();
    }, [isCertifiable, canManage, loadEligible]);

    const unifiedRows = useMemo(
        () => buildUnifiedRows(eligible, issued),
        [eligible, issued],
    );

    const filteredRows = useMemo(
        () => processCertificateEligibleRows(
            unifiedRows,
            search,
            columnFilters,
            sortSpec,
            issueDateRange,
            isDateWithinRange,
        ),
        [unifiedRows, search, columnFilters, sortSpec, issueDateRange],
    );

    const filteredSelectableKeys = useMemo(
        () => filteredRows.filter((row) => row.selectable).map((row) => row.key),
        [filteredRows],
    );

    const selectedVisibleCount = useMemo(() => {
        let count = 0;
        for (const key of filteredSelectableKeys) {
            if (selection.has(key)) count += 1;
        }
        return count;
    }, [filteredSelectableKeys, selection]);

    const hasFunnelFiltersActive = isCertificateEligibleFunnelActive(
        columnFilters,
        sortSpec,
        DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
        issueDateRange,
    );

    const toggleSelection = (row: UnifiedCertificateRow) => {
        if (!canManage || !row.selectable) return;
        setSelection((prev) => {
            const next = new Set(prev);
            if (next.has(row.key)) next.delete(row.key);
            else next.add(row.key);
            return next;
        });
    };

    const selectAllFiltered = () => {
        if (!canManage) return;
        setSelection(new Set(filteredSelectableKeys));
    };

    const clearSelection = () => {
        setSelection(new Set());
    };

    const issueSelected = async () => {
        if (!canManage || !selectedTemplateId || selection.size === 0) return;

        const filteredKeys = new Set(filteredSelectableKeys);
        const recipients: BulkCertificateRecipient[] = unifiedRows
            .filter((r) => selection.has(r.key) && filteredKeys.has(r.key) && r.selectable)
            .map((r) => ({
                memberId: r.memberId,
                recipientName: r.fullName,
                recipientEmail: r.email,
                type: r.type,
            }));

        if (recipients.length === 0) return;

        setIssuing(true);
        setError(null);
        setMessage(null);
        try {
            const result = await certificatesAPI.issueBulkForEvent(eventId, {
                templateId: Number(selectedTemplateId) as Id,
                issueImmediately: true,
                recipients,
            });
            setMessage(`${result.created} certificates issued, ${result.skipped} skipped`);
            await Promise.all([loadEligible(), loadIssued()]);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to issue certificates'));
        } finally {
            setIssuing(false);
        }
    };

    const openRevokeModal = (row: UnifiedCertificateRow) => {
        if (!canManage || !row.certificateId) return;
        setRevokeTarget({
            id: row.certificateId,
            recipientName: row.fullName,
        });
    };

    if (!isCertifiable) {
        return (
            <section className="event-expanded-panel">
                <div className="event-expanded-header event-expanded-header--compact">
                    <h2 className="expanded-section-title">Certificates</h2>
                </div>
                <p className="event-expanded-muted">
                    This event is not marked as certifiable. Enable it in event settings to issue certificates.
                </p>
            </section>
        );
    }

    const eventTitle = eligible?.eventTitle ?? '';
    const loading = (eligibleLoading && canManage && !eligible) || (issuedLoading && issued.length === 0);

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact">
                <h2 className="expanded-section-title">Certificates</h2>
            </div>

            {error ? <div className="error-message event-cert-message">{error}</div> : null}
            {message ? <div className="event-cert-message event-cert-message--success">{message}</div> : null}

            <div className="page-search-row event-registration-search-row">
                <div className="page-search-field page-search-field--full event-registration-search-field">
                    <Search className="page-search-icon" size={16} />
                    <input
                        type="search"
                        className="page-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, or phone"
                        aria-label="Search certificate recipients"
                    />
                    <button
                        type="button"
                        className={`page-search-filter-btn${hasFunnelFiltersActive ? ' page-search-filter-btn--active' : ''}`}
                        onClick={() => setFilterModalOpen(true)}
                        aria-label="Open sort and filters"
                    >
                        <Filter size={16} />
                        <span className="page-search-filter-label">Sort & Filters</span>
                    </button>
                </div>
            </div>

            <CertificateEligibleFilterChips
                filters={columnFilters}
                columns={EVENT_ELIGIBLE_COLUMNS}
                issueDateRange={issueDateRange}
                onRemove={(index) => setColumnFilters((current) => (
                    current.filter((_, filterIndex) => filterIndex !== index)
                ))}
                onClearAll={() => setColumnFilters([])}
                onClearIssueDate={() => setIssueDateRange(EMPTY_CERTIFICATE_ISSUE_DATE_RANGE)}
            />

            <CertificateEligibleFilterModal
                open={filterModalOpen}
                columns={EVENT_ELIGIBLE_COLUMNS}
                activeFilters={columnFilters}
                sortSpec={sortSpec}
                issueDateRange={issueDateRange}
                onClose={() => setFilterModalOpen(false)}
                onApply={(filters, nextSort, nextRange) => {
                    setColumnFilters(filters);
                    setSortSpec(nextSort);
                    setIssueDateRange(nextRange);
                }}
                onClear={() => {
                    setColumnFilters([]);
                    setSortSpec(DEFAULT_CERTIFICATE_ELIGIBLE_SORT);
                    setIssueDateRange(EMPTY_CERTIFICATE_ISSUE_DATE_RANGE);
                }}
            />

            <div className="event-cert-layout">
                <div className="event-registrations-table-shell event-cert-table-shell">
                    <div className="table-container event-cert-table-scroll">
                        {loading ? (
                            <p className="event-expanded-muted">Loading certificates…</p>
                        ) : filteredRows.length === 0 ? (
                            <p className="event-expanded-muted">
                                {unifiedRows.length === 0
                                    ? 'No recipients or certificates yet.'
                                    : 'No rows match these filters.'}
                            </p>
                        ) : (
                            <table className="members-table event-registrations-table">
                                <thead>
                                    <tr>
                                        {canManage ? <th aria-label="Select" /> : null}
                                        <th className="event-registrations-name-cell">Name</th>
                                        <th className="event-registrations-email-cell">Email</th>
                                        <th className="event-registrations-phone-cell">Phone</th>
                                        <th>Type</th>
                                        <th>Days attended</th>
                                        <th>Sessions attended</th>
                                        <th>Status</th>
                                        <th>Issue date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row, index) => {
                                        const checked = selection.has(row.key);
                                        return (
                                            <tr
                                                key={row.key}
                                                className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                                            >
                                                {canManage ? (
                                                    <td>
                                                        <Checkbox
                                                            color="purple"
                                                            checked={checked}
                                                            disabled={!row.selectable}
                                                            onChange={() => toggleSelection(row)}
                                                            aria-label={`Select ${row.fullName}`}
                                                        />
                                                    </td>
                                                ) : null}
                                                <td
                                                    className="event-registrations-name-cell"
                                                    title={row.fullName || undefined}
                                                >
                                                    {row.fullName
                                                        ? truncateRegistrationCell(
                                                            row.fullName,
                                                            REGISTRATION_NAME_DISPLAY_LIMIT,
                                                        )
                                                        : '—'}
                                                </td>
                                                <td
                                                    className="event-registrations-email-cell"
                                                    title={row.email || undefined}
                                                >
                                                    {row.email
                                                        ? truncateRegistrationCell(
                                                            row.email,
                                                            REGISTRATION_EMAIL_DISPLAY_LIMIT,
                                                        )
                                                        : '—'}
                                                </td>
                                                <td
                                                    className="event-registrations-phone-cell"
                                                    title={row.phoneNumber || undefined}
                                                >
                                                    {row.phoneNumber
                                                        ? truncateRegistrationCell(
                                                            row.phoneNumber,
                                                            REGISTRATION_PHONE_DISPLAY_LIMIT,
                                                        )
                                                        : '—'}
                                                </td>
                                                <td>
                                                    <span className="badge">
                                                        {formatCertificateType(row.type)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {row.attendanceDaysCount !== undefined
                                                        ? row.attendanceDaysCount
                                                        : '—'}
                                                </td>
                                                <td>
                                                    {row.sessionsAttendedCount !== undefined
                                                        ? row.sessionsAttendedCount
                                                        : '—'}
                                                </td>
                                                <td>
                                                    <CertificateStatusBadge
                                                        status={row.status}
                                                        label={formatStatusLabel(row.status)}
                                                        canRevoke={
                                                            Boolean(
                                                                canManage
                                                                    && row.certStatus === 'ISSUED'
                                                                    && row.certificateId,
                                                            )
                                                        }
                                                        onRevoke={() => openRevokeModal(row)}
                                                        recipientName={row.fullName}
                                                    />
                                                </td>
                                                <td>{row.issueDate ? formatDate(row.issueDate) : '—'}</td>
                                                <td>
                                                    <div className="action-buttons event-cert-inline-actions">
                                                        {row.verificationCode ? (
                                                            <button
                                                                type="button"
                                                                className="table-action-btn view-btn"
                                                                title="View certificate"
                                                                onClick={() => {
                                                                    void buildPublicVerifyUrl(
                                                                        row.verificationCode!,
                                                                    ).then((url) => {
                                                                        window.open(
                                                                            url,
                                                                            '_blank',
                                                                            'noopener,noreferrer',
                                                                        );
                                                                    });
                                                                }}
                                                            >
                                                                <Eye />
                                                            </button>
                                                        ) : null}
                                                        {/* TODO: restore copy link
                                                        {row.verificationCode ? (
                                                            <CopyPublicVerifyLinkButton
                                                                verificationCode={row.verificationCode}
                                                            />
                                                        ) : null}
                                                        */}
                                                        {!row.verificationCode && row.selectable ? (
                                                            <span className="event-expanded-muted">—</span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {canManage ? (
                        <div className="event-cert-io-bar">
                            <button
                                type="button"
                                className="btn btn-secondary event-cert-io-btn"
                                disabled={filteredSelectableKeys.length === 0}
                                onClick={selectAllFiltered}
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary event-cert-io-btn"
                                disabled={selection.size === 0}
                                onClick={clearSelection}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary event-cert-io-btn"
                                disabled={!selectedTemplateId || selectedVisibleCount === 0 || issuing}
                                onClick={() => void issueSelected()}
                            >
                                {issuing
                                    ? 'Issuing…'
                                    : selectedVisibleCount > 0
                                        ? `Issue selected (${selectedVisibleCount})`
                                        : 'Issue selected'}
                            </button>
                            <select
                                className="form-input event-cert-io-template"
                                aria-label="Certificate template"
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                            >
                                <option value="">Select template…</option>
                                {templates.map((template) => (
                                    <option key={template.id} value={String(template.id)}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-secondary event-cert-io-btn"
                                onClick={() => setCustomModalOpen(true)}
                            >
                                Issue custom
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <NewCustomCertificateModal
                isOpen={customModalOpen}
                onClose={() => setCustomModalOpen(false)}
                onSuccess={async () => {
                    setMessage('Custom certificate created');
                    await Promise.all([loadEligible(), loadIssued()]);
                }}
                eventId={eventId}
                defaultTitle={eventTitle}
            />

            <RevokeCertificateModal
                target={revokeTarget}
                onClose={() => setRevokeTarget(null)}
                onRevoked={async () => {
                    setError(null);
                    await Promise.all([loadEligible(), loadIssued()]);
                }}
            />
        </section>
    );
}
