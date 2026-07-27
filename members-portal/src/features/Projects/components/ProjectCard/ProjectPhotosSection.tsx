'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent,
    type RefObject,
} from 'react';
import { AlertTriangle, Loader, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import Toggle from '@/components/toggle/Toggle';
import { apiFetch, projectPhotosAPI } from '@/services/api';
import type { Id, ProjectPhotoRef } from '@/types/backend-contracts';
import { useProjectPhotos } from '../../hooks/useProjectPhotos';
import './ProjectPhotosSection.css';

const ACCEPTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
]);

export interface ProjectPhotosSectionProps {
    projectId: Id | string;
    memberId?: Id | string | null;
    /** Viewers may manage photos; disable only when the user cannot act. */
    disabled?: boolean;
}

type PhotoUploadEntry = {
    id: string;
    file: File;
    previewUrl: string;
    progress: number;
    processing: boolean;
    failed: boolean;
    caption: string;
};

let _uid = 0;
function uid() {
    return `project_photo_upload_${Date.now()}_${++_uid}`;
}

/** Fetch photo with Authorization and expose a blob object URL (revoked on change/unmount). */
function useAuthorizedPhotoThumb(photoId: Id | string): string | null {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let createdUrl: string | null = null;
        setObjectUrl(null);

        void (async () => {
            try {
                const response = await apiFetch(projectPhotosAPI.getDownloadUrl(photoId));
                if (!response.ok || cancelled) return;
                const blob = await response.blob();
                if (cancelled) return;
                createdUrl = URL.createObjectURL(blob);
                setObjectUrl(createdUrl);
            } catch {
                // Leave thumb empty on fetch failure (avoids broken-image icon).
            }
        })();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [photoId]);

    return objectUrl;
}

function AuthorizedProjectPhotoThumb({
    photoId,
    alt,
}: {
    photoId: Id | string;
    alt: string;
}) {
    const thumbUrl = useAuthorizedPhotoThumb(photoId);
    if (!thumbUrl) {
        return <div className="project-photo-thumb project-photo-thumb--dimmed" aria-hidden />;
    }
    /* Auth via apiFetch Authorization header → blob URL. */
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img className="project-photo-thumb" src={thumbUrl} alt={alt} loading="lazy" />;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error) || !error.message) return fallback;
    const message = error.message.trim();
    // Never surface raw GitHub API JSON (e.g. documentation_url) to the UI.
    if (
        message.includes('documentation_url')
        || (message.startsWith('{') && message.includes('"message"'))
    ) {
        return fallback;
    }
    return message;
}

function revokePreview(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

/** Matches `.project-photos-grid { grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)) }`. */
const PHOTO_GRID_MIN_COL_REM = 9.5;

function readWidthBasedColumnCount(element: HTMLElement): number {
    const width = element.clientWidth;
    if (width <= 0) return 1;
    const style = getComputedStyle(element);
    const gapRaw = style.columnGap || style.gap || '0';
    const gap = Number.parseFloat(gapRaw) || 0;
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const minColPx = PHOTO_GRID_MIN_COL_REM * rootFontSize;
    return Math.max(1, Math.floor((width + gap) / (minColPx + gap)));
}

function useCssGridColumnCount(
    ref: RefObject<HTMLElement | null>,
    remountKey: number,
): number {
    const [columns, setColumns] = useState(1);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return undefined;

        const update = () => {
            setColumns(readWidthBasedColumnCount(element));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, remountKey]);

    return columns;
}

