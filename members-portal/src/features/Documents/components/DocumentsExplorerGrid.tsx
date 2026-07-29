'use client';

import {
    Download,
    File,
    FileImage,
    FileSpreadsheet,
    FileText,
    Folder,
    FolderInput,
    FolderPlus,
    KeyRound,
    Lock,
    MoreVertical,
    Pencil,
    ScrollText,
    Trash2,
    Upload,
    Users,
} from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type DragEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
    isLockedCategory,
    isLockedDocument,
    type CategoryListItem,
    type DocumentCategory,
    type DocumentFull,
    type DocumentListItem,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';

interface DocumentsExplorerGridProps {
    folders?: CategoryListItem[];
    documents: DocumentListItem[];
    folderCounts?: Record<number, number>;
    canShowAccessLog: (doc: DocumentFull) => boolean;
    canUpload?: boolean;
    emptyTitle?: string;
    emptyText?: string;
    draggableDocuments?: boolean;
    onUpload?: () => void;
    onCreateFolder?: () => void;
    onOpenFolder?: (category: DocumentCategory) => void;
    onLockedFolderClick?: (category: CategoryListItem) => void;
    onRenameFolder?: (category: DocumentCategory) => void;
    onDeleteFolder?: (category: DocumentCategory) => void;
    onGrantFolder?: (category: DocumentCategory) => void;
    onManageFolderAccess?: (category: DocumentCategory) => void;
    onFolderAccessLog?: (category: DocumentCategory) => void;
    onDropDocument?: (documentId: Id, categoryId: Id | null) => void | Promise<void>;
    onLockedClick: (doc: DocumentListItem) => void;
    onOpenDetail: (doc: DocumentFull) => void;
    onDownload: (doc: DocumentFull) => void;
    onRename?: (doc: DocumentFull) => void;
    onMove?: (doc: DocumentFull) => void;
    onDelete?: (doc: DocumentFull) => void;
    onGrant: (doc: DocumentFull) => void;
    onManageAccess?: (doc: DocumentFull) => void;
    onAccessLog: (doc: DocumentFull) => void;
}

type MenuCoords = { top: number; left: number };

function fileIconForType(fileType: string) {
    const mime = fileType.toLowerCase();
    if (mime.startsWith('image/')) return FileImage;
    if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime === 'text/csv' ||
        mime.includes('sheet')
    ) {
        return FileSpreadsheet;
    }
    if (
        mime.includes('pdf') ||
        mime.startsWith('text/') ||
        mime.includes('word') ||
        mime.includes('document')
    ) {
        return FileText;
    }
    return File;
}

function computeMenuPosition(
    trigger: HTMLElement,
    menuEl: HTMLElement | null,
): MenuCoords {
    const rect = trigger.getBoundingClientRect();
    const menuWidth = menuEl?.offsetWidth ?? 152;
    const menuHeight = menuEl?.offsetHeight ?? 220;
    const gap = 4;
    const left = Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < menuHeight + gap + 8;
    const top = flipUp
        ? Math.max(8, rect.top - menuHeight - gap)
        : rect.bottom + gap;
    return { top, left };
}

