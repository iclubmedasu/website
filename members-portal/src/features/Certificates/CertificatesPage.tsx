'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Award, Eye, Filter, PauseCircle, Pencil, PlayCircle, Plus, Search, Trash2 } from 'lucide-react';
import { formatDate } from '@iclub/shared/utils';
import { useAuth } from '@/context/AuthContext';
import CertificateStatusBadge from '@/components/certificates/CertificateStatusBadge';
import { getPublicWebsiteOrigin } from '@/lib/publicWebsiteUrl';
import {
    certificatesAPI,
    type CertificateListItem,
    type CertificateStatus,
    type CertificateTemplate,
    type CertificateType,
} from '@/services/certificatesAPI';
import { isDateWithinRange } from '@/utils/filterDateRange';
import CertificatesFiltersModal, {
    type CertificatesFiltersState,
    type CertificatesNameSort,
    type TemplateActiveFilter,
} from './modals/CertificatesFiltersModal';
import DeactivateTemplateModal, {
    type TemplateModalTarget,
} from './modals/DeactivateTemplateModal';
import DeleteTemplateModal from './modals/DeleteTemplateModal';
import NewCustomCertificateModal from './modals/NewCustomCertificateModal';
import ReactivateTemplateModal from './modals/ReactivateTemplateModal';
import RevokeCertificateModal, {
    type RevokeCertificateTarget,
} from './modals/RevokeCertificateModal';
import TemplatePreviewModal from './modals/TemplatePreviewModal';
import TemplateEditorHost from './TemplateEditor/TemplateEditorHost';
import './CertificatesPage.css';

type PageToken = number | '...';
type CertificatesTab = 'all' | 'templates';
type EditorView =
    | { kind: 'list' }
    | { kind: 'template-create' }
    | { kind: 'template-edit'; templateId: number };

const ROWS_PER_PAGE = 20;

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function getPageNumbers(current: number, total: number): PageToken[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: PageToken[] = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

function formatCertificateType(type: CertificateType): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
}

function formatCertificateStatusLabel(status: CertificateStatus): string {
    return status.charAt(0) + status.slice(1).toLowerCase();
}

function getSourceLabel(cert: CertificateListItem): string {
    return cert.event?.title || cert.project?.title || 'Custom';
}

function buildVerifyUrl(verificationCode: string): string {
    return `${getPublicWebsiteOrigin()}/verify/${encodeURIComponent(verificationCode)}`;
}

function templateHasIssuedCertificates(template: CertificateTemplate): boolean {
    if (typeof template.hasIssuedCertificates === 'boolean') {
        return template.hasIssuedCertificates;
    }
    return (template.issuedCertificateCount ?? 0) > 0;
}

function parseTemplateQuery(value: string | null): EditorView {
    if (!value) return { kind: 'list' };
    if (value === 'new') return { kind: 'template-create' };
    const id = Number.parseInt(value, 10);
    if (Number.isInteger(id) && id > 0) {
        return { kind: 'template-edit', templateId: id };
    }
    return { kind: 'list' };
}

function compareNames(a: string, b: string, direction: CertificatesNameSort): number {
    if (!direction) return 0;
    const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
    return direction === 'asc' ? result : -result;
}

function hasCertificateFiltersActive(filters: CertificatesFiltersState): boolean {
    return (
        filters.status !== '' ||
        filters.type !== '' ||
        filters.dateFrom !== '' ||
        filters.dateTo !== '' ||
        filters.nameSort !== ''
    );
}

function hasTemplateFiltersActive(filters: CertificatesFiltersState): boolean {
    return (
        filters.activeFilter !== '' ||
        filters.dateFrom !== '' ||
        filters.dateTo !== '' ||
        filters.nameSort !== ''
    );
}