export default function ProjectPhotosSection({
    projectId,
    memberId,
    disabled = false,
}: ProjectPhotosSectionProps) {
    const { photos, loading, error, uploadPhoto, updatePhoto, deletePhoto } = useProjectPhotos(projectId);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const uploadQueueRef = useRef<PhotoUploadEntry[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [caption, setCaption] = useState('');
    const [uploadQueue, setUploadQueue] = useState<PhotoUploadEntry[]>([]);
    const [uploadError, setUploadError] = useState('');
    const [togglingId, setTogglingId] = useState<Id | string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<ProjectPhotoRef | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [expanded, setExpanded] = useState(false);

    const columns = useCssGridColumnCount(gridRef, photos.length + uploadQueue.length);
    uploadQueueRef.current = uploadQueue;

    useEffect(() => {
        return () => {
            uploadQueueRef.current.forEach((entry) => revokePreview(entry.previewUrl));
        };
    }, []);

    const uploading = uploadQueue.some((entry) => !entry.failed);
    const totalItems = uploadQueue.length + photos.length;
    const showToggle = totalItems > columns;
    const collapsed = showToggle && !expanded;
    const visibleUploads = collapsed ? uploadQueue.slice(0, columns) : uploadQueue;
    const visiblePhotos = collapsed
        ? photos.slice(0, Math.max(0, columns - uploadQueue.length))
        : photos;

    const updateUpload = useCallback((id: string, updates: Partial<PhotoUploadEntry>) => {
        setUploadQueue((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)));
    }, []);

    const removeUpload = useCallback((id: string) => {
        setUploadQueue((prev) => {
            const target = prev.find((entry) => entry.id === id);
            if (target) revokePreview(target.previewUrl);
            return prev.filter((entry) => entry.id !== id);
        });
    }, []);

    const doUpload = useCallback(async (entry: PhotoUploadEntry) => {
        if (!memberId) return;
        try {
            const formData = new FormData();
            formData.append('photo', entry.file);
            formData.append('projectId', String(projectId));
            formData.append('uploadedByMemberId', String(memberId));
            if (entry.caption) formData.append('caption', entry.caption);

            await uploadPhoto(formData, (progress) => {
                if (progress >= 100) {
                    updateUpload(entry.id, { progress: 100, processing: true });
                } else {
                    updateUpload(entry.id, { progress });
                }
            });
            removeUpload(entry.id);
        } catch (err: unknown) {
            updateUpload(entry.id, { failed: true, processing: false });
            setUploadError(getErrorMessage(err, 'Failed to upload photo. Please try again.'));
        }
    }, [memberId, projectId, removeUpload, updateUpload, uploadPhoto]);

    const processFiles = (fileList: FileList | File[]) => {
        if (disabled || !memberId) return;
        const files = Array.from(fileList).filter((file) => {
            if (ACCEPTED_IMAGE_TYPES.has(file.type)) return true;
            const lower = file.name.toLowerCase();
            return lower.endsWith('.heic') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')
                || lower.endsWith('.png') || lower.endsWith('.webp');
        });
        if (files.length === 0) {
            setUploadError('Only JPEG, PNG, WebP, and HEIC images are allowed.');
            return;
        }

        setUploadError('');
        const trimmedCaption = caption.trim();
        const entries: PhotoUploadEntry[] = files.map((file) => ({
            id: uid(),
            file,
            previewUrl: URL.createObjectURL(file),
            progress: 0,
            processing: false,
            failed: false,
            caption: trimmedCaption,
        }));

        setUploadQueue((prev) => [...prev, ...entries]);
        if (trimmedCaption) setCaption('');
        entries.forEach((entry) => {
            void doUpload(entry);
        });
    };

    const handleRetry = (entry: PhotoUploadEntry) => {
        setUploadError('');
        updateUpload(entry.id, { progress: 0, failed: false, processing: false });
        void doUpload({ ...entry, progress: 0, failed: false, processing: false });
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) processFiles(e.target.files);
        e.target.value = '';
    };

    const handleTogglePublic = async (photo: ProjectPhotoRef, next: boolean) => {
        if (disabled) return;
        setTogglingId(photo.id);
        try {
            await updatePhoto(photo.id, { showOnPublic: next });
        } catch (err: unknown) {
            setUploadError(getErrorMessage(err, 'Failed to update photo visibility.'));
        } finally {
            setTogglingId(null);
        }
    };

    const handleToggleCore = async (photo: ProjectPhotoRef, next: boolean) => {
        if (disabled) return;
        setTogglingId(photo.id);
        try {
            await updatePhoto(photo.id, { isCore: next });
        } catch (err: unknown) {
            setUploadError(getErrorMessage(err, 'Failed to update core photo.'));
        } finally {
            setTogglingId(null);
        }
    };

    const coreCount = photos.filter((p) => p.isCore && p.isActive !== false).length;

    const closeDeleteModal = () => {
        setConfirmDelete(null);
        setDeleteLoading(false);
        setDeleteError('');
    };

    const confirmDeletePhoto = async () => {
        if (!confirmDelete) return;
        setDeleteLoading(true);
        setDeleteError('');
        try {
            await deletePhoto(confirmDelete.id);
            closeDeleteModal();
        } catch (err: unknown) {
            setDeleteError(getErrorMessage(err, 'Failed to delete photo. Please try again.'));
            setDeleteLoading(false);
        }
    };

    return (
        <div className="project-photos-section">
            {!disabled && (
                <div className="project-photos-upload-meta">
                    <div className="project-photos-field">
                        <label className="form-label" htmlFor={`project-photo-caption-${projectId}`}>Caption (optional)</label>
                        <input
                            id={`project-photo-caption-${projectId}`}
                            className="form-input"
                            type="text"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            disabled={uploading}
                            placeholder="Short caption"
                        />
                    </div>
                </div>
            )}

            <div
                className={`file-drop-area${dragOver ? ' file-drop-area--active' : ''}${disabled ? ' file-drop-area--disabled' : ''}`}
                onClick={() => !disabled && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => e.key === 'Enter' && !disabled && fileInputRef.current?.click()}
            >
                <Upload size={24} className="file-drop-icon" />
                <span className="file-drop-text">
                    {uploading ? 'Uploading…' : 'Drag & drop photos here or click to browse'}
                </span>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic"
                multiple
                className="file-input-hidden"
                onChange={handleFileInput}
                disabled={disabled || uploading}
                aria-label="Select photos to upload"
                title="Select photos to upload"
            />
            <p className="file-drop-hint">Supported: JPEG, PNG, WebP, HEIC — Max 10 MB per photo</p>

            {loading && uploadQueue.length === 0 ? (
                <p className="project-photos-status">Loading photos…</p>
            ) : null}
            {error ? <p className="project-photos-status project-photos-status--error">{error}</p> : null}
            {!loading && !error && photos.length === 0 && uploadQueue.length === 0 ? (
                <p className="project-photos-empty">No photos uploaded yet.</p>
            ) : null}

            {(!loading || uploadQueue.length > 0) && totalItems > 0 ? (
                <>
                    <div ref={gridRef} className="project-photos-grid">
                        {visibleUploads.map((entry) => (
                            <div key={entry.id} className="project-photo-card project-photo-card--uploading">
                                <div className="project-photo-thumb-wrap">
                                    {/* Local object-URL preview while uploading. */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        className="project-photo-thumb project-photo-thumb--dimmed"
                                        src={entry.previewUrl}
                                        alt={entry.file.name}
                                    />
                                    <div className="project-photo-upload-overlay">
                                        {!entry.failed && !entry.processing && (
                                            <>
                                                <progress
                                                    className="file-progress"
                                                    max={100}
                                                    value={entry.progress}
                                                />
                                                <span className="file-status-uploading">{entry.progress}%</span>
                                            </>
                                        )}
                                        {entry.processing && (
                                            <>
                                                <div className="file-progress-bar-track">
                                                    <div className="file-progress-bar-fill file-progress-bar-fill--processing" />
                                                </div>
                                                <span className="file-status-processing"><Loader size={14} /></span>
                                            </>
                                        )}
                                        {entry.failed && (
                                            <div className="project-photo-upload-failed">
                                                <span className="file-status-failed">Failed</span>
                                                <button
                                                    type="button"
                                                    className="file-retry-btn"
                                                    title="Retry"
                                                    aria-label={`Retry uploading ${entry.file.name}`}
                                                    onClick={() => handleRetry(entry)}
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {entry.failed && (
                                        <button
                                            type="button"
                                            className="project-photo-delete-btn"
                                            title="Remove"
                                            aria-label={`Remove failed upload ${entry.file.name}`}
                                            onClick={() => removeUpload(entry.id)}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <p className="project-photo-filename" title={entry.file.name}>{entry.file.name}</p>
                            </div>
                        ))}
                        {visiblePhotos.map((photo) => (
                            <div key={photo.id} className="project-photo-card">
                                <div className="project-photo-thumb-wrap">
                                    <AuthorizedProjectPhotoThumb
                                        photoId={photo.id}
                                        alt={photo.caption?.trim() || photo.fileName}
                                    />
                                    {!disabled && (
                                        <button
                                            type="button"
                                            className="project-photo-delete-btn"
                                            title="Delete photo"
                                            aria-label={`Delete ${photo.fileName}`}
                                            onClick={() => setConfirmDelete(photo)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                {photo.caption?.trim() ? (
                                    <p className="project-photo-caption">{photo.caption}</p>
                                ) : (
                                    <p className="project-photo-filename" title={photo.fileName}>{photo.fileName}</p>
                                )}
                                <div className="project-photo-toggles">
                                    <div className="project-photo-public-toggle" title="Show on public project page">
                                        <span className="project-photo-public-toggle-label">Public</span>
                                        <Toggle
                                            color="purple"
                                            checked={Boolean(photo.showOnPublic)}
                                            disabled={disabled || togglingId === photo.id}
                                            onChange={(next) => void handleTogglePublic(photo, next)}
                                            aria-label={`Show ${photo.fileName} on public project page`}
                                        />
                                    </div>
                                    <div
                                        className="project-photo-public-toggle"
                                        title="Prefer on home Highlights (fills randomly if fewer than 10)"
                                    >
                                        <span className="project-photo-public-toggle-label">Core</span>
                                        <Toggle
                                            color="purple"
                                            checked={Boolean(photo.isCore)}
                                            disabled={
                                                disabled
                                                || togglingId === photo.id
                                                || (!photo.isCore && coreCount >= 10)
                                            }
                                            onChange={(next) => void handleToggleCore(photo, next)}
                                            aria-label={`Prefer ${photo.fileName} on home Highlights`}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {showToggle ? (
                        <button
                            type="button"
                            className="project-photos-see-more"
                            onClick={() => setExpanded((prev) => !prev)}
                            aria-expanded={expanded}
                        >
                            {expanded ? 'See less' : 'See more'}
                        </button>
                    ) : null}
                </>
            ) : null}

            {uploadError ? <p className="project-photos-status project-photos-status--error">{uploadError}</p> : null}

            {confirmDelete && (
                <>
                    <div className="modal-backdrop" onClick={closeDeleteModal} />
                    <div className="modal-container modal-danger">
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <div className="modal-icon-danger"><AlertTriangle /></div>
                                <h2 className="modal-title">Delete Photo</h2>
                            </div>
                            <button
                                className="modal-close-btn"
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={deleteLoading}
                                aria-label="Close delete photo modal"
                                title="Close"
                            >
                                <X />
                            </button>
                        </div>
                        <div className="modal-body">
                            {deleteError && <div className="error-message">{deleteError}</div>}
                            <div className="warning-box">
                                <p className="warning-text">You are about to permanently delete:</p>
                                <p className="project-name-highlight">{confirmDelete.fileName}</p>
                                <p className="warning-text">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeDeleteModal} disabled={deleteLoading}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => void confirmDeletePhoto()} disabled={deleteLoading}>
                                {deleteLoading ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
