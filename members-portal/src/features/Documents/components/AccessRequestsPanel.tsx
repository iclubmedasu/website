'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDate as formatSharedDate } from '@iclub/shared/utils';

import {
    documentsAPI,
    type CategoryAccessRequestDetail,
    type DocumentAccessRequestDetail,
    type DurationPreset,
} from '@/services/documentsAPI';

interface AccessRequestsPanelProps {
    onChanged?: () => void | Promise<void>;
    onPendingCountChange?: (count: number) => void;
}

type PendingAccessRequest =
    | (DocumentAccessRequestDetail & { targetKind: 'document' })
    | (CategoryAccessRequestDetail & { targetKind: 'category' });

const DURATION_OPTIONS: { value: DurationPreset; label: string }[] = [
    { value: 'DAY', label: 'Day' },
    { value: 'WEEK', label: 'Week' },
    { value: 'MONTH', label: 'Month' },
    { value: 'INDEFINITE', label: 'Indefinite' },
];

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return formatSharedDate(value);
}

function requestKey(request: PendingAccessRequest): string {
    return `${request.targetKind}-${request.id}`;
}

function requestItemTitle(request: PendingAccessRequest): string {
    if (request.targetKind === 'document') {
        return request.document?.title || `Document #${request.documentId}`;
    }
    return request.category?.name || `Folder #${request.categoryId}`;
}

/** Short type label from mime, matching explorer icon heuristics. */
function fileTypeLabel(fileType: string | undefined): string {
    if (!fileType) return 'document';
    const mime = fileType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime === 'text/csv' ||
        mime.includes('sheet')
    ) {
        return 'excel';
    }
    if (mime.includes('pdf')) return 'pdf';
    if (mime.startsWith('text/') || mime.includes('word') || mime.includes('document')) {
        return 'document';
    }
    return 'document';
}

function requestTypeLabel(request: PendingAccessRequest): string {
    if (request.targetKind === 'category') return 'folder';
    return fileTypeLabel(request.document?.fileType);
}

function requestPath(request: PendingAccessRequest): string {
    if (request.targetKind === 'category') {
        const folderName = request.category?.name || `Folder #${request.categoryId}`;
        return `Documents › ${folderName}`;
    }
    const title = request.document?.title || `Document #${request.documentId}`;
    const folderName = request.document?.category?.name;
    if (folderName) {
        return `Documents › ${folderName} › ${title}`;
    }
    return `Documents › ${title}`;
}

