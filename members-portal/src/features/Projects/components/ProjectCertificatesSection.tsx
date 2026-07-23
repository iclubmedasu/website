'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, Filter, Loader2, Mail, Search } from 'lucide-react';
import { formatDate } from '@iclub/shared/utils';
import { Checkbox } from '@/components/checkbox';
import CertificateStatusBadge from '@/components/certificates/CertificateStatusBadge';
import NewCustomCertificateModal from '@/features/Certificates/modals/NewCustomCertificateModal';
import ReissueCertificateModal, {
    type ReissueCertificateTarget,
} from '@/features/Certificates/modals/ReissueCertificateModal';
import RevokeCertificateModal, {
    type RevokeCertificateTarget,
} from '@/features/Certificates/modals/RevokeCertificateModal';
import CopyPublicVerifyLinkButton from '@/features/Events/components/CopyPublicVerifyLinkButton';
import { useAutoDismissMessage } from '@/hooks/useAutoDismissMessage';
import { buildPublicVerifyUrl } from '@/lib/publicWebsiteUrl';
import {
    certificatesAPI,
    type BulkCertificateRecipient,
    type CertificateListItem,
    type CertificateStatus,
    type CertificateTemplate,
    type CertificateType,
    type ProjectEligibleRecipient,
    type ProjectEligibleResponse,
} from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';
import { isDateWithinRange } from '@/utils/filterDateRange';
import {
    DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
    EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    isCertificateEligibleFunnelActive,
    processCertificateEligibleRows,
    PROJECT_ELIGIBLE_COLUMNS,
    type CertificateEligibleFilter,
    type CertificateEligibleSortSpec,
    type CertificateIssueDateRange,
    type CertificateRowStatus,
} from '@/features/Events/components/EventExpandedContent/certificateEligibleFilterUtils';
import CertificateEligibleFilterModal, {
    CertificateEligibleFilterChips,
} from '@/features/Events/components/EventExpandedContent/sections/CertificateEligibleFilterModal';
import EditableCertificateTypeCell from '@/features/Events/components/EventExpandedContent/sections/EditableCertificateTypeCell';
import {
    REGISTRATION_EMAIL_DISPLAY_LIMIT,
    REGISTRATION_NAME_DISPLAY_LIMIT,
    truncateRegistrationCell,
} from '@/features/Events/components/EventExpandedContent/customFieldUtils';
import './ProjectCertificatesSection.css';

interface ProjectCertificatesSectionProps {
    projectId: Id | string;
    projectTitle: string;
    isFinalized: boolean;
    canManage: boolean;
}

