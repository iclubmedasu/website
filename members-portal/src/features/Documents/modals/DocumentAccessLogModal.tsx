'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline';
import type { ActivityTimelineEvent } from '@/components/ActivityTimeline/activityTimelineFormatters';
import {
    documentsAPI,
    type DocumentAccessLogEntry,
    type DocumentAccessTarget,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';

interface DocumentAccessLogModalProps {
    targetType?: DocumentAccessTarget;
    targetId?: Id | null;
    targetTitle?: string;
    documentId?: Id | null;
    documentTitle?: string;
    onClose: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function mapAccessLogToTimelineEvent(
    entry: DocumentAccessLogEntry,
    entityType: 'CATEGORY' | 'DOCUMENT',
    entityName: string,
): ActivityTimelineEvent {
    return {
        id: entry.id,
        actionType: entry.action,
        member: entry.member,
        createdAt: entry.createdAt,
        entityType,
        entityName,
    };
}

async function fetchAllAccessLogs(
    resolvedId: Id,
    isCategory: boolean,
): Promise<DocumentAccessLogEntry[]> {
    const all: DocumentAccessLogEntry[] = [];
    let cursor: Id | null | undefined;
    const fetchPage = isCategory
        ? documentsAPI.getCategoryAccessLog
        : documentsAPI.getAccessLog;

    // Walk cursor pages until exhausted (API limit max 100).
    for (;;) {
        const result = await fetchPage(resolvedId, {
            cursor: cursor ?? undefined,
            limit: 100,
        });
        const page = Array.isArray(result.accessLogs) ? result.accessLogs : [];
        all.push(...page);
        if (result.nextCursor == null) break;
        cursor = result.nextCursor;
    }

    return all;
}

export default function DocumentAccessLogModal({
    targetType = 'document',
    targetId = null,
    targetTitle,
    documentId,
    documentTitle,
    onClose,
}: DocumentAccessLogModalProps) {
    const resolvedId = targetId ?? documentId ?? null;
    const resolvedTitle = targetTitle ?? documentTitle ?? '';
    const isCategory = targetType === 'category';
    const [logs, setLogs] = useState<DocumentAccessLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (resolvedId == null) {
            setLogs([]);
            setError('');
            setLoading(false);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const all = await fetchAllAccessLogs(resolvedId, isCategory);
                if (cancelled) return;
                setLogs(all);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err, 'Failed to load access log'));
                    setLogs([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [resolvedId, isCategory]);

    const timelineEvents = useMemo(() => {
        const entityType = isCategory ? 'CATEGORY' : 'DOCUMENT';
        const entityName =
            resolvedTitle || (isCategory ? 'Folder' : 'Document');
        return logs.map((entry) =>
            mapAccessLogToTimelineEvent(entry, entityType, entityName),
        );
    }, [logs, isCategory, resolvedTitle]);

    if (resolvedId == null) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container activity-history-modal project-activity-modal">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">
                            {isCategory ? 'Folder Access Log' : 'Access Log'}
                        </h2>
                        <p className="modal-subtitle">
                            {resolvedTitle || (isCategory ? 'Folder' : 'Document')}
                        </p>
                    </div>
                    <button
                        className="modal-close-btn"
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="activity-history-content">
                        {loading ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Loading access log…</p>
                            </div>
                        ) : error ? (
                            <div className="error-message">{error}</div>
                        ) : (
                            <ActivityTimeline
                                title="Access History"
                                events={timelineEvents}
                                emptyMessage="No access events yet."
                                chronology="descending"
                                contextEntity={{
                                    label: isCategory ? 'Folder' : 'Document',
                                    name:
                                        resolvedTitle ||
                                        (isCategory ? 'Folder' : 'Document'),
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
