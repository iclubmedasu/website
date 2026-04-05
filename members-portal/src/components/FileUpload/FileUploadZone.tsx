import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileText, Image, File, Folder, FolderOpen, Upload, Check, X, RotateCcw, Trash2, Loader, Download, AlertTriangle, History, ArchiveRestore, Pencil, ChevronDown, ChevronRight, Plus, MessageCircle } from 'lucide-react';
import { projectFilesAPI } from '../../services/api';
import FileCommentsModal from '../../pages/Projects/modals/FileCommentsModal';
import '../../components/modal/modal.css';
import './FileUploadZone.css';
import type { Id, ProjectFileRef, ProjectFolderRef } from '../../types/backend-contracts';

export interface FileUploadZoneProps {
    projectId: Id | string;
    memberId?: Id | string | null;
    onFileUploaded?: (file: ProjectFileRef, replaced: boolean) => void;
    onFileRemoved?: (fileId: Id | string) => void;
    onFileRenamed?: (file: ProjectFileRef) => void;
    existingFiles?: ProjectFileRef[];
    existingFolders?: ProjectFolderRef[];
    disabled?: boolean;
}

type UploadFileEntry = {
    id: Id | string;
    name: string;
    size: number;
    mimeType?: string | null;
    folderId?: Id | null;
    progress: number;
    processing: boolean;
    failed: boolean;
    done: boolean;
    fileObj: File | null;
    [key: string]: any;
};

type FolderActionState = {
    type: 'delete' | 'restore' | 'history';
    folder: ProjectFolderRef;
};

type RenameTarget = {
    kind: 'file' | 'folder';
    item: any;
};

type DuplicateConfirmState = {
    file: File;
    existingEntry: UploadFileEntry;
};

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

/** Human-readable file size */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pick an icon based on MIME type */
function FileIcon({ mimeType }: { mimeType?: string | null }) {
    if (mimeType?.startsWith('image/')) return <Image size={18} />;
    if (mimeType === 'application/pdf') return <FileText size={18} />;
    return <File size={18} />;
}

let _uid = 0;
function uid() { return `upload_${Date.now()}_${++_uid}`; }