export default function CertificatesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const canManage = !!(
        user?.isDeveloper ||
        user?.isAdmin ||
        user?.isOfficer ||
        user?.isLeadership
    );

    const [activeTab, setActiveTab] = useState<CertificatesTab>('all');
    const [editorView, setEditorView] = useState<EditorView>(() =>
        parseTemplateQuery(searchParams.get('template')),
    );
    const [certificates, setCertificates] = useState<CertificateListItem[]>([]);
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [templateSearchQuery, setTemplateSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<CertificateStatus | ''>('');
    const [typeFilter, setTypeFilter] = useState<CertificateType | ''>('');
    const [certificateDateFrom, setCertificateDateFrom] = useState('');
    const [certificateDateTo, setCertificateDateTo] = useState('');
    const [certificateNameSort, setCertificateNameSort] = useState<CertificatesNameSort>('');
    const [templateActiveFilter, setTemplateActiveFilter] = useState<TemplateActiveFilter>('');
    const [templateDateFrom, setTemplateDateFrom] = useState('');
    const [templateDateTo, setTemplateDateTo] = useState('');
    const [templateNameSort, setTemplateNameSort] = useState<CertificatesNameSort>('');
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [showNewCustomModal, setShowNewCustomModal] = useState(false);
    const [actionBusyId, setActionBusyId] = useState<number | null>(null);
    const [deactivatingTemplate, setDeactivatingTemplate] = useState<TemplateModalTarget | null>(
        null,
    );
    const [reactivatingTemplate, setReactivatingTemplate] = useState<TemplateModalTarget | null>(
        null,
    );
    const [deletingTemplate, setDeletingTemplate] = useState<
        (TemplateModalTarget & { hasIssuedCertificates: boolean }) | null
    >(null);
    const [previewingTemplateId, setPreviewingTemplateId] = useState<number | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<RevokeCertificateTarget | null>(null);

    const isEditorOpen = editorView.kind !== 'list';

    const syncTemplateQuery = useCallback(
        (view: EditorView) => {
            const params = new URLSearchParams(searchParams.toString());
            if (view.kind === 'list') {
                params.delete('template');
            } else if (view.kind === 'template-create') {
                params.set('template', 'new');
            } else {
                params.set('template', String(view.templateId));
            }
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    const openTemplateCreate = useCallback(() => {
        const view: EditorView = { kind: 'template-create' };
        setActiveTab('templates');
        setEditorView(view);
        syncTemplateQuery(view);
    }, [syncTemplateQuery]);

    const openTemplateEdit = useCallback(
        (templateId: number) => {
            const view: EditorView = { kind: 'template-edit', templateId };
            setActiveTab('templates');
            setEditorView(view);
            syncTemplateQuery(view);
        },
        [syncTemplateQuery],
    );

    const loadCertificates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await certificatesAPI.getAll();
            setCertificates(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load certificates'));
            setCertificates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const data = await certificatesAPI.getTemplates();
            setTemplates(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load templates'));
            setTemplates([]);
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    const handleCloseTemplateEditor = useCallback(() => {
        const view: EditorView = { kind: 'list' };
        setActiveTab('templates');
        setEditorView(view);
        syncTemplateQuery(view);
        void loadTemplates();
    }, [loadTemplates, syncTemplateQuery]);

    useEffect(() => {
        const fromQuery = parseTemplateQuery(searchParams.get('template'));
        setEditorView(fromQuery);
        if (fromQuery.kind !== 'list') {
            setActiveTab('templates');
        }
    }, [searchParams]);

    useEffect(() => {
        void loadCertificates();
    }, [loadCertificates]);

    useEffect(() => {
        if (activeTab === 'templates' && canManage && !isEditorOpen) {
            void loadTemplates();
        }
    }, [activeTab, canManage, isEditorOpen, loadTemplates]);

    useEffect(() => {
        if (!canManage && activeTab === 'templates') {
            setActiveTab('all');
        }
        if (!canManage && isEditorOpen) {
            handleCloseTemplateEditor();
        }
    }, [canManage, activeTab, isEditorOpen, handleCloseTemplateEditor]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        searchQuery,
        statusFilter,
        typeFilter,
        certificateDateFrom,
        certificateDateTo,
        certificateNameSort,
    ]);

    useEffect(() => {
        setShowFiltersModal(false);
    }, [activeTab]);

    const hasCertificateFilters = hasCertificateFiltersActive({
        status: statusFilter,
        type: typeFilter,
        activeFilter: '',
        dateFrom: certificateDateFrom,
        dateTo: certificateDateTo,
        nameSort: certificateNameSort,
    });

    const hasTemplateFilters = hasTemplateFiltersActive({
        status: '',
        type: '',
        activeFilter: templateActiveFilter,
        dateFrom: templateDateFrom,
        dateTo: templateDateTo,
        nameSort: templateNameSort,
    });

    const handleApplyCertificateFilters = (filters: CertificatesFiltersState) => {
        setStatusFilter(filters.status);
        setTypeFilter(filters.type);
        setCertificateDateFrom(filters.dateFrom);
        setCertificateDateTo(filters.dateTo);
        setCertificateNameSort(filters.nameSort);
        setShowFiltersModal(false);
    };

    const handleClearCertificateFilters = () => {
        setStatusFilter('');
        setTypeFilter('');
        setCertificateDateFrom('');
        setCertificateDateTo('');
        setCertificateNameSort('');
    };

    const handleApplyTemplateFilters = (filters: CertificatesFiltersState) => {
        setTemplateActiveFilter(filters.activeFilter);
        setTemplateDateFrom(filters.dateFrom);
        setTemplateDateTo(filters.dateTo);
        setTemplateNameSort(filters.nameSort);
        setShowFiltersModal(false);
    };

    const handleClearTemplateFilters = () => {
        setTemplateActiveFilter('');
        setTemplateDateFrom('');
        setTemplateDateTo('');
        setTemplateNameSort('');
    };

    const filteredCertificates = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let rows = certificates.filter((cert) => {
            if (statusFilter && cert.status !== statusFilter) return false;
            if (typeFilter && cert.type !== typeFilter) return false;
            if (
                !isDateWithinRange(
                    cert.issuedAt || cert.createdAt,
                    certificateDateFrom,
                    certificateDateTo,
                )
            ) {
                return false;
            }
            if (!query) return true;
            const recipient = (cert.recipientName || cert.recipientMember?.fullName || '').toLowerCase();
            return recipient.includes(query);
        });

        if (certificateNameSort) {
            rows = [...rows].sort((a, b) =>
                compareNames(
                    a.recipientName || a.recipientMember?.fullName || '',
                    b.recipientName || b.recipientMember?.fullName || '',
                    certificateNameSort,
                ),
            );
        }

        return rows;
    }, [
        certificates,
        searchQuery,
        statusFilter,
        typeFilter,
        certificateDateFrom,
        certificateDateTo,
        certificateNameSort,
    ]);

    const filteredTemplates = useMemo(() => {
        const query = templateSearchQuery.trim().toLowerCase();
        let rows = templates.filter((template) => {
            if (templateActiveFilter === 'active' && !template.isActive) return false;
            if (templateActiveFilter === 'inactive' && template.isActive) return false;
            if (!isDateWithinRange(template.createdAt, templateDateFrom, templateDateTo)) {
                return false;
            }
            if (!query) return true;
            return template.name.toLowerCase().includes(query);
        });

        if (templateNameSort) {
            rows = [...rows].sort((a, b) => compareNames(a.name, b.name, templateNameSort));
        }

        return rows;
    }, [
        templates,
        templateSearchQuery,
        templateActiveFilter,
        templateDateFrom,
        templateDateTo,
        templateNameSort,
    ]);

    const totalPages = Math.max(1, Math.ceil(filteredCertificates.length / ROWS_PER_PAGE));
    const paginatedCertificates = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredCertificates.slice(start, start + ROWS_PER_PAGE);
    }, [filteredCertificates, currentPage]);

    const handleIssue = async (id: number) => {
        setActionBusyId(id);
        setError(null);
        try {
            await certificatesAPI.issue(id);
            await loadCertificates();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to issue certificate'));
        } finally {
            setActionBusyId(null);
        }
    };

    const openRevokeModal = (cert: CertificateListItem) => {
        setRevokeTarget({
            id: cert.id,
            recipientName: cert.recipientName || cert.recipientMember?.fullName || '—',
        });
    };

    const onTemplateLifecycleDone = useCallback(() => {
        setError(null);
        void loadTemplates();
    }, [loadTemplates]);

    return (
        <div className="certificates-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Certificates</h1>
            </div>

            <hr className="title-divider" />

            {error && <div className="error-message">{error}</div>}

            <div
                className={`card members-table-card certificates-main-card${isEditorOpen ? ' certificates-main-card--editor' : ''}`}
            >
                {isEditorOpen && canManage ? (
                    <>
                        <div className="certificates-editor-header">
                            <h2 className="certificates-editor-title">
                                {editorView.kind === 'template-edit'
                                    ? 'Edit Template'
                                    : 'New Template'}
                            </h2>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleCloseTemplateEditor}
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        </div>
                        <div className="certificates-editor-body">
                            <TemplateEditorHost
                                mode={editorView.kind === 'template-edit' ? 'edit' : 'create'}
                                templateId={
                                    editorView.kind === 'template-edit'
                                        ? editorView.templateId
                                        : null
                                }
                                nested
                                onSaved={handleCloseTemplateEditor}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="certificates-tabs" role="tablist" aria-label="Certificates sections">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === 'all'}
                                className={`certificates-tab-btn${activeTab === 'all' ? ' active' : ''}`}
                                onClick={() => setActiveTab('all')}
                            >
                                Certificates
                            </button>
                            {canManage && (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'templates'}
                                    className={`certificates-tab-btn${activeTab === 'templates' ? ' active' : ''}`}
                                    onClick={() => setActiveTab('templates')}
                                >
                                    Templates
                                </button>
                            )}
                        </div>

                        <div className="certificates-tab-panel">
                            {activeTab === 'all' && (
                                <>
                                    <div className="page-search-row certificates-filter-bar">
                                        <div className="page-search-field page-search-field--full">
                                            <Search className="page-search-icon" size={16} />
                                            <input
                                                type="search"
                                                className="page-search-input"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search recipient"
                                                aria-label="Search recipient"
                                            />
                                            <button
                                                type="button"
                                                className={`page-search-filter-btn${hasCertificateFilters ? ' page-search-filter-btn--active' : ''}`}
                                                onClick={() => setShowFiltersModal(true)}
                                                aria-label="Open advanced filters"
                                            >
                                                <Filter size={16} />
                                                <span className="page-search-filter-label">
                                                    Advanced Filters
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {loading && (
                                        <div className="loading-message">Loading certificates…</div>
                                    )}

                                    {!loading && (
                                        <div className="certificates-table-shell">
                                            <div className="certificates-table-scroll">
                                                {filteredCertificates.length === 0 ? (
                                                    <div className="empty-state">
                                                        <Award className="empty-state-icon" />
                                                        <h4 className="empty-state-title">
                                                            No certificates found
                                                        </h4>
                                                        <p className="empty-state-text">
                                                            {searchQuery || hasCertificateFilters
                                                                ? 'Try a different search or adjust the filters.'
                                                                : 'No certificates have been created yet.'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="table-container">
                                                        <table className="members-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Recipient</th>
                                                                    <th>Type</th>
                                                                    <th>Title</th>
                                                                    <th>Status</th>
                                                                    <th>Issue Date</th>
                                                                    <th>Source</th>
                                                                    <th>Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {paginatedCertificates.map(
                                                                    (cert, index) => (
                                                                        <tr
                                                                            key={cert.id}
                                                                            className={
                                                                                index % 2 === 0
                                                                                    ? 'even-row'
                                                                                    : 'odd-row'
                                                                            }
                                                                        >
                                                                            <td>
                                                                                {cert.recipientName ||
                                                                                    cert.recipientMember
                                                                                        ?.fullName ||
                                                                                    '—'}
                                                                            </td>
                                                                            <td>
                                                                                <span className="badge">
                                                                                    {formatCertificateType(
                                                                                        cert.type,
                                                                                    )}
                                                                                </span>
                                                                            </td>
                                                                            <td>{cert.title}</td>
                                                                            <td>
                                                                                <CertificateStatusBadge
                                                                                    status={cert.status}
                                                                                    label={formatCertificateStatusLabel(
                                                                                        cert.status,
                                                                                    )}
                                                                                    canRevoke={
                                                                                        canManage
                                                                                        && cert.status
                                                                                            === 'ISSUED'
                                                                                    }
                                                                                    onRevoke={() =>
                                                                                        openRevokeModal(cert)
                                                                                    }
                                                                                    recipientName={
                                                                                        cert.recipientName
                                                                                        || cert.recipientMember
                                                                                            ?.fullName
                                                                                        || undefined
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td>
                                                                                {cert.issuedAt
                                                                                    ? formatDate(
                                                                                          cert.issuedAt,
                                                                                      )
                                                                                    : '—'}
                                                                            </td>
                                                                            <td>
                                                                                {getSourceLabel(cert)}
                                                                            </td>
                                                                            <td>
                                                                                <div className="action-buttons certificates-action-buttons">
                                                                                    {canManage &&
                                                                                        cert.status ===
                                                                                            'DRAFT' && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="btn btn-secondary certificates-action-btn"
                                                                                                onClick={() =>
                                                                                                    void handleIssue(
                                                                                                        cert.id,
                                                                                                    )
                                                                                                }
                                                                                                disabled={
                                                                                                    actionBusyId ===
                                                                                                    cert.id
                                                                                                }
                                                                                            >
                                                                                                Issue
                                                                                            </button>
                                                                                        )}
                                                                                    {cert.verificationCode && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="table-action-btn view-btn"
                                                                                            title="View certificate"
                                                                                            onClick={() =>
                                                                                                window.open(
                                                                                                    buildVerifyUrl(
                                                                                                        cert.verificationCode,
                                                                                                    ),
                                                                                                    '_blank',
                                                                                                    'noopener,noreferrer',
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <Eye />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ),
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>

                                            {totalPages > 1 && filteredCertificates.length > 0 && (
                                                <div className="pagination-controls certificates-table-pagination">
                                                    <button
                                                        className="pagination-btn"
                                                        disabled={currentPage <= 1}
                                                        onClick={() =>
                                                            setCurrentPage((page) =>
                                                                Math.max(1, page - 1),
                                                            )
                                                        }
                                                    >
                                                        Previous
                                                    </button>
                                                    <div className="pagination-pages">
                                                        {getPageNumbers(currentPage, totalPages).map(
                                                            (pageNumber, index) =>
                                                                pageNumber === '...' ? (
                                                                    <span
                                                                        key={`ellipsis-${index}`}
                                                                        className="pagination-ellipsis"
                                                                    >
                                                                        …
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        key={pageNumber}
                                                                        className={`pagination-page-btn${pageNumber === currentPage ? ' pagination-page-btn--active' : ''}`}
                                                                        onClick={() =>
                                                                            setCurrentPage(pageNumber)
                                                                        }
                                                                    >
                                                                        {pageNumber}
                                                                    </button>
                                                                ),
                                                        )}
                                                    </div>
                                                    <button
                                                        className="pagination-btn"
                                                        disabled={currentPage >= totalPages}
                                                        onClick={() =>
                                                            setCurrentPage((page) =>
                                                                Math.min(totalPages, page + 1),
                                                            )
                                                        }
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            )}

                                            {canManage && (
                                                <div className="certificates-table-footer">
                                                    <button
                                                        type="button"
                                                        className="certificates-add-btn"
                                                        onClick={() => setShowNewCustomModal(true)}
                                                    >
                                                        <Plus size={16} />
                                                        Add Certificate
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'templates' && canManage && (
                                <>
                                    <div className="page-search-row certificates-filter-bar">
                                        <div className="page-search-field page-search-field--full">
                                            <Search className="page-search-icon" size={16} />
                                            <input
                                                type="search"
                                                className="page-search-input"
                                                value={templateSearchQuery}
                                                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                                placeholder="Search templates"
                                                aria-label="Search templates"
                                            />
                                            <button
                                                type="button"
                                                className={`page-search-filter-btn${hasTemplateFilters ? ' page-search-filter-btn--active' : ''}`}
                                                onClick={() => setShowFiltersModal(true)}
                                                aria-label="Open advanced filters"
                                            >
                                                <Filter size={16} />
                                                <span className="page-search-filter-label">
                                                    Advanced Filters
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {templatesLoading && (
                                        <div className="loading-message">Loading templates…</div>
                                    )}
                                    {!templatesLoading && (
                                        <div className="certificates-table-shell">
                                            <div className="certificates-table-scroll">
                                                {filteredTemplates.length === 0 ? (
                                                    <div className="empty-state">
                                                        <Award className="empty-state-icon" />
                                                        <h4 className="empty-state-title">
                                                            No templates yet
                                                        </h4>
                                                        <p className="empty-state-text">
                                                            {templateSearchQuery || hasTemplateFilters
                                                                ? 'Try a different search or adjust the filters.'
                                                                : 'Create a template to start issuing certificates.'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="table-container">
                                                        <table className="members-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Name</th>
                                                                    <th>Canvas</th>
                                                                    <th>Status</th>
                                                                    <th>Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredTemplates.map((template, index) => {
                                                                    const hasIssued =
                                                                        templateHasIssuedCertificates(
                                                                            template,
                                                                        );
                                                                    return (
                                                                        <tr
                                                                            key={template.id}
                                                                            className={
                                                                                index % 2 === 0
                                                                                    ? 'even-row'
                                                                                    : 'odd-row'
                                                                            }
                                                                        >
                                                                            <td>{template.name}</td>
                                                                            <td>
                                                                                {template.canvasWidth}×
                                                                                {template.canvasHeight}
                                                                            </td>
                                                                            <td>
                                                                                <span
                                                                                    className={`status-badge ${template.isActive ? 'active' : 'inactive'}`}
                                                                                >
                                                                                    {template.isActive
                                                                                        ? 'Active'
                                                                                        : 'Inactive'}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <div className="action-buttons certificates-action-buttons">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="table-action-btn view-btn"
                                                                                        title="Preview template"
                                                                                        onClick={() =>
                                                                                            setPreviewingTemplateId(
                                                                                                template.id,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Eye />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="table-action-btn edit-btn"
                                                                                        title="Edit template"
                                                                                        onClick={() =>
                                                                                            openTemplateEdit(
                                                                                                template.id,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Pencil />
                                                                                    </button>
                                                                                    {template.isActive ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="table-action-btn hold-btn"
                                                                                            title="Deactivate template"
                                                                                            onClick={() =>
                                                                                                setDeactivatingTemplate(
                                                                                                    {
                                                                                                        id: template.id,
                                                                                                        name: template.name,
                                                                                                    },
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <PauseCircle />
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="table-action-btn reactivate-btn"
                                                                                            title="Reactivate template"
                                                                                            onClick={() =>
                                                                                                setReactivatingTemplate(
                                                                                                    {
                                                                                                        id: template.id,
                                                                                                        name: template.name,
                                                                                                    },
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <PlayCircle />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        type="button"
                                                                                        className="table-action-btn deactivate-btn"
                                                                                        title={
                                                                                            hasIssued
                                                                                                ? 'Cannot delete while issued certificates use this template'
                                                                                                : 'Delete template permanently'
                                                                                        }
                                                                                        disabled={hasIssued}
                                                                                        onClick={() =>
                                                                                            setDeletingTemplate(
                                                                                                {
                                                                                                    id: template.id,
                                                                                                    name: template.name,
                                                                                                    hasIssuedCertificates:
                                                                                                        hasIssued,
                                                                                                },
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Trash2 />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="certificates-table-footer">
                                                <button
                                                    type="button"
                                                    className="certificates-add-btn"
                                                    onClick={openTemplateCreate}
                                                >
                                                    <Plus size={16} />
                                                    Add Template
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {showFiltersModal && activeTab === 'all' && (
                <CertificatesFiltersModal
                    variant="certificates"
                    status={statusFilter}
                    type={typeFilter}
                    activeFilter=""
                    dateFrom={certificateDateFrom}
                    dateTo={certificateDateTo}
                    nameSort={certificateNameSort}
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyCertificateFilters}
                    onClear={handleClearCertificateFilters}
                />
            )}

            {showFiltersModal && activeTab === 'templates' && (
                <CertificatesFiltersModal
                    variant="templates"
                    status=""
                    type=""
                    activeFilter={templateActiveFilter}
                    dateFrom={templateDateFrom}
                    dateTo={templateDateTo}
                    nameSort={templateNameSort}
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyTemplateFilters}
                    onClear={handleClearTemplateFilters}
                />
            )}

            <NewCustomCertificateModal
                isOpen={showNewCustomModal}
                onClose={() => setShowNewCustomModal(false)}
                onSuccess={loadCertificates}
            />

            <DeactivateTemplateModal
                template={deactivatingTemplate}
                onClose={() => setDeactivatingTemplate(null)}
                onDeactivated={onTemplateLifecycleDone}
            />
            <ReactivateTemplateModal
                template={reactivatingTemplate}
                onClose={() => setReactivatingTemplate(null)}
                onReactivated={onTemplateLifecycleDone}
            />
            <DeleteTemplateModal
                template={deletingTemplate}
                hasIssuedCertificates={deletingTemplate?.hasIssuedCertificates}
                onClose={() => setDeletingTemplate(null)}
                onDeleted={onTemplateLifecycleDone}
            />
            <RevokeCertificateModal
                target={revokeTarget}
                onClose={() => setRevokeTarget(null)}
                onRevoked={async () => {
                    setError(null);
                    await loadCertificates();
                }}
            />
            <TemplatePreviewModal
                templateId={previewingTemplateId}
                onClose={() => setPreviewingTemplateId(null)}
            />
        </div>
    );
}
