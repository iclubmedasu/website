'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
    EditorIncidentReportForm,
    EditorSupportNoticeBlock,
    EditorSupportPage,
    IncidentReportDetail,
    SitePageHeader,
} from '@iclub/shared';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supportContentAPI } from '@/services/api';
import { PageHeaderEditor } from './components/PageHeaderEditor';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { SupportFormSubmissionsTable } from './components/SupportFormSubmissionsTable';
import { IncidentReportDetailModal } from './modals/IncidentReportDetailModal';
import { AddFormModal, EditFormModal, EditSupportNoticeModal } from './modals/SupportContentModals';
import './SiteContent.css';
import '@/components/modal/modal.css';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

type DeleteTarget =
    | { kind: 'notice'; id: number; label: string }
    | { kind: 'form'; id: number; label: string };

function renderFormRow(
    form: EditorIncidentReportForm,
    index: number,
    forms: EditorIncidentReportForm[],
    options: {
        busy: boolean;
        canEdit: boolean;
        submissionCount: number;
        onMove: (index: number, direction: -1 | 1) => void;
        onEdit: (form: EditorIncidentReportForm) => void;
        onDelete: (form: EditorIncidentReportForm) => void;
    },
) {
    const fieldCount = form.fields.filter((field) => field.isActive).length;
    return (
        <div key={form.id} className="site-content-section-row">
            <div>
                <p className="site-content-section-type">
                    {form.isSystem ? 'Protected' : 'Custom'}
                </p>
                <h4 className="site-content-section-title">{form.label}</h4>
                <p className="site-content-section-meta">
                    {fieldCount} field{fieldCount === 1 ? '' : 's'}
                    {' · '}
                    {options.submissionCount} submission{options.submissionCount === 1 ? '' : 's'}
                    {!form.isActive ? ' · Hidden' : ''}
                </p>
            </div>
            {options.canEdit ? (
                <div className="site-content-row-actions">
                    <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        onClick={() => options.onMove(index, -1)}
                        disabled={options.busy || index === 0}
                        aria-label="Move up"
                    >
                        <ArrowUp size={16} />
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        onClick={() => options.onMove(index, 1)}
                        disabled={options.busy || index === forms.length - 1}
                        aria-label="Move down"
                    >
                        <ArrowDown size={16} />
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        onClick={() => options.onEdit(form)}
                        disabled={options.busy}
                        aria-label="Edit form"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        onClick={() => options.onDelete(form)}
                        disabled={options.busy || form.isSystem}
                        aria-label="Delete form"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ) : null}
        </div>
    );
}

async function loadFormReportsMap(forms: EditorIncidentReportForm[]): Promise<Record<number, IncidentReportDetail[]>> {
    const entries = await Promise.all(
        forms.map(async (form) => {
            const result = await supportContentAPI.getFormReports(form.id);
            return [form.id, result.reports] as const;
        }),
    );
    return Object.fromEntries(entries);
}