export default function FileUploadZone({ projectId, memberId, onFileUploaded, onFileRemoved, onFileRenamed, existingFiles = [], existingFolders = [], disabled }: FileUploadZoneProps) {
    const [uploadingFiles, setUploadingFiles] = useState<UploadFileEntry[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [targetFolderId, setTargetFolderId] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<UploadFileEntry | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [folders, setFolders] = useState<ProjectFolderRef[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<Id | string>>(() => new Set());
    const [showDeletedFolders, setShowDeletedFolders] = useState(false);
    const [folderCreateOpen, setFolderCreateOpen] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [folderCreateLoading, setFolderCreateLoading] = useState(false);
    const [folderCreateError, setFolderCreateError] = useState('');
    const [folderAction, setFolderAction] = useState<FolderActionState | null>(null); // { type: 'delete' | 'restore' | 'history', folder }
    const [folderActionLoading, setFolderActionLoading] = useState(false);
    const [folderActionError, setFolderActionError] = useState('');
    const [folderHistoryData, setFolderHistoryData] = useState<any[]>([]);
    const [folderHistoryLoading, setFolderHistoryLoading] = useState(false);
    const [historyTarget, setHistoryTarget] = useState<UploadFileEntry | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [commentTarget, setCommentTarget] = useState<UploadFileEntry | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);
    const [deletedFiles, setDeletedFiles] = useState<ProjectFileRef[]>([]);
    const [deletedLoading, setDeletedLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<Id | string | null>(null);
    // Rename state
    const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null); // { kind: 'file' | 'folder', item }
    const [renameValue, setRenameValue] = useState('');
    const [renameLoading, setRenameLoading] = useState(false);
    const [renameError, setRenameError] = useState('');
    // Duplicate-name upload confirmation state
    const [duplicateConfirm, setDuplicateConfirm] = useState<DuplicateConfirmState | null>(null); // { file, existingEntry }
    const [draggingFileId, setDraggingFileId] = useState<Id | string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<Id | string | null>(null);
    const [dragOverRoot, setDragOverRoot] = useState(false);

    // Sync existing files on mount / when existingFiles changes
    useEffect(() => {
        const existing = existingFiles.map((f) => ({
            id: f.id,
            name: f.fileName,
            size: f.fileSize,
            mimeType: f.mimeType,
            folderId: f.folderId ?? null,
            progress: 100,
            processing: false,
            failed: false,
            done: true,
            fileObj: null,
        }));
        setUploadingFiles(existing);
    }, [existingFiles]);

    useEffect(() => {
        setFolders(existingFolders);
        setExpandedFolders((prev) => prev);
    }, [existingFolders]);

    const activeFolders = useMemo(() => folders.filter((folder) => folder.isActive), [folders]);
    const deletedFolders = useMemo(() => folders.filter((folder) => !folder.isActive), [folders]);

    const filesByFolder = useMemo(() => {
        const map = new Map();
        for (const file of uploadingFiles.filter((f) => f.done)) {
            const key = file.folderId ?? 'root';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(file);
        }
        return map;
    }, [uploadingFiles]);

    const rootFiles = (filesByFolder.get('root') || []) as UploadFileEntry[];

    const updateFile = useCallback((id: Id | string, updates: Partial<UploadFileEntry>) => {
        setUploadingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    }, []);

    const clearDragState = useCallback(() => {
        setDraggingFileId(null);
        setDragOverFolderId(null);
        setDragOverRoot(false);
    }, []);

    const handleFileDragStart = useCallback((fileEntry: UploadFileEntry, event: any) => {
        if (disabled || !fileEntry.done) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(fileEntry.id));
        setDraggingFileId(fileEntry.id);
        setDragOverFolderId(null);
        setDragOverRoot(false);
    }, [disabled]);

    const handleFileDragEnd = useCallback(() => {
        clearDragState();
    }, [clearDragState]);

    const moveFileToFolder = useCallback(async (fileEntry: UploadFileEntry | null | undefined, folderId: Id | null) => {
        if (!fileEntry || (fileEntry.folderId ?? null) === folderId) {
            clearDragState();
            return;
        }

        try {
            const moved = await projectFilesAPI.move(fileEntry.id, folderId) as any;
            setUploadingFiles((prev) => prev.map((f) => (f.id === moved.id ? { ...f, ...moved, folderId: moved.folderId ?? null } : f)));
        } catch (err: unknown) {
            console.error('Move failed:', err);
            alert(getErrorMessage(err, 'Failed to move file'));
        } finally {
            clearDragState();
        }
    }, [clearDragState]);

    const handleRepositoryDragOver = useCallback((event: any) => {
        if (disabled || draggingFileId == null) return;
        event.preventDefault();
        event.stopPropagation();
        if (!dragOverRoot) setDragOverRoot(true);
        setDragOverFolderId(null);
    }, [disabled, draggingFileId, dragOverRoot]);

    const handleRepositoryDrop = useCallback((event: any) => {
        if (disabled || draggingFileId == null) return;
        event.preventDefault();
        event.stopPropagation();
        const dragged = uploadingFiles.find((f) => f.id === draggingFileId);
        if (dragged) moveFileToFolder(dragged, null);
    }, [disabled, draggingFileId, moveFileToFolder, uploadingFiles]);

    const doUpload = useCallback(async (entry: UploadFileEntry) => {
        if (!entry.fileObj) return;
        try {
            const result = await projectFilesAPI.upload(
                projectId,
                memberId as any,
                entry.fileObj,
                (progress) => {
                    if (progress >= 100) {
                        // Upload to our server is done, now GitHub API is processing
                        updateFile(entry.id, { progress: 100, processing: true });
                    } else {
                        updateFile(entry.id, { progress });
                    }
                },
                entry.folderId || null,
            ) as any;
            if (result._replaced) {
                // File was replaced — remove the temp uploading row,
                // update the existing row that shares the same DB id
                setUploadingFiles((prev) => {
                    const withoutTemp = prev.filter((f) => f.id !== entry.id);
                    return withoutTemp.map((f) => f.id === result.id ? {
                        ...f,
                        size: result.fileSize,
                        mimeType: result.mimeType,
                        done: true,
                        processing: false,
                        failed: false,
                        progress: 100,
                    } : f);
                });
                // Tell parent to replace, not append
                if (onFileUploaded) onFileUploaded(result, true);
            } else {
                updateFile(entry.id, {
                    progress: 100,
                    processing: false,
                    failed: false,
                    done: true,
                    id: result.id, // replace temp id with real DB id
                });
                if (onFileUploaded) onFileUploaded(result, false);
            }
        } catch (err: unknown) {
            console.error('Upload failed:', err);
            updateFile(entry.id, { failed: true, processing: false });
        }
    }, [projectId, memberId, onFileUploaded, updateFile]);

    const processFiles = useCallback((fileList: FileList | File[], folderIdOverride: Id | null = null) => {
        if (disabled) return;
        const files = Array.from(fileList) as File[];
        const folderIdValue = folderIdOverride !== null ? folderIdOverride : (targetFolderId ? Number(targetFolderId) : null);
        files.forEach((file) => {
            // Check for duplicate name among existing (completed) files
            const existingMatch = uploadingFiles.find(
                (f) => f.done && f.name.toLowerCase() === file.name.toLowerCase() && (f.folderId ?? null) === folderIdValue
            );
            if (existingMatch) {
                // Show confirmation dialog instead of uploading immediately
                setDuplicateConfirm({ file, existingEntry: existingMatch });
                return;
            }
            const id = uid();
            const entry = {
                id,
                name: file.name,
                size: file.size,
                mimeType: file.type,
                progress: 0,
                processing: false,
                failed: false,
                done: false,
                fileObj: file,
                folderId: folderIdValue,
            };
            setUploadingFiles((prev) => [...prev, entry]);
            doUpload(entry);
        });
    }, [disabled, doUpload, uploadingFiles, targetFolderId]);

    const handleDrop = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files, null);
    };

    const handleDragOver = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
    };

    const handleDragLeave = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleFileInput = (e: any) => {
        if (e.target.files?.length) processFiles(e.target.files);
        if (targetFolderId) setTargetFolderId('');
        e.target.value = ''; // reset so the same file can be selected again
    };

    const requestDelete = (fileEntry: UploadFileEntry) => {
        if (fileEntry.done) {
            setConfirmDelete(fileEntry);
        } else {
            // Not yet uploaded — just remove from list, no confirmation needed
            setUploadingFiles((prev) => prev.filter((f) => f.id !== fileEntry.id));
        }
    };

    const closeDeleteModal = () => {
        setConfirmDelete(null);
        setDeleteLoading(false);
        setDeleteError('');
    };

    const confirmDeleteFile = async () => {
        if (!confirmDelete) return;
        setDeleteLoading(true);
        setDeleteError('');
        try {
            await projectFilesAPI.remove(confirmDelete.id);
            if (onFileRemoved) onFileRemoved(confirmDelete.id);
            setUploadingFiles((prev) => prev.filter((f) => f.id !== confirmDelete.id));
            closeDeleteModal();
        } catch (err: unknown) {
            console.error('Delete failed:', err);
            setDeleteError(getErrorMessage(err, 'Failed to delete file. Please try again.'));
            setDeleteLoading(false);
        }
    };

    const handleRetry = (entry: UploadFileEntry) => {
        if (!entry.fileObj) return;
        updateFile(entry.id, { progress: 0, failed: false, processing: false, done: false });
        doUpload(entry);
    };

    const openHistory = async (fileEntry: UploadFileEntry) => {
        setHistoryTarget(fileEntry);
        setHistoryLoading(true);
        setHistoryData([]);
        try {
            const data = await projectFilesAPI.getHistory(fileEntry.id);
            setHistoryData(data);
        } catch (err) {
            console.error('History fetch failed:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const closeHistory = () => {
        setHistoryTarget(null);
        setHistoryData([]);
        setHistoryLoading(false);
    };

    const openComments = (fileEntry: UploadFileEntry) => {
        setCommentTarget(fileEntry);
    };

    const closeComments = () => {
        setCommentTarget(null);
    };

    const formatHistoryDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    };

    const refreshFoldersAfterAction = useCallback((updatedFolder: ProjectFolderRef) => {
        setFolders((prev) => prev.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder)));
    }, []);

    const openFolderHistory = async (folder: ProjectFolderRef) => {
        setFolderAction({ type: 'history', folder });
        setFolderHistoryLoading(true);
        setFolderHistoryData([]);
        try {
            const data = await projectFilesAPI.getFolderHistory(folder.id);
            setFolderHistoryData(data);
        } catch (err) {
            console.error('Folder history fetch failed:', err);
        } finally {
            setFolderHistoryLoading(false);
        }
    };

    const openFolderAction = (type: 'delete' | 'restore' | 'history', folder: ProjectFolderRef) => {
        setFolderAction({ type, folder });
        setFolderActionError('');
    };

    const closeFolderAction = () => {
        setFolderAction(null);
        setFolderActionLoading(false);
        setFolderActionError('');
        setFolderHistoryLoading(false);
        setFolderHistoryData([]);
    };

    const confirmFolderAction = async () => {
        if (!folderAction) return;
        const { type, folder } = folderAction;
        setFolderActionLoading(true);
        setFolderActionError('');
        try {
            if (type === 'delete') {
                const result = await projectFilesAPI.removeFolder(folder.id) as any;
                refreshFoldersAfterAction((result?.folder || folder) as ProjectFolderRef);
            } else if (type === 'restore') {
                const result = await projectFilesAPI.restoreFolder(folder.id) as any;
                refreshFoldersAfterAction((result?.folder || result || folder) as ProjectFolderRef);
            }
            closeFolderAction();
        } catch (err: unknown) {
            console.error('Folder action failed:', err);
            setFolderActionError(getErrorMessage(err, 'Failed to update folder'));
            setFolderActionLoading(false);
        }
    };

    const openCreateFolder = () => {
        setFolderCreateOpen(true);
        setFolderCreateError('');
        setFolderName('');
    };

    const closeCreateFolder = () => {
        setFolderCreateOpen(false);
        setFolderCreateError('');
        setFolderName('');
        setFolderCreateLoading(false);
    };

    const confirmCreateFolder = async () => {
        const trimmed = folderName.trim();
        if (!trimmed) {
            setFolderCreateError('Folder name is required.');
            return;
        }
        setFolderCreateLoading(true);
        setFolderCreateError('');
        try {
            const created = await projectFilesAPI.createFolder(projectId, trimmed, memberId as any);
            setFolders((prev) => [...prev, created]);
            setFolderCreateOpen(false);
            setFolderName('');
        } catch (err: unknown) {
            console.error('Create folder failed:', err);
            setFolderCreateError(getErrorMessage(err, 'Failed to create folder'));
        } finally {
            setFolderCreateLoading(false);
        }
    };

    const toggleFolderExpanded = (folderId: Id | string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    const toggleDeleted = async () => {
        if (showDeleted) {
            setShowDeleted(false);
            return;
        }
        setShowDeleted(true);
        setDeletedLoading(true);
        try {
            const files = await projectFilesAPI.getDeleted(projectId);
            setDeletedFiles(files);
        } catch (err) {
            console.error('Fetch deleted files failed:', err);
            setDeletedFiles([]);
        } finally {
            setDeletedLoading(false);
        }
    };

    // ── Rename handlers ──
    const openRename = (fileEntry: UploadFileEntry) => {
        setRenameTarget({ kind: 'file', item: fileEntry });
        setRenameValue(fileEntry.name);
        setRenameError('');
    };

    const openFolderRename = (folder: ProjectFolderRef) => {
        setRenameTarget({ kind: 'folder', item: folder });
        setRenameValue(folder.folderName);
        setRenameError('');
    };

    const closeRename = () => {
        setRenameTarget(null);
        setRenameValue('');
        setRenameError('');
        setRenameLoading(false);
    };

    const handleRename = async () => {
        if (!renameTarget) return;
        const trimmed = renameValue.trim();
        const isFolder = renameTarget.kind === 'folder';
        const currentName = isFolder ? renameTarget.item.folderName : renameTarget.item.name;
        if (!trimmed) { setRenameError(isFolder ? 'Folder name cannot be empty.' : 'File name cannot be empty.'); return; }
        if (trimmed === currentName) { closeRename(); return; } // no change
        setRenameLoading(true);
        setRenameError('');
        try {
            if (isFolder) {
                const updated = await projectFilesAPI.renameFolder(renameTarget.item.id, trimmed);
                refreshFoldersAfterAction(updated);
            } else {
                const updated = await projectFilesAPI.rename(renameTarget.item.id, trimmed);
                // Update local list
                setUploadingFiles((prev) =>
                    prev.map((f) => (f.id === renameTarget.item.id ? { ...f, name: updated.fileName } : f))
                );
                if (onFileRenamed) onFileRenamed(updated);
            }
            closeRename();
        } catch (err: any) {
            console.error('Rename failed:', err);
            if (err.message?.includes('already exists')) {
                setRenameError(isFolder ? 'A folder with this name already exists in this project.' : 'A file with this name already exists in this project.');
            } else {
                setRenameError(err.message || (isFolder ? 'Failed to rename folder.' : 'Failed to rename file.'));
            }
            setRenameLoading(false);
        }
    };

    // ── Duplicate upload confirmation handlers ──
    const closeDuplicateConfirm = () => setDuplicateConfirm(null);

    const confirmDuplicateReplace = () => {
        if (!duplicateConfirm) return;
        const { file, existingEntry } = duplicateConfirm;
        const id = uid();
        const entry = {
            id,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            folderId: existingEntry?.folderId ?? null,
            progress: 0,
            processing: false,
            failed: false,
            done: false,
            fileObj: file,
        };
        setUploadingFiles((prev) => [...prev, entry]);
        doUpload(entry);
        setDuplicateConfirm(null);
    };

    const handleRestore = async (file: ProjectFileRef) => {
        setRestoringId(file.id);
        try {
            const restored = await projectFilesAPI.restore(file.id);
            // Remove from deleted list
            setDeletedFiles((prev) => prev.filter((f) => f.id !== file.id));
            // Add to active files
            if (onFileUploaded) onFileUploaded(restored, false);
        } catch (err: unknown) {
            console.error('Restore failed:', err);
            alert(getErrorMessage(err, 'Failed to restore file'));
        } finally {
            setRestoringId(null);
        }
    };

    const renderFileItem = (f: UploadFileEntry, { nested = false }: { nested?: boolean } = {}) => {
        const downloadUrl = f.done ? projectFilesAPI.getDownloadUrl(f.id) : null;
        return (
            <div
                key={f.id}
                className={`file-item file-row${nested ? ' file-row--nested' : ''}${draggingFileId === f.id ? ' file-row--dragging' : ''}`}
                draggable={!disabled && f.done}
                onDragStart={(e) => handleFileDragStart(f, e)}
                onDragEnd={handleFileDragEnd}
            >
                <div className="file-icon">
                    <FileIcon mimeType={f.mimeType} />
                </div>
                <div className="file-info">
                    <div className="file-name-row">
                        {f.done && downloadUrl ? (
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="file-name file-name--link">
                                {f.name}
                            </a>
                        ) : (
                            <span className="file-name">{f.name}</span>
                        )}
                        <span className="file-size">{formatSize(f.size)}</span>
                    </div>
                    {!f.done && !f.processing && (
                        <div className="file-progress-bar-track">
                            <div
                                className={`file-progress-bar-fill${f.failed ? ' file-progress-bar-fill--failed' : ''}`}
                                style={{ width: `${f.progress}%` }}
                            />
                        </div>
                    )}
                    {f.processing && (
                        <div className="file-progress-bar-track">
                            <div className="file-progress-bar-fill file-progress-bar-fill--processing" style={{ width: '100%' }} />
                        </div>
                    )}
                </div>
                <div className="file-actions">
                    {f.done && <span className="file-status-done"><Check size={16} /></span>}
                    {f.processing && <span className="file-status-processing"><Loader size={14} /></span>}
                    {f.failed && (
                        <>
                            <span className="file-status-failed">Failed</span>
                            <button className="file-retry-btn" title="Retry" onClick={() => handleRetry(f)}>
                                <RotateCcw size={14} />
                            </button>
                        </>
                    )}
                    {!f.failed && !f.done && !f.processing && (
                        <span className="file-status-uploading">{f.progress}%</span>
                    )}
                    {f.done && (
                        <button className="file-comment-btn" title="Comments" onClick={() => openComments(f)}>
                            <MessageCircle size={12} />
                        </button>
                    )}
                    {f.done && downloadUrl && (
                        <a href={downloadUrl} className="file-download-btn" title="Download" download>
                            <Download size={14} />
                        </a>
                    )}
                    {!disabled && f.done && (
                        <button className="file-rename-btn" title="Rename" onClick={() => openRename(f)}>
                            <Pencil size={14} />
                        </button>
                    )}
                    {!disabled && (
                        <button className="file-delete-btn" title="Remove" onClick={() => requestDelete(f)}>
                            {f.done ? <Trash2 size={14} /> : <X size={14} />}
                        </button>
                    )}
                    {f.done && downloadUrl && (
                        <button className="file-history-btn" title="Version history" onClick={() => openHistory(f)}>
                            <History size={14} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderFolderCard = (folder: ProjectFolderRef) => {
        const isExpanded = expandedFolders.has(folder.id);
        const folderFiles = (filesByFolder.get(folder.id) || []) as UploadFileEntry[];
        return (
            <div
                key={folder.id}
                className={`folder-row${folder.isActive ? '' : ' folder-row--deleted'}${dragOverFolderId === folder.id ? ' folder-row--drop-target' : ''}`}
                onDragOver={(e) => {
                    if (disabled || draggingFileId == null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(folder.id);
                    setDragOverRoot(false);
                }}
                onDrop={(e) => {
                    if (disabled || draggingFileId == null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const dragged = uploadingFiles.find((f) => f.id === draggingFileId);
                    if (dragged) moveFileToFolder(dragged, folder.id);
                }}
            >
                <div
                    className={`folder-row-header${dragOverFolderId === folder.id ? ' folder-row-header--drop-target' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleFolderExpanded(folder.id)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleFolderExpanded(folder.id)}
                >
                    <div className="folder-row-header-left">
                        <span className="folder-card-chevron">{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                        {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                        <div className="folder-row-title-group">
                            <span className="folder-card-title">{folder.folderName}</span>
                            <span className="folder-card-count">{folderFiles.length} files</span>
                        </div>
                        {!folder.isActive && <span className="folder-card-badge">Deleted</span>}
                    </div>
                    <div className="folder-row-header-actions" onClick={(e) => e.stopPropagation()}>
                        {!disabled && folder.isActive ? (
                            <>
                                <button type="button" className="folder-upload-btn" title="Upload to this folder" onClick={() => { setTargetFolderId(String(folder.id)); fileInputRef.current?.click(); }}>
                                    <Upload size={14} />
                                </button>
                                <button type="button" className="file-rename-btn" title="Rename folder" onClick={() => openFolderRename(folder)}>
                                    <Pencil size={14} />
                                </button>
                                <button type="button" className="file-delete-btn" title="Delete folder" onClick={() => openFolderAction('delete', folder)}>
                                    <Trash2 size={14} />
                                </button>
                            </>
                        ) : !disabled ? (
                            <button type="button" className="file-restore-btn" title="Restore folder" onClick={() => openFolderAction('restore', folder)}>
                                <ArchiveRestore size={14} />
                                Restore
                            </button>
                        ) : null}
                        <button type="button" className="file-history-btn" title="Folder history" onClick={() => openFolderHistory(folder)}>
                            <History size={14} />
                        </button>
                    </div>
                </div>
                {isExpanded && (
                    <div className="folder-row-body folder-row-body--scrollable">
                        {folderFiles.length > 0 ? (
                            <div className="folder-row-children">
                                {folderFiles.map((f) => renderFileItem(f, { nested: true }))}
                            </div>
                        ) : (
                            <p className="folder-empty">No files in this folder.</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const uploadQueue = uploadingFiles.filter((f) => !f.done);

    return (
        <div className="file-upload-zone">
            <div
                className={`file-drop-area${dragOver ? ' file-drop-area--active' : ''}${disabled ? ' file-drop-area--disabled' : ''}`}
                onClick={() => !disabled && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && fileInputRef.current?.click()}
            >
                <Upload size={24} className="file-drop-icon" />
                <span className="file-drop-text">Drag &amp; drop files here or click to browse</span>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileInput} disabled={disabled} />
            </div>
            <p className="file-drop-hint">Supported: all file types — Max 25 MB per file</p>

            {(uploadQueue.length > 0 || rootFiles.length > 0 || activeFolders.length > 0) && (
                <div className="repository-section">
                    <div
                        className={`repository-list${dragOverRoot ? ' repository-list--drop-target' : ''}`}
                        onDragOver={handleRepositoryDragOver}
                        onDrop={handleRepositoryDrop}
                    >
                        {uploadQueue.length > 0 && uploadQueue.map((f) => renderFileItem(f))}
                        {rootFiles.length > 0 && rootFiles.map((f) => renderFileItem(f))}
                        {activeFolders.length > 0 && activeFolders.map((folder) => renderFolderCard(folder))}
                        {!disabled && (
                            <button type="button" className="repository-add-row" onClick={openCreateFolder}>
                                <Plus size={14} className="repository-add-icon" />
                                <span className="repository-add-label">New folder</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!disabled && !(uploadQueue.length > 0 || rootFiles.length > 0 || activeFolders.length > 0) && (
                <div className="repository-section">
                    <div className="repository-list">
                        <button type="button" className="repository-add-row" onClick={openCreateFolder}>
                            <Plus size={14} className="repository-add-icon" />
                            <span className="repository-add-label">New folder</span>
                        </button>
                    </div>
                </div>
            )}

            {(deletedFolders.length > 0 || !disabled) && (
                <div className="archive-section">
                    <div className="archive-section-divider" aria-hidden="true" />
                    <div className="archive-section-header">
                        <div className="archive-section-copy">
                            <div className="archive-section-kicker">Archive</div>
                        </div>
                    </div>

                    {deletedFolders.length > 0 && (
                        <>
                            <button
                                type="button"
                                className={`deleted-files-toggle${showDeletedFolders ? ' deleted-files-toggle--active' : ''}`}
                                onClick={() => setShowDeletedFolders((prev) => !prev)}
                            >
                                <ArchiveRestore size={14} />
                                {showDeletedFolders ? 'Hide deleted folders' : 'Show deleted folders'}
                            </button>

                            {showDeletedFolders && (
                                <div className="deleted-files-section repository-list">
                                    {deletedFolders.map((folder) => renderFolderCard(folder))}
                                </div>
                            )}
                        </>
                    )}

                    {!disabled && (
                        <div className="deleted-files-row folder-row">
                            <button
                                type="button"
                                className="folder-row-header"
                                onClick={toggleDeleted}
                            >
                                <div className="folder-row-header-left">
                                    <span className="folder-card-chevron">{showDeleted ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                                    {showDeleted ? <FolderOpen size={16} /> : <Folder size={16} />}
                                    <div className="folder-row-title-group">
                                        <span className="folder-card-title">Deleted files</span>
                                        <span className="folder-card-count">{deletedFiles.length}</span>
                                    </div>
                                </div>
                            </button>

                            {showDeleted && (
                                <div className="deleted-files-section folder-row-body folder-row-body--scrollable">
                                    {deletedLoading ? (
                                        <div className="deleted-files-loading">
                                            <Loader size={16} className="file-status-processing" />
                                            <span>Loading deleted files…</span>
                                        </div>
                                    ) : deletedFiles.length === 0 ? (
                                        <p className="deleted-files-empty">No deleted files found.</p>
                                    ) : (
                                        <div className="file-list file-list--deleted">
                                            {deletedFiles.map((f) => (
                                                <div key={f.id} className="file-item file-item--deleted">
                                                    <div className="file-icon file-icon--deleted"><FileIcon mimeType={f.mimeType} /></div>
                                                    <div className="file-info">
                                                        <div className="file-name-row">
                                                            <span className="file-name file-name--deleted">{f.fileName}</span>
                                                            <span className="file-size">{formatSize(f.fileSize)}</span>
                                                        </div>
                                                        <span className="deleted-file-date">Deleted {formatHistoryDate(f.updatedAt || new Date().toISOString())}</span>
                                                    </div>
                                                    <div className="file-actions">
                                                        <button className="file-restore-btn" title="Restore file" onClick={() => handleRestore(f)} disabled={restoringId === f.id}>
                                                            {restoringId === f.id ? <Loader size={14} className="file-status-processing" /> : <ArchiveRestore size={14} />}
                                                            {restoringId === f.id ? 'Restoring…' : 'Restore'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {confirmDelete && (
                <>
                    <div className="modal-backdrop" onClick={closeDeleteModal} />
                    <div className="modal-container modal-danger">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <div className="modal-icon-danger"><AlertTriangle /></div>
                                <h2 className="modal-title">Delete File</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeDeleteModal} disabled={deleteLoading}><X /></button>
                        </div>
                        <div className="modal-body">
                            {deleteError && <div className="error-message">{deleteError}</div>}
                            <div className="warning-box">
                                <p className="warning-text">You are about to permanently delete:</p>
                                <p className="project-name-highlight">{confirmDelete.name}</p>
                                <p className="warning-text">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeDeleteModal} disabled={deleteLoading}>Cancel</button>
                            <button type="button" className="btn btn-danger" onClick={confirmDeleteFile} disabled={deleteLoading}>{deleteLoading ? 'Deleting…' : 'Delete'}</button>
                        </div>
                    </div>
                </>
            )}

            {historyTarget && (
                <>
                    <div className="modal-backdrop" onClick={closeHistory} />
                    <div className="modal-container">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <History size={18} style={{ color: 'var(--purple-600)' }} />
                                <h2 className="modal-title">Version History</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeHistory}><X /></button>
                        </div>
                        <div className="modal-body">
                            <p className="history-file-name">{historyTarget.name}</p>
                            {historyLoading ? (
                                <div className="history-loading"><Loader size={18} className="file-status-processing" /><span>Loading history…</span></div>
                            ) : historyData.length === 0 ? (
                                <p className="history-empty">No version history found.</p>
                            ) : (
                                <div className="history-list">
                                    {historyData.map((commit, idx) => (
                                        <div key={commit.sha} className="history-item">
                                            <div className="history-item-info">
                                                <span className="history-item-label">{idx === 0 ? 'Current version' : `Version ${historyData.length - idx}`}</span>
                                                <span className="history-item-date">{formatHistoryDate(commit.date)}</span>
                                                <span className="history-item-message">{commit.message}</span>
                                            </div>
                                            <a href={projectFilesAPI.getVersionDownloadUrl(historyTarget.id, commit.sha)} className="file-download-btn" title={idx === 0 ? 'Download current' : 'Download this version'} download>
                                                <Download size={14} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeHistory}>Close</button></div>
                    </div>
                </>
            )}

            {commentTarget && (
                <FileCommentsModal
                    file={commentTarget as any}
                    onClose={closeComments}
                />
            )}

            {folderAction?.type === 'history' && folderAction.folder && (
                <>
                    <div className="modal-backdrop" onClick={closeFolderAction} />
                    <div className="modal-container">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <History size={18} style={{ color: 'var(--purple-600)' }} />
                                <h2 className="modal-title">Folder History</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeFolderAction}><X /></button>
                        </div>
                        <div className="modal-body">
                            <p className="history-file-name">{folderAction.folder.folderName}</p>
                            {folderHistoryLoading ? (
                                <div className="history-loading"><Loader size={18} className="file-status-processing" /><span>Loading history…</span></div>
                            ) : folderHistoryData.length === 0 ? (
                                <p className="history-empty">No folder history found.</p>
                            ) : (
                                <div className="history-list">
                                    {folderHistoryData.map((commit, idx) => (
                                        <div key={commit.sha} className="history-item">
                                            <div className="history-item-info">
                                                <span className="history-item-label">{idx === 0 ? 'Current version' : `Version ${folderHistoryData.length - idx}`}</span>
                                                <span className="history-item-date">{formatHistoryDate(commit.date)}</span>
                                                <span className="history-item-message">{commit.message}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeFolderAction}>Close</button></div>
                    </div>
                </>
            )}

            {folderAction && folderAction.type !== 'history' && (
                <>
                    <div className="modal-backdrop" onClick={closeFolderAction} />
                    <div className={`modal-container ${folderAction.type === 'delete' ? 'modal-danger' : 'modal-info'}`}>
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <div className={folderAction.type === 'delete' ? 'modal-icon-danger' : 'modal-icon-info'}>{folderAction.type === 'delete' ? <Trash2 /> : <ArchiveRestore />}</div>
                                <h2 className="modal-title">{folderAction.type === 'delete' ? 'Delete Folder' : 'Restore Folder'}</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeFolderAction} disabled={folderActionLoading}><X /></button>
                        </div>
                        <div className="modal-body">
                            {folderActionError && <div className="error-message">{folderActionError}</div>}
                            <div className={folderAction.type === 'delete' ? 'warning-box' : 'info-box'}>
                                <p className="warning-text">{folderAction.type === 'delete' ? 'You are about to delete the folder:' : 'You are about to restore the folder:'}</p>
                                <p className="project-name-highlight">{folderAction.folder.folderName}</p>
                                <p className="warning-text">{folderAction.type === 'delete' ? 'The folder marker will be removed, but the files and history will remain restorable.' : 'The folder marker will be recreated and the folder will return to the active list.'}</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeFolderAction} disabled={folderActionLoading}>Cancel</button>
                            <button type="button" className={`btn ${folderAction.type === 'delete' ? 'btn-danger' : 'btn-info'}`} onClick={confirmFolderAction} disabled={folderActionLoading}>
                                {folderActionLoading ? (folderAction.type === 'delete' ? 'Deleting…' : 'Restoring…') : (folderAction.type === 'delete' ? 'Delete' : 'Restore')}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {folderCreateOpen && (
                <>
                    <div className="modal-backdrop" onClick={closeCreateFolder} />
                    <div className="modal-container folder-basic-modal">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <h2 className="modal-title">Create Folder</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeCreateFolder} disabled={folderCreateLoading}><X /></button>
                        </div>
                        <div className="modal-body">
                            {folderCreateError && <div className="error-message">{folderCreateError}</div>}
                            <label className="form-label" htmlFor="folder-name-input">Folder name</label>
                            <input id="folder-name-input" className="form-input" value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !folderCreateLoading && confirmCreateFolder()} autoFocus />
                            <p className="form-hint" style={{ marginTop: '1rem' }}>A .gitkeep marker will be created automatically so the folder exists even when empty.</p>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeCreateFolder} disabled={folderCreateLoading}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={confirmCreateFolder} disabled={folderCreateLoading || !folderName.trim()}>{folderCreateLoading ? 'Creating…' : 'Create folder'}</button>
                        </div>
                    </div>
                </>
            )}

            {renameTarget && (
                <>
                    <div className="modal-backdrop" onClick={closeRename} />
                    <div className="modal-container folder-basic-modal">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <h2 className="modal-title">Rename {renameTarget.kind === 'folder' ? 'Folder' : 'File'}</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeRename} disabled={renameLoading}><X /></button>
                        </div>
                        <div className="modal-body">
                            {renameError && <div className="error-message">{renameError}</div>}
                            <label className="form-label" htmlFor="rename-input">New {renameTarget.kind === 'folder' ? 'folder' : 'file'} name</label>
                            <input id="rename-input" type="text" className="form-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !renameLoading && handleRename()} disabled={renameLoading} autoFocus />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeRename} disabled={renameLoading}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleRename} disabled={renameLoading || !renameValue.trim()}>{renameLoading ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </>
            )}

            {duplicateConfirm && (
                <>
                    <div className="modal-backdrop" onClick={closeDuplicateConfirm} />
                    <div className="modal-container modal-danger">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <div className="modal-icon-danger"><AlertTriangle /></div>
                                <h2 className="modal-title">File Already Exists</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeDuplicateConfirm}><X /></button>
                        </div>
                        <div className="modal-body">
                            <div className="warning-box">
                                <p className="warning-text">A file named</p>
                                <p className="project-name-highlight">{duplicateConfirm.file.name}</p>
                                <p className="warning-text">already exists in this folder. Uploading will replace the existing file.</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeDuplicateConfirm}>Cancel</button>
                            <button type="button" className="btn btn-danger" onClick={confirmDuplicateReplace}>Replace</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
