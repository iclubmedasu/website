'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent,
    type RefObject,
} from 'react';
import { AlertTriangle, Loader, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { CLUB_TIMEZONE } from '@iclub/shared/utils';
import Toggle from '@/components/toggle/Toggle';
import { eventPhotosAPI, getAuthToken } from '@/services/api';
import type { EventPhotoRef, Id } from '@/types/backend-contracts';
import { useEventPhotos } from '../../hooks/useEventPhotos';
import { formatAttendanceDayLabel, getEventDayRange } from '../eventDateUtils';
import './EventPhotosSection.css';

const ACCEPTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
]);

export interface EventPhotosSectionProps {
    eventId: Id | string;
    eventDate?: string | null;
    eventEndDate?: string | null;
    timezone?: string | null;
    memberId?: Id | string | null;
    disabled?: boolean;
}

type PhotoUploadEntry = {
    id: string;
    file: File;
    previewUrl: string;
    progress: number;
    processing: boolean;
    failed: boolean;
    eventDay: string | null;
    caption: string;
};

type DisplayGroup = {
    eventDay: string | null;
    photos: EventPhotoRef[];
    uploads: PhotoUploadEntry[];
};

let _uid = 0;
function uid() {
    return `photo_upload_${Date.now()}_${++_uid}`;
}

function addCalendarDay(day: string): string {
    const parsed = new Date(`${day}T12:00:00`);
    parsed.setDate(parsed.getDate() + 1);
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function enumerateEventDays(
    eventDate?: string | null,
    eventEndDate?: string | null,
    timezone: string = CLUB_TIMEZONE,
): string[] {
    const range = getEventDayRange(eventDate, eventEndDate, timezone);
    if (!range) return [];

    const days: string[] = [];
    let cursor = range.startDay;
    let guard = 0;
    while (cursor <= range.endDay && guard < 366) {
        days.push(cursor);
        cursor = addCalendarDay(cursor);
        guard += 1;
    }
    return days;
}

function dayHeading(eventDay: string | null, dayIndexByKey: Map<string, number>): string {
    if (!eventDay) return 'Undated';
    const index = dayIndexByKey.get(eventDay);
    const label = formatAttendanceDayLabel(eventDay);
    if (index == null) return label;
    return `Day ${index} — ${label}`;
}

function photoThumbUrl(photoId: Id | string): string {
    const token = getAuthToken();
    const base = eventPhotosAPI.getDownloadUrl(photoId);
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error) || !error.message) return fallback;
    const message = error.message.trim();
    // Never surface raw GitHub API JSON (e.g. documentation_url) to the UI.
    if (
        message.includes('documentation_url') ||
        (message.startsWith('{') && message.includes('"message"'))
    ) {
        return fallback;
    }
    return message;
}

function revokePreview(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

function dayGroupKey(eventDay: string | null): string {
    return eventDay ?? 'undated';
}

function readCssGridColumnCount(element: HTMLElement): number {
    const template = getComputedStyle(element).gridTemplateColumns;
    if (!template || template === 'none') return 1;
    const count = template.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, count);
}