export default function AccessRequestsPanel({
    onChanged,
    onPendingCountChange,
}: AccessRequestsPanelProps) {
    const [requests, setRequests] = useState<PendingAccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [durationByKey, setDurationByKey] = useState<Record<string, DurationPreset>>({});
    const [denyKey, setDenyKey] = useState<string | null>(null);
    const [denyNote, setDenyNote] = useState('');
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        setActionError('');
        setDenyKey(null);
        setDenyNote('');
        try {
            const [docRequests, categoryRequests] = await Promise.all([
                documentsAPI.listAccessRequests({ status: 'PENDING' }),
                documentsAPI.listCategoryAccessRequests({ status: 'PENDING' }),
            ]);
            const merged: PendingAccessRequest[] = [
                ...docRequests.map((item) => ({ ...item, targetKind: 'document' as const })),
                ...categoryRequests.map((item) => ({
                    ...item,
                    targetKind: 'category' as const,
                })),
            ].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            setRequests(merged);
            onPendingCountChange?.(merged.length);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load access requests'));
            setRequests([]);
            onPendingCountChange?.(0);
        } finally {
            setLoading(false);
        }
    }, [onPendingCountChange]);

    useEffect(() => {
        void loadRequests();
        const intervalId = window.setInterval(() => {
            void loadRequests();
        }, 60_000);
        return () => window.clearInterval(intervalId);
    }, [loadRequests]);

    const handleApprove = async (request: PendingAccessRequest) => {
        const key = requestKey(request);
        const durationPreset = durationByKey[key] || 'WEEK';
        const previous = requests;
        const next = requests.filter((item) => requestKey(item) !== key);
        setRequests(next);
        onPendingCountChange?.(next.length);
        setBusyKey(key);
        setActionError('');
        setDenyKey(null);
        setDenyNote('');
        try {
            if (request.targetKind === 'category') {
                await documentsAPI.approveCategoryAccessRequest(request.id, {
                    durationPreset,
                });
            } else {
                await documentsAPI.approveAccessRequest(request.id, { durationPreset });
            }
            await onChanged?.();
        } catch (err: unknown) {
            setRequests(previous);
            onPendingCountChange?.(previous.length);
            setActionError(getErrorMessage(err, 'Failed to approve request'));
        } finally {
            setBusyKey(null);
        }
    };

    const handleDeny = async (request: PendingAccessRequest) => {
        const key = requestKey(request);
        const previous = requests;
        const next = requests.filter((item) => requestKey(item) !== key);
        setRequests(next);
        onPendingCountChange?.(next.length);
        setBusyKey(key);
        setActionError('');
        const note = denyNote.trim();
        setDenyKey(null);
        setDenyNote('');
        try {
            const payload = note ? { reviewNote: note } : {};
            if (request.targetKind === 'category') {
                await documentsAPI.denyCategoryAccessRequest(request.id, payload);
            } else {
                await documentsAPI.denyAccessRequest(request.id, payload);
            }
            await onChanged?.();
        } catch (err: unknown) {
            setRequests(previous);
            onPendingCountChange?.(previous.length);
            setActionError(getErrorMessage(err, 'Failed to deny request'));
        } finally {
            setBusyKey(null);
        }
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner" />
                <p>Loading requests…</p>
            </div>
        );
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <>
            {actionError ? <div className="error-message">{actionError}</div> : null}
            {requests.length === 0 ? (
                <p className="empty-message">No pending access requests</p>
            ) : (
                <div className="documents-request-list">
                    {requests.map((request) => {
                        const key = requestKey(request);
                        const isDenying = denyKey === key;
                        const duration = durationByKey[key] || 'WEEK';
                        const title = requestItemTitle(request);
                        const typeLabel = requestTypeLabel(request);
                        const requester =
                            request.member?.fullName || `Member #${request.memberId}`;

                        return (
                            <article key={key} className="documents-request-row">
                                <div className="documents-request-row-body">
                                    <div className="documents-request-col documents-request-col--details">
                                        <h4 className="documents-request-row-title">
                                            {title} ({typeLabel})
                                        </h4>
                                        <p
                                            className="documents-request-path"
                                            aria-label="Location"
                                        >
                                            {requestPath(request)}
                                        </p>
                                        <p className="documents-request-row-meta">
                                            {requester}
                                            {' · '}
                                            <time dateTime={request.createdAt}>
                                                {formatDate(request.createdAt)}
                                            </time>
                                        </p>
                                    </div>
                                    <div className="documents-request-col documents-request-col--duration">
                                        <div
                                            className="modal-segmented documents-request-row-duration"
                                            role="group"
                                            aria-label="Approval duration"
                                        >
                                            {DURATION_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className={`modal-segmented-btn${
                                                        duration === option.value
                                                            ? ' modal-segmented-btn--active'
                                                            : ''
                                                    }`}
                                                    onClick={() =>
                                                        setDurationByKey((current) => ({
                                                            ...current,
                                                            [key]: option.value,
                                                        }))
                                                    }
                                                    disabled={busyKey != null}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="documents-request-col documents-request-col--actions">
                                        {isDenying ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={busyKey != null}
                                                    onClick={() => {
                                                        setDenyKey(null);
                                                        setDenyNote('');
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    disabled={busyKey != null}
                                                    onClick={() => void handleDeny(request)}
                                                >
                                                    Confirm deny
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={busyKey != null}
                                                    onClick={() => {
                                                        setDenyKey(key);
                                                        setDenyNote('');
                                                    }}
                                                >
                                                    Deny
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    disabled={busyKey != null}
                                                    onClick={() => void handleApprove(request)}
                                                >
                                                    Approve
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isDenying ? (
                                    <div className="documents-inbox-deny">
                                        <label
                                            htmlFor={`deny-note-${key}`}
                                            className="form-label"
                                        >
                                            Note (optional)
                                        </label>
                                        <textarea
                                            id={`deny-note-${key}`}
                                            className="form-input"
                                            rows={2}
                                            value={denyNote}
                                            onChange={(e) => setDenyNote(e.target.value)}
                                            disabled={busyKey != null}
                                            placeholder="Reason for denial"
                                        />
                                    </div>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            )}
        </>
    );
}