export default function SupportEditorPage() {
    const { user } = useAuth();
    const router = useRouter();
    const canEditPageContent = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
    const canEditForms = canEditPageContent || !!user?.isSupportFormsEditor;

    const [page, setPage] = useState<EditorSupportPage | null>(null);
    const [formReports, setFormReports] = useState<Record<number, IncidentReportDetail[]>>({});
    const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [editingNotice, setEditingNotice] = useState<EditorSupportNoticeBlock | null>(null);
    const [editingForm, setEditingForm] = useState<EditorIncidentReportForm | null>(null);
    const [showNoticeModal, setShowNoticeModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [selectedReport, setSelectedReport] = useState<IncidentReportDetail | null>(null);

    const loadSubmissions = useCallback(async (forms: EditorIncidentReportForm[]) => {
        const [reportsMap, countsData] = await Promise.all([
            loadFormReportsMap(forms),
            supportContentAPI.getSubmissionCounts(),
        ]);
        setFormReports(reportsMap);
        setSubmissionCounts(countsData.counts ?? {});
    }, []);

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = (await supportContentAPI.getSupport()) as EditorSupportPage;
            setPage(data);
            if (canEditForms) {
                await loadSubmissions(data.forms);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load support page'));
        } finally {
            setLoading(false);
        }
    }, [canEditForms, loadSubmissions]);

    useEffect(() => {
        if (!user) return;
        if (!canEditPageContent && !canEditForms) {
            router.replace('/help');
        }
    }, [user, canEditPageContent, canEditForms, router]);

    useEffect(() => {
        void loadPage();
    }, [loadPage]);

    const totalSubmissions = useMemo(
        () => Object.values(submissionCounts).reduce((sum, count) => sum + count, 0),
        [submissionCounts],
    );

    const saveHeader = async (header: SitePageHeader) => {
        setBusy(true);
        try {
            await supportContentAPI.updateSupportHeader(header);
            setPage((current) => (current ? { ...current, header } : current));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save header'));
        } finally {
            setBusy(false);
        }
    };

    const moveItem = async <T extends { id: number }>(
        items: T[],
        index: number,
        direction: -1 | 1,
        reorderFn: (orderedIds: number[]) => Promise<unknown>,
    ) => {
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const orderedIds = items.map((item) => item.id);
        [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
        setBusy(true);
        try {
            const updated = (await reorderFn(orderedIds)) as EditorSupportPage;
            setPage(updated);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to reorder items'));
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setBusy(true);
        try {
            const updated =
                deleteTarget.kind === 'notice'
                    ? ((await supportContentAPI.deleteNotice(deleteTarget.id)) as EditorSupportPage)
                    : ((await supportContentAPI.deleteForm(deleteTarget.id)) as EditorSupportPage);
            setPage(updated);
            if (deleteTarget.kind === 'form') {
                setFormReports((current) => {
                    const next = { ...current };
                    delete next[deleteTarget.id];
                    return next;
                });
            }
            setDeleteTarget(null);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete item'));
        } finally {
            setBusy(false);
        }
    };

    const exportForm = async (form: EditorIncidentReportForm) => {
        setBusy(true);
        try {
            await supportContentAPI.exportFormSubmissions(form.id);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to export submissions'));
        } finally {
            setBusy(false);
        }
    };

    const systemForms = page?.forms.filter((form) => form.isSystem) ?? [];
    const customForms = page?.forms.filter((form) => !form.isSystem) ?? [];

    if (!canEditPageContent && !canEditForms) {
        return <div className="members-page site-content-page"><p>Redirecting…</p></div>;
    }

    if (loading) {
        return <div className="members-page site-content-page"><p>Loading support page…</p></div>;
    }

    return (
        <div className="members-page site-content-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Support Page</h1>
                <p className="site-content-subtitle">
                    Manage the public support page, incident report forms, and review submissions.
                </p>
            </div>

            <hr className="title-divider" />

            {!canEditPageContent && canEditForms ? (
                <div className="card site-content-readonly">
                    <p>You can manage incident report forms and submissions. Page header and guidance blocks are managed by officers and administration.</p>
                </div>
            ) : null}

            {error ? <p className="site-content-error">{error}</p> : null}

            {page ? (
                <>
                    {canEditPageContent ? (
                        <PageHeaderEditor
                            header={page.header}
                            canEdit={canEditPageContent}
                            busy={busy}
                            onSave={saveHeader}
                            description="Purple hero section at the top of the public support page."
                        />
                    ) : null}

                    {canEditPageContent ? (
                    <div className="card site-content-sections-card">
                        <div className="card-header card-header-with-action">
                            <div className="card-header-left">
                                <h3 className="card-title">Guidance blocks</h3>
                                <p className="card-subtitle">Bilingual instructions shown above the incident report form.</p>
                            </div>
                            {canEditPageContent ? (
                                <button
                                    type="button"
                                    className="btn btn-secondary site-content-card-action"
                                    onClick={() => setShowNoticeModal(true)}
                                    disabled={busy}
                                >
                                    Add block
                                </button>
                            ) : null}
                        </div>
                        <div className="card-body site-content-section-list">
                            {page.notices.map((notice, index) => (
                                <div key={notice.id} className="site-content-section-row">
                                    <div>
                                        <p className="site-content-section-type">{notice.locale}</p>
                                        <p className="site-content-section-meta site-content-notice-preview">
                                            {notice.content.split('\n')[0]}
                                        </p>
                                    </div>
                                    {canEditPageContent ? (
                                        <div className="site-content-row-actions">
                                            <button type="button" className="btn btn-secondary btn-icon" onClick={() => moveItem(page.notices, index, -1, supportContentAPI.reorderNotices)} disabled={busy || index === 0} aria-label="Move up">
                                                <ArrowUp size={16} />
                                            </button>
                                            <button type="button" className="btn btn-secondary btn-icon" onClick={() => moveItem(page.notices, index, 1, supportContentAPI.reorderNotices)} disabled={busy || index === page.notices.length - 1} aria-label="Move down">
                                                <ArrowDown size={16} />
                                            </button>
                                            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setEditingNotice(notice)} disabled={busy} aria-label="Edit block">
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-icon"
                                                onClick={() => setDeleteTarget({ kind: 'notice', id: notice.id, label: notice.locale })}
                                                disabled={busy}
                                                aria-label="Delete block"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                    ) : null}

                    {canEditForms ? (
                    <div className="card site-content-sections-card">
                        <div className="card-header card-header-with-action">
                            <div className="card-header-left">
                                <h3 className="card-title">Forms</h3>
                                <p className="card-subtitle">
                                    General, Personal, and Request are protected. Add custom forms and manage their fields.
                                </p>
                            </div>
                            {canEditForms ? (
                                <button
                                    type="button"
                                    className="btn btn-secondary site-content-card-action"
                                    onClick={() => setShowFormModal(true)}
                                    disabled={busy}
                                >
                                    Add form
                                </button>
                            ) : null}
                        </div>
                        <div className="card-body site-content-section-list">
                            {systemForms.map((form) => {
                                const index = page.forms.findIndex((entry) => entry.id === form.id);
                                return renderFormRow(form, index, page.forms, {
                                    busy,
                                    canEdit: canEditForms,
                                    submissionCount: submissionCounts[String(form.id)] ?? 0,
                                    onMove: (rowIndex, direction) => void moveItem(page.forms, rowIndex, direction, supportContentAPI.reorderForms),
                                    onEdit: setEditingForm,
                                    onDelete: (target) => setDeleteTarget({ kind: 'form', id: target.id, label: target.label }),
                                });
                            })}
                            {customForms.length ? (
                                <div className="site-content-forms-divider">
                                    <span>Custom forms</span>
                                </div>
                            ) : null}
                            {customForms.map((form) => {
                                const index = page.forms.findIndex((entry) => entry.id === form.id);
                                return renderFormRow(form, index, page.forms, {
                                    busy,
                                    canEdit: canEditForms,
                                    submissionCount: submissionCounts[String(form.id)] ?? 0,
                                    onMove: (rowIndex, direction) => void moveItem(page.forms, rowIndex, direction, supportContentAPI.reorderForms),
                                    onEdit: setEditingForm,
                                    onDelete: (target) => setDeleteTarget({ kind: 'form', id: target.id, label: target.label }),
                                });
                            })}
                        </div>
                    </div>
                    ) : null}

                    {canEditForms ? (
                        <div className="card site-content-sections-card">
                            <div className="card-header">
                                <div className="card-header-left">
                                    <h3 className="card-title">Submissions</h3>
                                    <p className="card-subtitle">
                                        Incident reports submitted from the portal or public website.
                                        {totalSubmissions > 0 ? ` ${totalSubmissions} total.` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="card-body">
                                {page.forms.map((form) => {
                                    const reports = formReports[form.id] ?? [];
                                    if (reports.length === 0) return null;
                                    return (
                                        <SupportFormSubmissionsTable
                                            key={form.id}
                                            form={form}
                                            reports={reports}
                                            busy={busy}
                                            onViewReport={setSelectedReport}
                                            onExport={() => void exportForm(form)}
                                        />
                                    );
                                })}
                                {totalSubmissions === 0 ? (
                                    <p className="site-content-empty">No incident reports yet.</p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}

            {showNoticeModal ? (
                <EditSupportNoticeModal
                    onClose={() => setShowNoticeModal(false)}
                    onSaved={(updated) => {
                        setPage(updated);
                        setShowNoticeModal(false);
                    }}
                />
            ) : null}

            {editingNotice ? (
                <EditSupportNoticeModal
                    notice={editingNotice}
                    onClose={() => setEditingNotice(null)}
                    onSaved={(updated) => {
                        setPage(updated);
                        setEditingNotice(null);
                    }}
                />
            ) : null}

            {showFormModal ? (
                <AddFormModal
                    onClose={() => setShowFormModal(false)}
                    onCreated={(updated, newFormId) => {
                        setPage(updated);
                        setShowFormModal(false);
                        const newForm = updated.forms.find((form) => form.id === newFormId);
                        if (newForm) setEditingForm(newForm);
                    }}
                />
            ) : null}

            {editingForm ? (
                <EditFormModal
                    form={editingForm}
                    onClose={() => setEditingForm(null)}
                    onSaved={(updated) => {
                        setPage(updated);
                        const refreshed = updated.forms.find((form) => form.id === editingForm.id);
                        if (refreshed) setEditingForm(refreshed);
                    }}
                />
            ) : null}

            {deleteTarget ? (
                <ConfirmDeleteModal
                    title={deleteTarget.kind === 'notice' ? 'Delete guidance block' : 'Delete form'}
                    message={
                        deleteTarget.kind === 'notice'
                            ? 'This guidance block will be permanently removed.'
                            : 'This form and all of its fields will be permanently removed.'
                    }
                    itemLabel={deleteTarget.label}
                    busy={busy}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                />
            ) : null}

            {selectedReport ? (
                <IncidentReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
            ) : null}
        </div>
    );
}
