'use client';

import { useEffect, useState } from 'react';
import { X, Loader } from 'lucide-react';
import { projectFilesAPI, getProfilePhotoUrl } from '../../../services/api';
import type { Id, ProjectFileCommentRef } from '../../../types/backend-contracts';

interface FileCommentTarget {
    id: Id;
    name?: string;
    fileName?: string;
}

interface FileCommentsModalProps {
    file: FileCommentTarget | null;
    onClose: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to load comments';
}

export default function FileCommentsModal({ file, onClose }: FileCommentsModalProps) {
    const [comments, setComments] = useState<ProjectFileCommentRef[]>([]);
    const [commentText, setCommentText] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fileLabel = file?.name ?? file?.fileName ?? 'File';

    const loadComments = async () => {
        if (!file?.id) return;
        try {
            setLoading(true);
            setError('');
            const data = await projectFilesAPI.getComments(file.id);
            setComments(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadComments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file?.id]);

    const handleAddComment = async () => {
        if (!commentText.trim() || !file?.id) return;
        try {
            setSaving(true);
            setError('');
            await projectFilesAPI.addComment(file.id, commentText.trim());
            setCommentText('');
            await loadComments();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!file) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container modal-large">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">File Comments</h2>
                        <p className="modal-subtitle">{fileLabel}</p>
                    </div>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="empty-state">
                            <Loader size={16} className="file-status-processing" />
                            <p>Loading comments...</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : (
                        <>
                            <div className="form-section">
                                <h3 className="form-section-title">Discussion</h3>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {comments.length > 0 ? comments.map((comment) => (
                                        <div
                                            key={comment.id}
                                            style={{
                                                border: '1px solid var(--gray-200)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '0.85rem',
                                                background: 'var(--gray-50)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.45rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                                    {comment.member?.profilePhotoUrl ? (
                                                        <img
                                                            src={getProfilePhotoUrl(comment.member.id) ?? undefined}
                                                            alt={comment.member.fullName}
                                                            style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <span
                                                            style={{
                                                                width: 24,
                                                                height: 24,
                                                                borderRadius: '50%',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                background: 'var(--purple-100)',
                                                                color: 'var(--purple-700)',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {(comment.member?.fullName ?? '?').charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <strong>{comment.member?.fullName ?? 'Unknown'}</strong>
                                                </div>
                                                <span className="form-hint" style={{ margin: 0 }}>
                                                    {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'Unknown date'}
                                                    {comment.isEdited ? ' · edited' : ''}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--gray-800)' }}>
                                                {comment.comment}
                                            </p>
                                        </div>
                                    )) : (
                                        <p className="form-hint">No comments yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Add Comment</h3>
                                <div className="form-group">
                                    <label className="form-label">Comment</label>
                                    <textarea
                                        className="form-input form-textarea"
                                        placeholder="Write a comment..."
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || saving}
                    >
                        {saving ? 'Adding...' : 'Add Comment'}
                    </button>
                </div>
            </div>
        </>
    );
}
