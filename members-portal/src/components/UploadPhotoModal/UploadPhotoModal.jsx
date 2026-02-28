import { useState, useRef, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { membersAPI } from '../../services/api';
import '../../components/modal/modal.css';
import './UploadPhotoModal.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadPhotoModal({ isOpen, onClose, memberId, currentPhotoUrl, onSuccess }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    // Generate preview URL for selected file
    useEffect(() => {
        if (!selectedFile) { setPreview(null); return; }
        const url = URL.createObjectURL(selectedFile);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    // Reset state when modal opens/closes
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

    const validateFile = (file) => {
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

    const handleFileSelect = (file) => {
        setError('');
        if (file && validateFile(file)) {
            setSelectedFile(file);
        }
    };

    const handleInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleUpload = async () => {
        if (!selectedFile || uploading) return;
        setUploading(true);
        setError('');
        try {
            const result = await membersAPI.uploadProfilePhoto(memberId, selectedFile);
            onSuccess(result.profilePhotoUrl);
            onClose();
        } catch (err) {
            setError(err?.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = async () => {
        if (deleting) return;
        setDeleting(true);
        setError('');
        try {
            await membersAPI.deleteProfilePhoto(memberId);
            onSuccess(null);
            onClose();
        } catch (err) {
            setError(err?.message || 'Failed to remove photo.');
        } finally {
            setDeleting(false);
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setPreview(null);
        setError('');
        onClose();
    };

    const displayUrl = preview || currentPhotoUrl;

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

                    {/* Preview area */}
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

                    {/* Drop zone or selected file info */}
                    {!selectedFile ? (
                        <div
                            className={`upload-photo-drop-zone${dragActive ? ' upload-photo-drop-zone--active' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
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
                                onClick={() => { setSelectedFile(null); setPreview(null); setError(''); }}
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
