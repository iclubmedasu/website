'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAutoDismissMessage } from '@/hooks/useAutoDismissMessage';
import { useDocumentPermissions } from '@/hooks/useDocumentPermissions';
import {
    documentsAPI,
    isLockedCategory,
    type CategoryListItem,
    type DocumentAccessTarget,
    type DocumentCategory,
    type DocumentFull,
    type DocumentListItem,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import AccessRequestsPanel from './components/AccessRequestsPanel';
import DocumentBreadcrumb from './components/DocumentBreadcrumb';
import DocumentsExplorerGrid from './components/DocumentsExplorerGrid';
import CreateCategoryModal from './modals/CreateCategoryModal';
import DeleteCategoryModal from './modals/DeleteCategoryModal';
import DeleteDocumentModal from './modals/DeleteDocumentModal';
import DocumentAccessLogModal from './modals/DocumentAccessLogModal';
import DocumentDetailModal from './modals/DocumentDetailModal';
import GrantAccessModal from './modals/GrantAccessModal';
import ManageAccessModal from './modals/ManageAccessModal';
import MoveDocumentModal from './modals/MoveDocumentModal';
import RenameDocumentModal from './modals/RenameDocumentModal';
import RequestAccessModal from './modals/RequestAccessModal';
import UploadDocumentModal from './modals/UploadDocumentModal';
import './DocumentsPage.css';

interface AccessTarget {
    type: DocumentAccessTarget;
    id: Id;
    title: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function DocumentsSkeletonGrid() {
    return (
        <div
            className="documents-explorer-grid"
            aria-busy="true"
            aria-label="Loading documents"
        >
            {Array.from({ length: 8 }, (_, index) => (
                <div
                    key={index}
                    className={`documents-skeleton-tile ${
                        index < 4
                            ? 'documents-skeleton-tile--folder'
                            : 'documents-skeleton-tile--doc'
                    }`}
                />
            ))}
        </div>
    );
}

export default function DocumentsPage() {
    const { ledTeamIds, canUpload } = useDocumentPermissions();
    const { message: stubMessage, show: showStubMessage } = useAutoDismissMessage();

    const [categories, setCategories] = useState<CategoryListItem[]>([]);
    const [documents, setDocuments] = useState<DocumentListItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [requestTarget, setRequestTarget] = useState<AccessTarget | null>(null);
    const [detailDocumentId, setDetailDocumentId] = useState<Id | null>(null);
    const [detailListVersion, setDetailListVersion] = useState(0);
    const [grantTarget, setGrantTarget] = useState<AccessTarget | null>(null);
    const [manageAccessTarget, setManageAccessTarget] = useState<AccessTarget | null>(null);
    const [accessLogTarget, setAccessLogTarget] = useState<AccessTarget | null>(null);
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [categoryModal, setCategoryModal] = useState<{
        mode: 'create' | 'edit';
        category?: DocumentCategory | null;
    } | null>(null);
    const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<DocumentCategory | null>(
        null,
    );
    const [renameDocumentTarget, setRenameDocumentTarget] = useState<DocumentFull | null>(null);
    const [moveDocumentTarget, setMoveDocumentTarget] = useState<DocumentFull | null>(null);
    const [deleteDocumentTarget, setDeleteDocumentTarget] = useState<DocumentFull | null>(null);

    const loadData = useCallback(async (categoryId?: Id | null) => {
        setLoading(true);
        setError(null);
        try {
            const [cats, docs] = await Promise.all([
                documentsAPI.getCategories(),
                documentsAPI.getDocuments(
                    categoryId != null ? { categoryId } : {},
                ),
            ]);
            setCategories(cats);
            setDocuments(docs);
            if (categoryId != null) {
                const refreshed = cats.find((cat) => Number(cat.id) === Number(categoryId));
                if (!refreshed || isLockedCategory(refreshed)) {
                    setSelectedCategory(null);
                } else {
                    setSelectedCategory(refreshed);
                }
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load documents'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!canUpload) {
            setLoading(false);
            setCategories([]);
            setDocuments([]);
            setError(null);
            return;
        }
        void loadData(selectedCategory?.id ?? null);
    }, [canUpload, loadData, selectedCategory?.id]);

    const categoryCounts = useMemo(() => {
        const counts: Record<number, number> = {};
        for (const doc of documents) {
            if (doc.categoryId == null) continue;
            const key = Number(doc.categoryId);
            counts[key] = (counts[key] ?? 0) + 1;
        }
        return counts;
    }, [documents]);

    const sortedCategories = useMemo(
        () =>
            categories
                .slice()
                .sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: 'base',
                    }),
                ),
        [categories],
    );

    const unlockedCategories = useMemo(
        () =>
            sortedCategories.filter(
                (cat): cat is DocumentCategory => !isLockedCategory(cat),
            ),
        [sortedCategories],
    );

    const rootDocuments = useMemo(
        () =>
            documents
                .filter((doc) => doc.categoryId == null)
                .slice()
                .sort((a, b) =>
                    a.title.localeCompare(b.title, undefined, {
                        numeric: true,
                        sensitivity: 'base',
                    }),
                ),
        [documents],
    );

    const folderDocuments = useMemo(() => {
        if (!selectedCategory) return [];
        return documents
            .filter((doc) => Number(doc.categoryId) === Number(selectedCategory.id))
            .slice()
            .sort((a, b) =>
                a.title.localeCompare(b.title, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
    }, [documents, selectedCategory]);

    const detailTitle = useMemo(() => {
        if (detailDocumentId == null) return '';
        const match = documents.find((doc) => Number(doc.id) === Number(detailDocumentId));
        return match?.title || '';
    }, [detailDocumentId, documents]);

    const canShowAccessLog = useCallback(
        (doc: DocumentFull) => Boolean(doc.canManageAccess),
        [],
    );

    const canUploadInCurrentFolder =
        canUpload && (!selectedCategory || Boolean(selectedCategory.canManageAccess));

    const handleOpenCategory = (category: DocumentCategory) => {
        setSelectedCategory(category);
        void documentsAPI.logCategoryView(category.id).catch(() => undefined);
    };

    const handleNavigateRoot = () => {
        setSelectedCategory(null);
        setUploadOpen(false);
    };

    const handleDownload = async (doc: DocumentFull) => {
        try {
            await documentsAPI.downloadDocument(doc.id, doc.title || 'document');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to download document'));
        }
    };

    const handleLockedClick = (doc: DocumentListItem) => {
        setRequestTarget({ type: 'document', id: doc.id, title: doc.title });
    };

    const handleLockedFolderClick = (category: CategoryListItem) => {
        setRequestTarget({ type: 'category', id: category.id, title: category.name });
    };

    const handleOpenDetail = (doc: DocumentFull) => {
        setDetailDocumentId(doc.id);
    };

    const handleGrant = (doc: DocumentFull) => {
        setGrantTarget({ type: 'document', id: doc.id, title: doc.title });
    };

    const handleAccessLog = (doc: DocumentFull) => {
        setAccessLogTarget({ type: 'document', id: doc.id, title: doc.title });
    };

    const handleDropDocument = async (documentId: Id, categoryId: Id | null) => {
        try {
            await documentsAPI.updateDocument(documentId, { categoryId });
            showStubMessage('Document moved');
            await loadData(selectedCategory?.id ?? null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to move document'));
        }
    };

    const handleDocumentMoved = async () => {
        showStubMessage('Document moved');
        await loadData(selectedCategory?.id ?? null);
        setDetailListVersion((version) => version + 1);
    };

    const handleUploaded = async () => {
        await loadData(selectedCategory?.id ?? null);
    };

    const handleRequested = async () => {
        showStubMessage('Access request sent');
    };

    const handleAccessChanged = async () => {
        await loadData(selectedCategory?.id ?? null);
        setDetailListVersion((version) => version + 1);
    };

    const handleAccessRequestsChanged = async () => {
        await loadData(selectedCategory?.id ?? null);
    };

    const handleCategorySaved = async () => {
        showStubMessage(
            categoryModal?.mode === 'edit' ? 'Folder renamed' : 'Folder created',
        );
        await loadData(selectedCategory?.id ?? null);
    };

    const handleCategoryDeleted = async () => {
        showStubMessage('Folder deleted');
        if (
            selectedCategory &&
            deleteCategoryTarget &&
            Number(selectedCategory.id) === Number(deleteCategoryTarget.id)
        ) {
            setSelectedCategory(null);
        }
        await loadData(null);
    };

    const handleDocumentRenamed = async () => {
        showStubMessage('Document renamed');
        await loadData(selectedCategory?.id ?? null);
        setDetailListVersion((version) => version + 1);
    };

    const handleDocumentDeleted = async () => {
        showStubMessage('Document deleted');
        if (
            detailDocumentId != null &&
            deleteDocumentTarget &&
            Number(detailDocumentId) === Number(deleteDocumentTarget.id)
        ) {
            setDetailDocumentId(null);
        }
        await loadData(selectedCategory?.id ?? null);
    };

    const openCreateFolder = () => {
        setCategoryModal({ mode: 'create' });
    };

    const explorerDocuments = selectedCategory ? folderDocuments : rootDocuments;

    if (!canUpload) {
        return (
            <div className="documents-page">
                <div className="page-header">
                    <h1 className="members-page-title members-page-title-inline">Documents</h1>
                </div>
                <hr className="title-divider" />
                <div className="card members-table-card documents-main-card">
                    <div className="card-body">
                        <p className="empty-message">
                            Documents are available to org leadership and team Heads/Vice only.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="documents-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Documents</h1>
            </div>

            <hr className="title-divider" />

            {error ? <div className="error-message">{error}</div> : null}
            {stubMessage ? <div className="success-message">{stubMessage}</div> : null}

            <div className="card members-table-card documents-main-card">
                <DocumentBreadcrumb
                    categoryName={selectedCategory?.name ?? null}
                    onNavigateRoot={handleNavigateRoot}
                    dropToRootEnabled
                    onDropToRoot={(documentId) => void handleDropDocument(documentId, null)}
                />
                {loading ? (
                    <div className="documents-explorer-scroll">
                        <DocumentsSkeletonGrid />
                    </div>
                ) : (
                    <div className="documents-explorer-scroll">
                        <DocumentsExplorerGrid
                            folders={selectedCategory ? [] : sortedCategories}
                            documents={explorerDocuments}
                            folderCounts={categoryCounts}
                            canShowAccessLog={canShowAccessLog}
                            canUpload={canUploadInCurrentFolder}
                            emptyTitle={
                                selectedCategory
                                    ? 'This folder is empty'
                                    : 'No documents yet'
                            }
                            emptyText={
                                selectedCategory
                                    ? 'No documents visible to you here.'
                                    : 'No documents visible to you yet.'
                            }
                            onUpload={
                                canUploadInCurrentFolder
                                    ? () => setUploadOpen(true)
                                    : undefined
                            }
                            onCreateFolder={
                                canUpload && !selectedCategory
                                    ? openCreateFolder
                                    : undefined
                            }
                            draggableDocuments
                            onOpenFolder={handleOpenCategory}
                            onLockedFolderClick={handleLockedFolderClick}
                            onRenameFolder={(category) =>
                                setCategoryModal({ mode: 'edit', category })
                            }
                            onDeleteFolder={setDeleteCategoryTarget}
                            onGrantFolder={(category) =>
                                setGrantTarget({
                                    type: 'category',
                                    id: category.id,
                                    title: category.name,
                                })
                            }
                            onManageFolderAccess={(category) =>
                                setManageAccessTarget({
                                    type: 'category',
                                    id: category.id,
                                    title: category.name,
                                })
                            }
                            onFolderAccessLog={(category) =>
                                setAccessLogTarget({
                                    type: 'category',
                                    id: category.id,
                                    title: category.name,
                                })
                            }
                            onDropDocument={handleDropDocument}
                            onLockedClick={handleLockedClick}
                            onOpenDetail={handleOpenDetail}
                            onDownload={(doc) => void handleDownload(doc)}
                            onRename={setRenameDocumentTarget}
                            onMove={setMoveDocumentTarget}
                            onDelete={setDeleteDocumentTarget}
                            onGrant={handleGrant}
                            onManageAccess={(doc) =>
                                setManageAccessTarget({
                                    type: 'document',
                                    id: doc.id,
                                    title: doc.title,
                                })
                            }
                            onAccessLog={handleAccessLog}
                        />
                    </div>
                )}
            </div>

            {canUpload ? (
                <div className="card members-table-card documents-access-requests-card">
                    <div className="card-header card-header-with-action">
                        <div className="card-header-left">
                            <h3 className="card-title documents-access-requests-title">
                                Access Requests
                                {pendingRequestCount > 0 ? (
                                    <span className="documents-access-requests-badge">
                                        {pendingRequestCount > 99
                                            ? '99+'
                                            : pendingRequestCount}
                                    </span>
                                ) : null}
                            </h3>
                        </div>
                    </div>
                    <div className="card-body">
                        <AccessRequestsPanel
                            onChanged={handleAccessRequestsChanged}
                            onPendingCountChange={setPendingRequestCount}
                        />
                    </div>
                </div>
            ) : null}

            {canUpload ? (
                <UploadDocumentModal
                    isOpen={uploadOpen}
                    categoryId={selectedCategory?.id ?? null}
                    categoryName={selectedCategory?.name}
                    onClose={() => setUploadOpen(false)}
                    onUploaded={handleUploaded}
                />
            ) : null}

            <CreateCategoryModal
                isOpen={categoryModal != null}
                mode={categoryModal?.mode ?? 'create'}
                category={categoryModal?.category ?? null}
                onClose={() => setCategoryModal(null)}
                onSaved={handleCategorySaved}
            />

            <DeleteCategoryModal
                category={deleteCategoryTarget}
                onClose={() => setDeleteCategoryTarget(null)}
                onDeleted={handleCategoryDeleted}
            />

            <RenameDocumentModal
                document={renameDocumentTarget}
                onClose={() => setRenameDocumentTarget(null)}
                onSaved={handleDocumentRenamed}
            />

            <MoveDocumentModal
                document={moveDocumentTarget}
                categories={unlockedCategories}
                onClose={() => setMoveDocumentTarget(null)}
                onMoved={handleDocumentMoved}
            />

            <DeleteDocumentModal
                document={deleteDocumentTarget}
                onClose={() => setDeleteDocumentTarget(null)}
                onDeleted={handleDocumentDeleted}
            />

            <RequestAccessModal
                targetType={requestTarget?.type ?? null}
                targetId={requestTarget?.id ?? null}
                targetTitle={requestTarget?.title ?? ''}
                onClose={() => setRequestTarget(null)}
                onRequested={handleRequested}
            />

            <DocumentDetailModal
                documentId={detailDocumentId}
                listVersion={detailListVersion}
                onClose={() => setDetailDocumentId(null)}
                onRefresh={handleAccessChanged}
                onOpenGrant={(id) => {
                    setGrantTarget({ type: 'document', id, title: detailTitle });
                }}
                onOpenAccessLog={(id, title) => {
                    setAccessLogTarget({ type: 'document', id, title });
                }}
            />

            <GrantAccessModal
                targetType={grantTarget?.type}
                targetId={grantTarget?.id ?? null}
                targetTitle={grantTarget?.title}
                excludeTeamIds={ledTeamIds}
                onClose={() => setGrantTarget(null)}
                onGranted={handleAccessChanged}
            />

            <ManageAccessModal
                targetType={manageAccessTarget?.type ?? null}
                targetId={manageAccessTarget?.id ?? null}
                targetTitle={manageAccessTarget?.title}
                onClose={() => setManageAccessTarget(null)}
                onChanged={handleAccessChanged}
            />

            <DocumentAccessLogModal
                targetType={accessLogTarget?.type}
                targetId={accessLogTarget?.id ?? null}
                targetTitle={accessLogTarget?.title ?? ''}
                onClose={() => setAccessLogTarget(null)}
            />
        </div>
    );
}