function useCssGridColumnCount(ref: RefObject<HTMLElement | null>): number {
    const [columns, setColumns] = useState(1);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return undefined;

        const update = () => {
            setColumns(readCssGridColumnCount(element));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    return columns;
}

interface EventPhotosDayGroupProps {
    group: DisplayGroup;
    dayIndexByKey: Map<string, number>;
    disabled: boolean;
    expanded: boolean;
    onToggleExpanded: () => void;
    togglingId: Id | string | null;
    onRetry: (entry: PhotoUploadEntry) => void;
    onRemoveUpload: (id: string) => void;
    onDeletePhoto: (photo: EventPhotoRef) => void;
    onTogglePublic: (photo: EventPhotoRef, next: boolean) => void;
}

function EventPhotosDayGroup({
    group,
    dayIndexByKey,
    disabled,
    expanded,
    onToggleExpanded,
    togglingId,
    onRetry,
    onRemoveUpload,
    onDeletePhoto,
    onTogglePublic,
}: EventPhotosDayGroupProps) {
    const gridRef = useRef<HTMLDivElement>(null);
    const columns = useCssGridColumnCount(gridRef);
    const totalItems = group.uploads.length + group.photos.length;
    const showToggle = totalItems > columns;
    const collapsed = showToggle && !expanded;
    const visibleUploads = collapsed ? group.uploads.slice(0, columns) : group.uploads;
    const visiblePhotos = collapsed
        ? group.photos.slice(0, Math.max(0, columns - group.uploads.length))
        : group.photos;

    return (
        <div className="event-photos-day-group">
            <h4 className="event-photos-day-heading">
                {dayHeading(group.eventDay, dayIndexByKey)}
            </h4>
            <div ref={gridRef} className="event-photos-grid">
                {visibleUploads.map((entry) => (
                    <div key={entry.id} className="event-photo-card event-photo-card--uploading">
                        <div className="event-photo-thumb-wrap">
                            {/* Local object-URL preview while uploading. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="event-photo-thumb event-photo-thumb--dimmed"
                                src={entry.previewUrl}
                                alt={entry.file.name}
                            />
                            <div className="event-photo-upload-overlay">
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
                                    <div className="event-photo-upload-failed">
                                        <span className="file-status-failed">Failed</span>
                                        <button
                                            type="button"
                                            className="file-retry-btn"
                                            title="Retry"
                                            aria-label={`Retry uploading ${entry.file.name}`}
                                            onClick={() => onRetry(entry)}
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {entry.failed && (
                                <button
                                    type="button"
                                    className="event-photo-delete-btn"
                                    title="Remove"
                                    aria-label={`Remove failed upload ${entry.file.name}`}
                                    onClick={() => onRemoveUpload(entry.id)}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <p className="event-photo-filename" title={entry.file.name}>{entry.file.name}</p>
                    </div>
                ))}
                {visiblePhotos.map((photo) => (
                    <div key={photo.id} className="event-photo-card">
                        <div className="event-photo-thumb-wrap">
                            {/* Auth download via query token (same pattern as file downloads). */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="event-photo-thumb"
                                src={photoThumbUrl(photo.id)}
                                alt={photo.caption?.trim() || photo.fileName}
                                loading="lazy"
                            />
                            {!disabled && (
                                <button
                                    type="button"
                                    className="event-photo-delete-btn"
                                    title="Delete photo"
                                    aria-label={`Delete ${photo.fileName}`}
                                    onClick={() => onDeletePhoto(photo)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                        {photo.caption?.trim() ? (
                            <p className="event-photo-caption">{photo.caption}</p>
                        ) : (
                            <p className="event-photo-filename" title={photo.fileName}>{photo.fileName}</p>
                        )}
                        <div className="event-photo-public-toggle" title="Show on public event page">
                            <span className="event-photo-public-toggle-label">Public</span>
                            <Toggle
                                color="purple"
                                checked={Boolean(photo.showOnPublic)}
                                disabled={disabled || togglingId === photo.id}
                                onChange={(next) => void onTogglePublic(photo, next)}
                                aria-label={`Show ${photo.fileName} on public event page`}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {showToggle ? (
                <button
                    type="button"
                    className="event-photos-see-more"
                    onClick={onToggleExpanded}
                    aria-expanded={expanded}
                >
                    {expanded ? 'See less' : 'See more'}
                </button>
            ) : null}
        </div>
    );
}

export default function EventPhotosSection({
    eventId,
    eventDate,
    eventEndDate,
    timezone,
    memberId,
    disabled = false,
}: EventPhotosSectionProps) {
    const eventTimezone = timezone?.trim() || CLUB_TIMEZONE;
    const { photos, loading, error, uploadPhoto, updatePhoto, deletePhoto } = useEventPhotos(eventId);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const uploadQueueRef = useRef<PhotoUploadEntry[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [selectedDay, setSelectedDay] = useState('');
    const [caption, setCaption] = useState('');
    const [uploadQueue, setUploadQueue] = useState<PhotoUploadEntry[]>([]);
    const [uploadError, setUploadError] = useState('');
    const [togglingId, setTogglingId] = useState<Id | string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<EventPhotoRef | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());

    uploadQueueRef.current = uploadQueue;

    const toggleDayExpanded = useCallback((key: string) => {
        setExpandedDays((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    useEffect(() => {
        return () => {
            uploadQueueRef.current.forEach((entry) => revokePreview(entry.previewUrl));
        };
    }, []);

    const eventDays = useMemo(
        () => enumerateEventDays(eventDate, eventEndDate, eventTimezone),
        [eventDate, eventEndDate, eventTimezone],
    );

    const dayIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        eventDays.forEach((day, index) => map.set(day, index + 1));
        return map;
    }, [eventDays]);

    const uploading = uploadQueue.some((entry) => !entry.failed);
    const totalPhotos = photos.reduce((sum, group) => sum + group.photos.length, 0);

    const displayGroups = useMemo((): DisplayGroup[] => {
        const groups: DisplayGroup[] = photos.map((group) => ({
            eventDay: group.eventDay,
            photos: group.photos,
            uploads: [],
        }));
        const indexByDay = new Map<string | null, number>();
        groups.forEach((group, index) => indexByDay.set(group.eventDay, index));

        for (const entry of uploadQueue) {
            let index = indexByDay.get(entry.eventDay);
            if (index === undefined) {
                index = groups.length;
                indexByDay.set(entry.eventDay, index);
                groups.push({ eventDay: entry.eventDay, photos: [], uploads: [] });
            }
            groups[index].uploads.push(entry);
        }

        return groups;
    }, [photos, uploadQueue]);

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
            formData.append('eventId', String(eventId));
            formData.append('uploadedByMemberId', String(memberId));
            if (entry.eventDay) formData.append('eventDay', entry.eventDay);
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
    }, [eventId, memberId, removeUpload, updateUpload, uploadPhoto]);

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
        const eventDay = selectedDay || null;
        const entries: PhotoUploadEntry[] = files.map((file) => ({
            id: uid(),
            file,
            previewUrl: URL.createObjectURL(file),
            progress: 0,
            processing: false,
            failed: false,
            eventDay,
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

    const handleTogglePublic = async (photo: EventPhotoRef, next: boolean) => {
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
        <div className="event-photos-section">
            {!disabled && (
                <div className="event-photos-upload-meta">
                    <div className="event-photos-field">
                        <label className="form-label" htmlFor={`event-photo-day-${eventId}`}>Day</label>
                        <select
                            id={`event-photo-day-${eventId}`}
                            className="form-input"
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            disabled={uploading}
                        >
                            <option value="">No specific day</option>
                            {eventDays.map((day, index) => (
                                <option key={day} value={day}>
                                    {`Day ${index + 1} — ${formatAttendanceDayLabel(day)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="event-photos-field">
                        <label className="form-label" htmlFor={`event-photo-caption-${eventId}`}>Caption (optional)</label>
                        <input
                            id={`event-photo-caption-${eventId}`}
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
                <p className="event-photos-status">Loading photos…</p>
            ) : null}
            {error ? <p className="event-photos-status event-photos-status--error">{error}</p> : null}
            {!loading && !error && totalPhotos === 0 && uploadQueue.length === 0 ? (
                <p className="event-photos-empty">No photos uploaded yet.</p>
            ) : null}

            {(!loading || uploadQueue.length > 0) && displayGroups.map((group) => (
                <EventPhotosDayGroup
                    key={dayGroupKey(group.eventDay)}
                    group={group}
                    dayIndexByKey={dayIndexByKey}
                    disabled={disabled}
                    expanded={expandedDays.has(dayGroupKey(group.eventDay))}
                    onToggleExpanded={() => toggleDayExpanded(dayGroupKey(group.eventDay))}
                    togglingId={togglingId}
                    onRetry={handleRetry}
                    onRemoveUpload={removeUpload}
                    onDeletePhoto={setConfirmDelete}
                    onTogglePublic={handleTogglePublic}
                />
            ))}

            {uploadError ? <p className="event-photos-status event-photos-status--error">{uploadError}</p> : null}

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