interface UnifiedCertificateRow {
    key: string;
    memberId: Id | null;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    type: CertificateType;
    taskCount?: number;
    status: CertificateRowStatus;
    alreadyIssued: boolean;
    issueDate: string | null;
    certificateId: Id | null;
    verificationCode: string | null;
    certStatus: CertificateStatus | null;
    certificateEmailSentAt: string | null;
    selectable: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function formatStatusLabel(status: CertificateRowStatus): string {
    if (status === 'NOT_ISSUED') return 'Not issued';
    return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatCertificateEmailStatus(
    row: Pick<UnifiedCertificateRow, 'certStatus' | 'certificateEmailSentAt'>,
): { label: string; sent: boolean; sentAt?: string | null } | null {
    if (row.certStatus !== 'ISSUED' && !row.certificateEmailSentAt) return null;
    if (row.certificateEmailSentAt) {
        return { label: 'Sent', sent: true, sentAt: row.certificateEmailSentAt };
    }
    if (row.certStatus === 'ISSUED') {
        return { label: 'Not sent', sent: false };
    }
    return null;
}

function canResendCertificateEmail(row: UnifiedCertificateRow): boolean {
    return (
        row.certStatus === 'ISSUED'
        && row.certificateId != null
        && Boolean(row.email?.trim())
    );
}

function recipientKey(recipient: Pick<ProjectEligibleRecipient, 'memberId' | 'type'>): string {
    return `m:${recipient.memberId}:${recipient.type}`;
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
    eligible: ProjectEligibleResponse | null,
    issued: CertificateListItem[],
): UnifiedCertificateRow[] {
    const certByKey = new Map<string, CertificateListItem>();
    for (const cert of issued) {
        const key = certListKey(cert);
        certByKey.set(key, pickPreferredCert(certByKey.get(key), cert));
    }

    const contributors = eligible?.contributors ?? [];
    const usedCertIds = new Set<Id>();
    const rows: UnifiedCertificateRow[] = contributors.map((recipient) => {
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
            memberId: recipient.memberId,
            fullName: recipient.fullName,
            email: recipient.email,
            phoneNumber: recipient.phoneNumber ?? null,
            type: recipient.type,
            taskCount: recipient.taskCount,
            status,
            alreadyIssued,
            issueDate: cert?.issuedAt ?? cert?.createdAt ?? null,
            certificateId: cert?.id ?? null,
            verificationCode: cert?.verificationCode ?? null,
            certStatus: cert?.status ?? null,
            certificateEmailSentAt: cert?.certificateEmailSentAt ?? null,
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
            status,
            alreadyIssued: status === 'ISSUED',
            issueDate: cert.issuedAt ?? cert.createdAt ?? null,
            certificateId: cert.id,
            verificationCode: cert.verificationCode,
            certStatus: cert.status,
            certificateEmailSentAt: cert.certificateEmailSentAt ?? null,
            selectable: false,
        });
    }

    return rows;
}

export default function ProjectCertificatesSection({
    projectId,
    projectTitle,
    isFinalized,
    canManage,
}: ProjectCertificatesSectionProps) {
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [eligible, setEligible] = useState<ProjectEligibleResponse | null>(null);
    const [issued, setIssued] = useState<CertificateListItem[]>([]);
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const [typeOverrides, setTypeOverrides] = useState<Map<string, CertificateType>>(new Map());
    const [eligibleLoading, setEligibleLoading] = useState(false);
    const [issuedLoading, setIssuedLoading] = useState(false);
    const [issuing, setIssuing] = useState(false);
    const [resendingEmailId, setResendingEmailId] = useState<number | null>(null);
    const [downloadingPdfCode, setDownloadingPdfCode] = useState<string | null>(null);
    const { message, show: showSuccessMessage, clear: clearSuccessMessage } = useAutoDismissMessage();
    const [error, setError] = useState<string | null>(null);
    const {
        message: issueTemplateHint,
        show: showIssueTemplateHint,
        clear: clearIssueTemplateHint,
    } = useAutoDismissMessage();
    const [search, setSearch] = useState('');
    const [columnFilters, setColumnFilters] = useState<CertificateEligibleFilter[]>([]);
    const [sortSpec, setSortSpec] = useState<CertificateEligibleSortSpec>(DEFAULT_CERTIFICATE_ELIGIBLE_SORT);
    const [issueDateRange, setIssueDateRange] = useState<CertificateIssueDateRange>(
        EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    );
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<RevokeCertificateTarget | null>(null);
    const [reissueTarget, setReissueTarget] = useState<ReissueCertificateTarget | null>(null);

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
            const data = await certificatesAPI.getAll({ projectId });
            setIssued(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load issued certificates'));
            setIssued([]);
        } finally {
            setIssuedLoading(false);
        }
    }, [projectId]);

    const loadEligible = useCallback(async () => {
        if (!canManage) {
            setEligible(null);
            return;
        }
        setEligibleLoading(true);
        setError(null);
        try {
            const data = await certificatesAPI.getProjectEligible(projectId);
            setEligible(data);
            setSelection(new Set());
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load eligible contributors'));
            setEligible(null);
        } finally {
            setEligibleLoading(false);
        }
    }, [canManage, projectId]);

    useEffect(() => {
        if (!isFinalized) return;
        void loadIssued();
    }, [isFinalized, loadIssued]);

    useEffect(() => {
        if (!isFinalized || !canManage) return;
        void loadEligible();
    }, [isFinalized, canManage, loadEligible]);

    const unifiedRows = useMemo(
        () => buildUnifiedRows(eligible, issued),
        [eligible, issued],
    );

    useEffect(() => {
        setTypeOverrides((prev) => {
            if (prev.size === 0) return prev;
            const selectableKeys = new Set(
                unifiedRows.filter((row) => row.selectable).map((row) => row.key),
            );
            let changed = false;
            const next = new Map<string, CertificateType>();
            for (const [key, type] of prev) {
                if (selectableKeys.has(key)) {
                    next.set(key, type);
                } else {
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [unifiedRows]);

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
    const linkedTitle = eligible?.projectTitle || projectTitle;

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
        clearIssueTemplateHint();
    };

    const issueSelected = async () => {
        if (!canManage || selection.size === 0 || issuing) return;

        if (!selectedTemplateId.trim()) {
            showIssueTemplateHint('Select a template first');
            return;
        }

        const filteredKeys = new Set(filteredSelectableKeys);
        const recipients: BulkCertificateRecipient[] = unifiedRows
            .filter((r) => selection.has(r.key) && filteredKeys.has(r.key) && r.selectable)
            .map((r) => ({
                memberId: r.memberId,
                recipientName: r.fullName,
                recipientEmail: r.email,
                type: typeOverrides.get(r.key) ?? r.type,
            }));

        if (recipients.length === 0) return;

        clearIssueTemplateHint();
        setIssuing(true);
        setError(null);
        clearSuccessMessage();
        try {
            const result = await certificatesAPI.issueBulkForProject(projectId, {
                templateId: Number(selectedTemplateId) as Id,
                issueImmediately: true,
                recipients,
            });
            showSuccessMessage(`${result.created} certificates issued, ${result.skipped} skipped`);
            setTypeOverrides(new Map());
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

    const openReissueModal = (row: UnifiedCertificateRow) => {
        if (!canManage || !row.certificateId) return;
        setReissueTarget({
            id: row.certificateId,
            recipientName: row.fullName,
        });
    };

    const handleResendEmail = async (row: UnifiedCertificateRow) => {
        if (!canManage || !canResendCertificateEmail(row) || row.certificateId == null) return;
        setResendingEmailId(Number(row.certificateId));
        try {
            const result = await certificatesAPI.resendEmail(row.certificateId);
            window.alert(result.message || 'Certificate email sent.');
            await loadIssued();
        } catch (err: unknown) {
            window.alert(getErrorMessage(err, 'Failed to send certificate email.'));
        } finally {
            setResendingEmailId(null);
        }
    };

    const handleDownloadPdf = async (row: UnifiedCertificateRow) => {
        const code = row.verificationCode?.trim();
        if (!code || row.certStatus !== 'ISSUED') return;
        setDownloadingPdfCode(code);
        try {
            await certificatesAPI.downloadPdfByVerificationCode(code);
        } catch (err: unknown) {
            window.alert(getErrorMessage(err, 'Failed to download certificate PDF.'));
        } finally {
            setDownloadingPdfCode(null);
        }
    };

    if (!isFinalized) {
        return (
            <p className="project-cert-muted">
                Certificates can only be issued after the project is finalized.
            </p>
        );
    }

    const loading = (eligibleLoading && canManage && !eligible) || (issuedLoading && issued.length === 0);
    const hasTemplateSelected = selectedTemplateId.trim().length > 0;
    const needsTemplate = selectedVisibleCount > 0 && !hasTemplateSelected;

    return (
        <div className="project-cert-section">
            {error ? <div className="error-message project-cert-message">{error}</div> : null}
            {message ? <div className="project-cert-message project-cert-message--success">{message}</div> : null}

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
                columns={PROJECT_ELIGIBLE_COLUMNS}
                issueDateRange={issueDateRange}
                onRemove={(index) => setColumnFilters((current) => (
                    current.filter((_, filterIndex) => filterIndex !== index)
                ))}
                onClearAll={() => setColumnFilters([])}
                onClearIssueDate={() => setIssueDateRange(EMPTY_CERTIFICATE_ISSUE_DATE_RANGE)}
            />

            <CertificateEligibleFilterModal
                open={filterModalOpen}
                columns={PROJECT_ELIGIBLE_COLUMNS}
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

            <div className="project-cert-layout">
                <div className="event-registrations-table-shell project-cert-table-shell">
                    <div className="table-container project-cert-table-scroll">
                        {loading ? (
                            <p className="project-cert-muted">Loading certificates…</p>
                        ) : filteredRows.length === 0 ? (
                            <p className="project-cert-muted">
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
                                        {/* <th className="event-registrations-phone-cell">Phone</th> */}
                                        <th>Type</th>
                                        <th className="event-cert-sessions-cell">Tasks</th>
                                        <th>Status</th>
                                        <th className="event-cert-issue-date-cell">Issue date</th>
                                        <th className="event-cert-sent-cell">Sent</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row, index) => {
                                        const checked = selection.has(row.key);
                                        const emailStatus = formatCertificateEmailStatus(row);
                                        const canResend = canManage && canResendCertificateEmail(row);
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
                                                {/* <td
                                                    className="event-registrations-phone-cell"
                                                    title={row.phoneNumber || undefined}
                                                >
                                                    {row.phoneNumber
                                                        ? truncateRegistrationCell(
                                                            row.phoneNumber,
                                                            REGISTRATION_PHONE_DISPLAY_LIMIT,
                                                        )
                                                        : '—'}
                                                </td> */}
                                                <EditableCertificateTypeCell
                                                    value={typeOverrides.get(row.key) ?? row.type}
                                                    disabled={!canManage || !row.selectable}
                                                    recipientName={row.fullName}
                                                    onChange={(next) => {
                                                        setTypeOverrides((prev) => {
                                                            const nextMap = new Map(prev);
                                                            if (next === row.type) {
                                                                nextMap.delete(row.key);
                                                            } else {
                                                                nextMap.set(row.key, next);
                                                            }
                                                            return nextMap;
                                                        });
                                                    }}
                                                />
                                                <td className="event-cert-sessions-cell">
                                                    {row.taskCount !== undefined ? row.taskCount : '—'}
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
                                                        canReissue={
                                                            Boolean(
                                                                canManage
                                                                    && row.certStatus === 'REVOKED'
                                                                    && row.certificateId,
                                                            )
                                                        }
                                                        onReissue={() => openReissueModal(row)}
                                                        recipientName={row.fullName}
                                                    />
                                                </td>
                                                <td className="event-cert-issue-date-cell">
                                                    {row.issueDate ? formatDate(row.issueDate) : '—'}
                                                </td>
                                                <td className="event-cert-sent-cell">
                                                    {emailStatus ? (
                                                        <div className="certificate-email-delivery-status">
                                                            <span
                                                                className={`status-badge${emailStatus.sent ? ' active' : ' away'}`}
                                                            >
                                                                {emailStatus.label}
                                                            </span>
                                                            {emailStatus.sent && emailStatus.sentAt ? (
                                                                <span className="certificate-email-delivery-status__date">
                                                                    {formatDate(emailStatus.sentAt)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="action-buttons project-cert-inline-actions">
                                                        {canResend ? (
                                                            <button
                                                                type="button"
                                                                className="table-action-btn view-btn"
                                                                title="Resend email"
                                                                disabled={
                                                                    resendingEmailId
                                                                    === Number(row.certificateId)
                                                                }
                                                                onClick={() => void handleResendEmail(row)}
                                                            >
                                                                {resendingEmailId
                                                                    === Number(row.certificateId)
                                                                    ? <Loader2 className="animate-spin" />
                                                                    : <Mail />}
                                                            </button>
                                                        ) : null}
                                                        {row.verificationCode && row.certStatus === 'ISSUED' ? (
                                                            <button
                                                                type="button"
                                                                className="table-action-btn view-btn"
                                                                title="Download PDF"
                                                                disabled={
                                                                    downloadingPdfCode
                                                                    === row.verificationCode
                                                                }
                                                                onClick={() => void handleDownloadPdf(row)}
                                                            >
                                                                {downloadingPdfCode
                                                                    === row.verificationCode
                                                                    ? <Loader2 className="animate-spin" />
                                                                    : <Download />}
                                                            </button>
                                                        ) : null}
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
                                                        {!row.verificationCode && !canResend && row.selectable ? (
                                                            <span className="project-cert-muted">—</span>
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
                        <div className="project-cert-io-bar">
                            <button
                                type="button"
                                className="btn btn-secondary project-cert-io-btn"
                                disabled={filteredSelectableKeys.length === 0}
                                onClick={selectAllFiltered}
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary project-cert-io-btn"
                                disabled={selection.size === 0}
                                onClick={clearSelection}
                            >
                                Clear
                            </button>
                            <div className="project-cert-io-issue">
                                <button
                                    type="button"
                                    className={
                                        needsTemplate
                                            ? 'btn btn-primary project-cert-io-btn project-cert-io-btn--needs-template'
                                            : 'btn btn-primary project-cert-io-btn'
                                    }
                                    disabled={selectedVisibleCount === 0 || issuing}
                                    aria-disabled={needsTemplate ? true : undefined}
                                    title={
                                        selectedVisibleCount === 0
                                            ? 'Select at least one recipient'
                                            : needsTemplate
                                              ? 'Select a template first'
                                              : undefined
                                    }
                                    aria-describedby={
                                        issueTemplateHint && selectedVisibleCount > 0
                                            ? 'project-cert-issue-template-hint'
                                            : undefined
                                    }
                                    onClick={() => void issueSelected()}
                                >
                                    {issuing
                                        ? 'Issuing…'
                                        : selectedVisibleCount > 0
                                          ? `Issue selected (${selectedVisibleCount})`
                                          : 'Issue selected'}
                                </button>
                                {issueTemplateHint && selectedVisibleCount > 0 ? (
                                    <span
                                        id="project-cert-issue-template-hint"
                                        className="project-cert-io-hint"
                                        role="status"
                                    >
                                        {issueTemplateHint}
                                    </span>
                                ) : null}
                            </div>
                            <select
                                className="form-input project-cert-io-template"
                                aria-label="Certificate template"
                                value={selectedTemplateId}
                                onChange={(e) => {
                                    const next = e.target.value.trim();
                                    setSelectedTemplateId(next);
                                    if (next) clearIssueTemplateHint();
                                }}
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
                                className="btn btn-secondary project-cert-io-btn"
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
                    showSuccessMessage('Custom certificate created');
                    await Promise.all([loadEligible(), loadIssued()]);
                }}
                projectId={projectId}
                defaultTitle={linkedTitle}
            />

            <RevokeCertificateModal
                target={revokeTarget}
                onClose={() => setRevokeTarget(null)}
                onRevoked={async () => {
                    setError(null);
                    await Promise.all([loadEligible(), loadIssued()]);
                }}
            />
            <ReissueCertificateModal
                target={reissueTarget}
                onClose={() => setReissueTarget(null)}
                onReissued={async () => {
                    setError(null);
                    await Promise.all([loadEligible(), loadIssued()]);
                }}
            />
        </div>
    );
}
