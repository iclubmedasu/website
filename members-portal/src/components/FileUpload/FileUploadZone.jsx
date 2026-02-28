import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Image, File, Upload, Check, X, RotateCcw, Trash2, Loader, Download, AlertTriangle, History } from 'lucide-react';
import { projectFilesAPI } from '../../services/api';
import '../../components/modal/modal.css';
import './FileUploadZone.css';

/** Human-readable file size */
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pick an icon based on MIME type */
function FileIcon({ mimeType }) {
    if (mimeType?.startsWith('image/')) return <Image size={18} />;
    if (mimeType === 'application/pdf') return <FileText size={18} />;
    return <File size={18} />;
}

let _uid = 0;
function uid() { return `upload_${Date.now()}_${++_uid}`; }

export default function FileUploadZone({ projectId, memberId, onFileUploaded, onFileRemoved, existingFiles = [], disabled }) {
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // file entry pending deletion
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [historyTarget, setHistoryTarget] = useState(null); // file entry whose history is shown
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Sync existing files on mount / when existingFiles changes
    useEffect(() => {
        const existing = existingFiles.map((f) => ({
            id: f.id,
            name: f.fileName,
            size: f.fileSize,
            mimeType: f.mimeType,
            progress: 100,
            processing: false,
            failed: false,
            done: true,
            fileObj: null,
        }));
        setUploadingFiles(existing);
    }, [existingFiles]);

    const updateFile = useCallback((id, updates) => {
        setUploadingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    }, []);

    const doUpload = useCallback(async (entry) => {
        try {
            const result = await projectFilesAPI.upload(
                projectId,
                memberId,
                entry.fileObj,
                (progress) => {
                    if (progress >= 100) {
                        // Upload to our server is done, now GitHub API is processing
                        updateFile(entry.id, { progress: 100, processing: true });
                    } else {
                        updateFile(entry.id, { progress });
                    }
                }
            );
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
        } catch (err) {
            console.error('Upload failed:', err);
            updateFile(entry.id, { failed: true, processing: false });
        }
    }, [projectId, memberId, onFileUploaded, updateFile]);

    const processFiles = useCallback((fileList) => {
        if (disabled) return;
        const files = Array.from(fileList);
        files.forEach((file) => {
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
            };
            setUploadingFiles((prev) => [...prev, entry]);
            doUpload(entry);
        });
    }, [disabled, doUpload]);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleFileInput = (e) => {
        if (e.target.files?.length) processFiles(e.target.files);
        e.target.value = ''; // reset so the same file can be selected again
    };

    const requestDelete = (fileEntry) => {
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
        } catch (err) {
            console.error('Delete failed:', err);
            setDeleteError(err.message || 'Failed to delete file. Please try again.');
            setDeleteLoading(false);
        }
    };

    const handleRetry = (entry) => {
        if (!entry.fileObj) return;
        updateFile(entry.id, { progress: 0, failed: false, processing: false, done: false });
        doUpload(entry);
    };

    const openHistory = async (fileEntry) => {
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

    const formatHistoryDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="file-upload-zone">
            {/* Drop area */}
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
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileInput}
                    disabled={disabled}
                />
            </div>
            <p className="file-drop-hint">Supported: Images, PDF, Word, Excel, CSV — Max 25 MB per file</p>

            {/* File list */}
            {uploadingFiles.length > 0 && (
                <div className="file-list">
                    {uploadingFiles.map((f) => {
                        const downloadUrl = f.done ? projectFilesAPI.getDownloadUrl(f.id) : null;
                        return (
                            <div key={f.id} className="file-item">
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
                                    {/* Progress bar (hidden when complete or processing) */}
                                    {!f.done && !f.processing && (
                                        <div className="file-progress-bar-track">
                                            <div
                                                className={`file-progress-bar-fill${f.failed ? ' file-progress-bar-fill--failed' : ''}`}
                                                style={{ width: `${f.progress}%` }}
                                            />
                                        </div>
                                    )}
                                    {/* Processing shimmer bar */}
                                    {f.processing && (
                                        <div className="file-progress-bar-track">
                                            <div className="file-progress-bar-fill file-progress-bar-fill--processing" style={{ width: '100%' }} />
                                        </div>
                                    )}
                                </div>
                                <div className="file-actions">
                                    {f.done && <span className="file-status-done"><Check size={16} /></span>}
                                    {f.processing && (
                                        <span className="file-status-processing"><Loader size={14} /></span>
                                    )}
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
                                    {f.done && downloadUrl && (
                                        <button
                                            className="file-history-btn"
                                            title="Version history"
                                            onClick={() => openHistory(f)}
                                        >
                                            <History size={14} />
                                        </button>
                                    )}
                                    {f.done && downloadUrl && (
                                        <a
                                            href={downloadUrl}
                                            className="file-download-btn"
                                            title="Download"
                                            download
                                        >
                                            <Download size={14} />
                                        </a>
                                    )}
                                    {!disabled && (
                                        <button
                                            className="file-delete-btn"
                                            title="Remove"
                                            onClick={() => requestDelete(f)}
                                        >
                                            {f.done ? <Trash2 size={14} /> : <X size={14} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Delete confirmation modal */}
            {confirmDelete && (
                <>
                    <div className="modal-backdrop" onClick={closeDeleteModal} />
                    <div className="modal-container modal-danger">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <div className="modal-icon-danger">
                                    <AlertTriangle />
                                </div>
                                <h2 className="modal-title">Delete File</h2>
                            </div>
                            <button
                                className="modal-close-btn"
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={deleteLoading}
                            >
                                <X />
                            </button>
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
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={closeDeleteModal}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={confirmDeleteFile}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </>
            )}
            {/* History modal */}
            {historyTarget && (
                <>
                    <div className="modal-backdrop" onClick={closeHistory} />
                    <div className="modal-container">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <History size={18} style={{ color: 'var(--purple-600)' }} />
                                <h2 className="modal-title">Version History</h2>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={closeHistory}>
                                <X />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="history-file-name">{historyTarget.name}</p>
                            {historyLoading ? (
                                <div className="history-loading">
                                    <Loader size={18} className="file-status-processing" />
                                    <span>Loading history…</span>
                                </div>
                            ) : historyData.length === 0 ? (
                                <p className="history-empty">No version history found.</p>
                            ) : (
                                <div className="history-list">
                                    {historyData.map((commit, idx) => (
                                        <div key={commit.sha} className="history-item">
                                            <div className="history-item-info">
                                                <span className="history-item-label">
                                                    {idx === 0 ? 'Current version' : `Version ${historyData.length - idx}`}
                                                </span>
                                                <span className="history-item-date">{formatHistoryDate(commit.date)}</span>
                                                <span className="history-item-message">{commit.message}</span>
                                            </div>
                                            <a
                                                href={projectFilesAPI.getVersionDownloadUrl(historyTarget.id, commit.sha)}
                                                className="file-download-btn"
                                                title={idx === 0 ? 'Download current' : 'Download this version'}
                                                download
                                            >
                                                <Download size={14} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeHistory}>
                                Close
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
