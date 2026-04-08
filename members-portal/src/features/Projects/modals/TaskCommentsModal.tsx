'use client';

import { useEffect, useState } from 'react';
import { X, Loader } from 'lucide-react';
import { tasksAPI, getProfilePhotoUrl } from '../../../services/api';
import type { TaskCommentRef, TaskSummary } from '../../../types/backend-contracts';

interface TaskCommentsModalProps {
    task: TaskSummary | null;
    onClose: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to load comments';
}

export default function TaskCommentsModal({ task, onClose }: TaskCommentsModalProps) {
    const [comments, setComments] = useState<TaskCommentRef[]>([]);
    const [commentText, setCommentText] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadComments = async () => {
        if (!task?.id) return;
        try {
            setLoading(true);
            setError('');
            const data = await tasksAPI.getComments(task.id);
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
    }, [task?.id]);

    const handleAddComment = async () => {
        if (!commentText.trim() || !task?.id) return;
        try {
            setSaving(true);
            setError('');
            await tasksAPI.addComment(task.id, commentText.trim());
            setCommentText('');
            await loadComments();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!task) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Task Comments</h2>
                        <p className="modal-subtitle">{task.title}</p>
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
                                <div className="modal-comment-list">
                                    {comments.length > 0 ? comments.map((comment) => (
                                        <div
                                            key={comment.id}
                                            className="modal-comment-card"
                                        >
                                            <div className="modal-comment-header">
                                                <div className="modal-comment-author">
                                                    {comment.member?.profilePhotoUrl ? (
                                                        <img
                                                            src={getProfilePhotoUrl(comment.member.id) ?? undefined}
                                                            alt={comment.member.fullName}
                                                            className="modal-comment-avatar-image"
                                                        />
                                                    ) : (
                                                        <span
                                                            className="modal-comment-avatar-fallback"
                                                        >
                                                            {(comment.member?.fullName ?? '?').charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <strong>{comment.member?.fullName ?? 'Unknown'}</strong>
                                                </div>
                                                <span className="form-hint modal-comment-meta">
                                                    {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'Unknown date'}
                                                    {comment.isEdited ? ' · edited' : ''}
                                                </span>
                                            </div>
                                            <p className="modal-comment-body">
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
