'use client';
import {
    useState,
    useRef,
    useEffect,
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent,
} from 'react';
import { Upload, X } from 'lucide-react';
import { membersAPI } from '@/services/api';
import '@/components/modal/modal.css';
import './UploadPhotoModal.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

interface UploadPhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberId: number | string;
    currentPhotoUrl?: string | null;
    onSuccess: (photoUrl: string | null) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function UploadPhotoModal({
    isOpen,
    onClose,
    memberId,
    currentPhotoUrl,
    onSuccess,
}: UploadPhotoModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!selectedFile) {
            setPreview(null);
            return;
        }

        const url = URL.createObjectURL(selectedFile);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedFile(null);
            setPreview(null);
            setError('');
            setUploading(false);
            setDeleting(false);
            setDragActive(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const validateFile = (file: File): boolean => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError('Only JPEG, PNG, or WebP images are allowed.');
            return false;
        }
        if (file.size > MAX_SIZE) {
            setError('File must be under 5 MB.');
            return false;
        }
        return true;
    };

    const handleFileSelect = (file: File | null): void => {
        setError('');
        if (file && validateFile(file)) {
            setSelectedFile(file);
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0] ?? null;
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0] ?? null;
        if (file) handleFileSelect(file);
    };

    const handleUpload = async (): Promise<void> => {
        if (!selectedFile || uploading) return;
        setUploading(true);
        setError('');
        try {
            const result = (await membersAPI.uploadProfilePhoto(memberId, selectedFile)) as {
                profilePhotoUrl?: string | null;
            };
            onSuccess(result.profilePhotoUrl ?? null);
            onClose();
        } catch (err: unknown) {
            setError(readErrorMessage(err, 'Upload failed. Please try again.'));
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = async (): Promise<void> => {
        if (deleting) return;
        setDeleting(true);
        setError('');
        try {
            await membersAPI.deleteProfilePhoto(memberId);
            onSuccess(null);
            onClose();
        } catch (err: unknown) {
            setError(readErrorMessage(err, 'Failed to remove photo.'));
        } finally {
            setDeleting(false);
        }
    };

    const handleCancel = (): void => {
        setSelectedFile(null);
        setPreview(null);
        setError('');
        onClose();
    };

    const displayUrl = preview || currentPhotoUrl || null;

    return (
        <>
            <div className="modal-backdrop" onClick={handleCancel} />
            <div className="modal-container upload-photo-modal">
                <div className="modal-header">
                    <h2>Profile Photo</h2>
                    <button className="modal-close-btn" onClick={handleCancel} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}

                    <div className="upload-photo-preview-area">
                        <div className="upload-photo-avatar">
                            {displayUrl ? (
                                <img src={displayUrl} alt="Profile preview" />
                            ) : (
                                <span className="upload-photo-avatar-placeholder">?</span>
                            )}
                        </div>
                        <p className="upload-photo-caption">
                            {preview ? 'New photo preview' : currentPhotoUrl ? 'Current photo' : 'No photo yet'}
                        </p>
                    </div>

                    {!selectedFile ? (
                        <div
                            className={`upload-photo-drop-zone${dragActive ? ' upload-photo-drop-zone--active' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                            }}
                        >
                            <Upload size={28} className="upload-photo-drop-icon" />
                            <p className="upload-photo-drop-text">Drag & drop your photo here, or click to browse</p>
                            <p className="upload-photo-drop-hint">JPEG, PNG, or WebP · max 5 MB</p>
                        </div>
                    ) : (
                        <div className="upload-photo-file-row">
                            <div className="upload-photo-file-info">
                                <span className="upload-photo-file-name">{selectedFile.name}</span>
                                <span className="upload-photo-file-size">{formatFileSize(selectedFile.size)}</span>
                            </div>
                            <button
                                type="button"
                                className="upload-photo-file-remove"
                                onClick={() => {
                                    setSelectedFile(null);
                                    setPreview(null);
                                    setError('');
                                }}
                                aria-label="Remove selected file"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleInputChange}
                        hidden
                    />
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={uploading || deleting}>
                        Cancel
                    </button>
                    {currentPhotoUrl && !selectedFile && (
                        <button type="button" className="btn btn-danger" onClick={handleRemovePhoto} disabled={uploading || deleting}>
                            {deleting ? 'Removing…' : 'Remove photo'}
                        </button>
                    )}
                    <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={!selectedFile || uploading || deleting}>
                        {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                </div>
            </div>
        </>
    );
}

export default UploadPhotoModal;