export default function DocumentsExplorerGrid({
    folders = [],
    documents,
    folderCounts = {},
    canShowAccessLog,
    canUpload = false,
    emptyTitle = 'Nothing here yet',
    emptyText,
    draggableDocuments = false,
    onUpload,
    onCreateFolder,
    onOpenFolder,
    onLockedFolderClick,
    onRenameFolder,
    onDeleteFolder,
    onGrantFolder,
    onManageFolderAccess,
    onFolderAccessLog,
    onDropDocument,
    onLockedClick,
    onOpenDetail,
    onDownload,
    onRename,
    onMove,
    onDelete,
    onGrant,
    onManageAccess,
    onAccessLog,
}: DocumentsExplorerGridProps) {
    const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
    const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    const closeMenu = () => {
        setOpenMenuKey(null);
        setMenuCoords(null);
    };

    const setTriggerRef = (key: string, node: HTMLButtonElement | null) => {
        if (node) {
            triggerRefs.current.set(key, node);
        } else {
            triggerRefs.current.delete(key);
        }
    };

    const toggleMenu = (key: string) => {
        setOpenMenuKey((prev) => (prev === key ? null : key));
    };

    useLayoutEffect(() => {
        if (openMenuKey == null) {
            setMenuCoords(null);
            return;
        }

        const updatePosition = () => {
            const trigger = triggerRefs.current.get(openMenuKey);
            if (!trigger) return;
            setMenuCoords(computeMenuPosition(trigger, menuRef.current));
        };

        updatePosition();
        // Re-measure after paint so menu size is known for flip.
        const raf = requestAnimationFrame(updatePosition);

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [openMenuKey]);

    useEffect(() => {
        if (openMenuKey == null) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current?.contains(target)) return;
            const trigger = triggerRefs.current.get(openMenuKey);
            if (trigger?.contains(target)) return;
            closeMenu();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu();
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [openMenuKey]);

    const isEmpty = folders.length === 0 && documents.length === 0;
    const showAddPlaceholder = canUpload && Boolean(onUpload);

    // Viewers with nothing to show keep the classic empty state.
    // Uploaders always get the grid so the dashed add tile is available.
    if (isEmpty && !showAddPlaceholder) {
        const EmptyIcon = onCreateFolder ? Folder : FileText;
        return (
            <div className="empty-state">
                <EmptyIcon className="empty-state-icon" />
                <h4 className="empty-state-title">{emptyTitle}</h4>
                <p className="empty-state-text">
                    {emptyText ?? 'No documents visible to you here.'}
                </p>
            </div>
        );
    }

    const handleFolderDragOver = (
        event: DragEvent,
        category: DocumentCategory,
    ) => {
        if (!onDropDocument || !category.canManageAccess) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverId(Number(category.id));
    };

    const handleFolderDrop = (event: DragEvent, category: DocumentCategory) => {
        if (!onDropDocument || !category.canManageAccess) return;
        event.preventDefault();
        setDragOverId(null);
        const raw = event.dataTransfer.getData('application/x-document-id');
        if (!raw) return;
        void onDropDocument(raw as Id, category.id);
    };

    const handleDocDragStart = (event: DragEvent, doc: DocumentFull) => {
        if (!draggableDocuments || !doc.canManageAccess) return;
        event.dataTransfer.setData('application/x-document-id', String(doc.id));
        event.dataTransfer.effectAllowed = 'move';
    };

    const openFolder =
        openMenuKey?.startsWith('folder-')
            ? folders.find(
                  (f): f is DocumentCategory =>
                      !isLockedCategory(f) && `folder-${f.id}` === openMenuKey,
              )
            : undefined;
    const openDoc =
        openMenuKey?.startsWith('doc-')
            ? documents.find(
                  (d): d is DocumentFull =>
                      !isLockedDocument(d) && `doc-${d.id}` === openMenuKey,
              )
            : undefined;

    const menuStyle: CSSProperties | undefined = menuCoords
        ? { top: menuCoords.top, left: menuCoords.left }
        : { visibility: 'hidden', top: 0, left: 0 };

    const portalMenu =
        openMenuKey != null && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      ref={menuRef}
                      className="documents-doc-menu documents-doc-menu--portal"
                      role="menu"
                      style={menuStyle}
                  >
                      {openFolder ? (
                          <>
                              {onRenameFolder ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onRenameFolder(openFolder);
                                      }}
                                  >
                                      <Pencil size={14} />
                                      Edit
                                  </button>
                              ) : null}
                              {onGrantFolder ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onGrantFolder(openFolder);
                                      }}
                                  >
                                      <KeyRound size={14} />
                                      Grant access
                                  </button>
                              ) : null}
                              {onManageFolderAccess ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onManageFolderAccess(openFolder);
                                      }}
                                  >
                                      <Users size={14} />
                                      Manage access
                                  </button>
                              ) : null}
                              {onFolderAccessLog ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onFolderAccessLog(openFolder);
                                      }}
                                  >
                                      <ScrollText size={14} />
                                      Access log
                                  </button>
                              ) : null}
                              {onDeleteFolder ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onDeleteFolder(openFolder);
                                      }}
                                  >
                                      <Trash2 size={14} />
                                      Delete
                                  </button>
                              ) : null}
                          </>
                      ) : null}
                      {openDoc ? (
                          <>
                              {onRename ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onRename(openDoc);
                                      }}
                                  >
                                      <Pencil size={14} />
                                      Edit
                                  </button>
                              ) : null}
                              {onMove ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onMove(openDoc);
                                      }}
                                  >
                                      <FolderInput size={14} />
                                      Move
                                  </button>
                              ) : null}
                              <button
                                  type="button"
                                  className="documents-doc-menu-item"
                                  role="menuitem"
                                  onClick={() => {
                                      closeMenu();
                                      onGrant(openDoc);
                                  }}
                              >
                                  <KeyRound size={14} />
                                  Grant access
                              </button>
                              {onManageAccess ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onManageAccess(openDoc);
                                      }}
                                  >
                                      <Users size={14} />
                                      Manage access
                                  </button>
                              ) : null}
                              {canShowAccessLog(openDoc) ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onAccessLog(openDoc);
                                      }}
                                  >
                                      <ScrollText size={14} />
                                      Access log
                                  </button>
                              ) : null}
                              {onDelete ? (
                                  <button
                                      type="button"
                                      className="documents-doc-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                          closeMenu();
                                          onDelete(openDoc);
                                      }}
                                  >
                                      <Trash2 size={14} />
                                      Delete
                                  </button>
                              ) : null}
                          </>
                      ) : null}
                  </div>,
                  document.body,
              )
            : null;

    const addPlaceholder =
        showAddPlaceholder && onUpload ? (
            onCreateFolder ? (
                <div className="documents-split-add-card" aria-label="Add document or folder">
                    <button
                        type="button"
                        className="documents-split-add-half"
                        onClick={onUpload}
                    >
                        <Upload className="documents-split-add-icon" size={20} aria-hidden />
                        <span className="documents-split-add-text">Upload</span>
                    </button>
                    <button
                        type="button"
                        className="documents-split-add-half"
                        onClick={onCreateFolder}
                    >
                        <FolderPlus className="documents-split-add-icon" size={20} aria-hidden />
                        <span className="documents-split-add-text">New Folder</span>
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="documents-folder-add-card"
                    onClick={onUpload}
                >
                    <Upload className="documents-folder-add-card-icon" aria-hidden />
                    <span className="documents-folder-add-card-text">Upload</span>
                </button>
            )
        ) : null;

    return (
        <div className="documents-explorer-grid">
            {folders.map((category) => {
                const locked = isLockedCategory(category);
                const count = folderCounts[Number(category.id)] ?? 0;
                const menuKey = `folder-${category.id}`;
                const menuOpen = openMenuKey === menuKey;
                const canManage = !locked && Boolean(category.canManageAccess);
                const isDragOver = canManage && dragOverId === Number(category.id);

                return (
                    <div
                        key={menuKey}
                        className={`documents-folder-tile${
                            locked ? ' documents-folder-tile--locked' : ''
                        }${isDragOver ? ' documents-folder-tile--drag-over' : ''}${
                            menuOpen ? ' documents-folder-tile--menu-open' : ''
                        }`}
                        onDragOver={
                            canManage
                                ? (e) => handleFolderDragOver(e, category)
                                : undefined
                        }
                        onDragLeave={canManage ? () => setDragOverId(null) : undefined}
                        onDrop={
                            canManage
                                ? (e) => handleFolderDrop(e, category)
                                : undefined
                        }
                    >
                        <button
                            type="button"
                            className="documents-folder-tile-main"
                            aria-label={
                                locked
                                    ? `Request access to ${category.name}`
                                    : undefined
                            }
                            onClick={() => {
                                if (locked) {
                                    onLockedFolderClick?.(category);
                                    return;
                                }
                                onOpenFolder?.(category);
                            }}
                        >
                            <span className="documents-folder-tile-icon-wrap">
                                <Folder
                                    className="documents-folder-tile-icon"
                                    size={36}
                                    aria-hidden
                                />
                                {locked ? (
                                    <span
                                        className="documents-doc-lock-badge"
                                        aria-label="Locked"
                                    >
                                        <Lock size={12} />
                                    </span>
                                ) : null}
                            </span>
                            <span className="documents-folder-tile-name" title={category.name}>
                                {category.name}
                            </span>
                            {locked ? (
                                <span className="documents-doc-request-access">
                                    Request access
                                </span>
                            ) : (
                                <span className="documents-folder-tile-count">
                                    {count} {count === 1 ? 'document' : 'documents'}
                                </span>
                            )}
                        </button>

                        {canManage ? (
                            <div className="documents-folder-tile-actions">
                                <button
                                    type="button"
                                    className="documents-doc-action-btn"
                                    title="Folder actions"
                                    aria-label={`Actions for ${category.name}`}
                                    aria-expanded={menuOpen}
                                    aria-haspopup="menu"
                                    ref={(node) => setTriggerRef(menuKey, node)}
                                    onClick={() => toggleMenu(menuKey)}
                                >
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        ) : null}
                    </div>
                );
            })}

            {documents.map((doc) => {
                const locked = isLockedDocument(doc);
                const Icon = locked ? FileText : fileIconForType(doc.fileType);
                const menuKey = `doc-${doc.id}`;
                const menuOpen = openMenuKey === menuKey;
                const showManageMenu = !locked && Boolean(doc.canManageAccess);
                const canDrag = draggableDocuments && showManageMenu;

                return (
                    <div
                        key={menuKey}
                        className={`documents-doc-tile${locked ? ' documents-doc-tile--locked' : ''}${
                            showManageMenu ? ' documents-doc-tile--manage' : ''
                        }${canDrag ? ' documents-doc-tile--draggable' : ''}${
                            menuOpen ? ' documents-doc-tile--menu-open' : ''
                        }`}
                        draggable={canDrag}
                        onDragStart={
                            canDrag ? (e) => handleDocDragStart(e, doc) : undefined
                        }
                    >
                        <button
                            type="button"
                            className="documents-doc-tile-main"
                            aria-label={
                                locked ? `Request access to ${doc.title}` : undefined
                            }
                            onClick={() => {
                                if (locked) {
                                    onLockedClick(doc);
                                    return;
                                }
                                onOpenDetail(doc);
                            }}
                        >
                            <span className="documents-doc-tile-icon-wrap">
                                <Icon size={28} aria-hidden />
                                {locked ? (
                                    <span className="documents-doc-lock-badge" aria-label="Locked">
                                        <Lock size={12} />
                                    </span>
                                ) : null}
                            </span>
                            <span className="documents-doc-tile-title" title={doc.title}>
                                {doc.title}
                            </span>
                            {locked ? (
                                <span className="documents-doc-request-access">
                                    Request access
                                </span>
                            ) : null}
                        </button>

                        {!locked ? (
                            <div className="documents-doc-tile-actions">
                                <button
                                    type="button"
                                    className="documents-doc-action-btn"
                                    title="Download"
                                    aria-label={`Download ${doc.title}`}
                                    onClick={() => onDownload(doc)}
                                >
                                    <Download size={16} />
                                </button>
                                {showManageMenu ? (
                                    <button
                                        type="button"
                                        className="documents-doc-action-btn"
                                        title="More actions"
                                        aria-label={`More actions for ${doc.title}`}
                                        aria-expanded={menuOpen}
                                        aria-haspopup="menu"
                                        ref={(node) => setTriggerRef(menuKey, node)}
                                        onClick={() => toggleMenu(menuKey)}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                );
            })}

            {addPlaceholder}
            {portalMenu}
        </div>
    );
}
