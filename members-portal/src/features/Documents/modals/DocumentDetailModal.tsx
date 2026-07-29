'use client';

import { useEffect, useState } from 'react';
import { Download, KeyRound, ScrollText, X } from 'lucide-react';
import {
    documentsAPI,
    type DocumentAccessGrant,
    type DocumentDetail,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';

interface DocumentDetailModalProps {
    documentId: Id | null;
    listVersion?: number;
    onClose: () => void;
    onRefresh?: () => void | Promise<void>;
    onOpenGrant?: (documentId: Id) => void;
    onOpenAccessLog?: (documentId: Id, title: string) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function isGrantActive(grant: DocumentAccessGrant): boolean {
    if (grant.revokedAt != null) return false;
    if (grant.expiresAt != null && new Date(grant.expiresAt) <= new Date()) return false;
    return true;
}

function grantTargetLabel(grant: DocumentAccessGrant): string {
    return grant.team?.name || `Team #${grant.teamId}`;
}

function grantExpiryLabel(grant: DocumentAccessGrant): string {
    if (grant.revokedAt) return `Revoked ${formatDate(grant.revokedAt)}`;
    if (!grant.expiresAt) return 'Indefinite';
    if (new Date(grant.expiresAt) <= new Date()) return `Expired ${formatDate(grant.expiresAt)}`;
    return `Expires ${formatDate(grant.expiresAt)}`;
}

export default function DocumentDetailModal({
    documentId,
    listVersion = 0,
    onClose,
    onRefresh: _onRefresh,
    onOpenGrant,
    onOpenAccessLog,
}: DocumentDetailModalProps) {
    const [doc, setDoc] = useState<DocumentDetail | null>(null);
    const [grants, setGrants] = useState<DocumentAccessGrant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyGrantId, setBusyGrantId] = useState<Id | null>(null);

    useEffect(() => {
        if (documentId == null) {
            setDoc(null);
            setGrants([]);
            setError('');
            setActionError('');
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            setActionError('');
            try {
                const detail = await documentsAPI.getDocument(documentId);
                if (cancelled) return;
                setDoc(detail);

                if (detail.canManageAccess) {
                    const grantList = await documentsAPI.listGrants(documentId);
                    if (cancelled) return;
                    setGrants(grantList);
                } else {
                    setGrants([]);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err, 'Failed to load document'));
                    setDoc(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [documentId, listVersion]);

    if (documentId == null) return null;

    const canShowAccessLog = Boolean(doc?.canManageAccess);

    const handleDownload = async () => {
        if (!doc) return;
        setActionError('');
        try {
            await documentsAPI.downloadDocument(doc.id, doc.title || 'document');
        } catch (err: unknown) {
            setActionError(getErrorMessage(err, 'Failed to download document'));
        }
    };

    const handleRevokeGrant = async (grant: DocumentAccessGrant) => {
        const previous = grants;
        setGrants((current) =>
            current.map((item) =>
                Number(item.id) === Number(grant.id)
                    ? { ...item, revokedAt: new Date().toISOString() }
                    : item,
            ),
        );
        setBusyGrantId(grant.id);
        setActionError('');
        try {
            const updated = await documentsAPI.revokeGrant(documentId, grant.id);
            setGrants((current) =>
                current.map((item) =>
                    Number(item.id) === Number(grant.id) ? { ...item, ...updated } : item,
                ),
            );
        } catch (err: unknown) {
            setGrants(previous);
            setActionError(getErrorMessage(err, 'Failed to revoke grant'));
        } finally {
            setBusyGrantId(null);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Document details</h2>
                        {doc ? <p className="modal-subtitle">{doc.title}</p> : null}
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
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading document…</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : doc ? (
                        <>
                            {actionError ? <div className="error-message">{actionError}</div> : null}

                            <div className="form-section">
                                <h3 className="form-section-title">Details</h3>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Category</span>
                                        <span className="info-value">
                                            {doc.category?.name || '—'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Uploaded by</span>
                                        <span className="info-value">
                                            {doc.uploadedBy?.fullName || '—'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Created</span>
                                        <span className="info-value">
                                            {formatDate(doc.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="modal-inline-actions">
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => void handleDownload()}
                                    >
                                        <Download size={16} />
                                        Download
                                    </button>
                                    {doc.canManageAccess ? (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => onOpenGrant?.(doc.id)}
                                        >
                                            <KeyRound size={16} />
                                            Grant access
                                        </button>
                                    ) : null}
                                    {canShowAccessLog ? (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => onOpenAccessLog?.(doc.id, doc.title)}
                                        >
                                            <ScrollText size={16} />
                                            Access Log
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            {doc.canManageAccess ? (
                                <div className="form-section">
                                    <h3 className="form-section-title">Access</h3>
                                    {grants.filter((grant) => grant.grantedToType === 'TEAM')
                                        .length === 0 ? (
                                        <p className="form-hint">No grants yet.</p>
                                    ) : (
                                        <ul className="modal-card-list">
                                            {grants
                                                .filter((grant) => grant.grantedToType === 'TEAM')
                                                .map((grant) => {
                                                    const active = isGrantActive(grant);
                                                    return (
                                                        <li
                                                            key={grant.id}
                                                            className="modal-access-card"
                                                        >
                                                            <div className="modal-access-card-main">
                                                                <span className="modal-access-card-title">
                                                                    {grantTargetLabel(grant)}
                                                                </span>
                                                                <span className="modal-access-card-meta">
                                                                    Team Head &amp; Vice
                                                                    {' · '}
                                                                    {grantExpiryLabel(grant)}
                                                                    {grant.grantedBy?.fullName
                                                                        ? ` · by ${grant.grantedBy.fullName}`
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                            {active ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-sm"
                                                                    disabled={
                                                                        busyGrantId != null &&
                                                                        Number(busyGrantId) ===
                                                                            Number(grant.id)
                                                                    }
                                                                    onClick={() =>
                                                                        void handleRevokeGrant(
                                                                            grant,
                                                                        )
                                                                    }
                                                                >
                                                                    Revoke
                                                                </button>
                                                            ) : null}
                                                        </li>
                                                    );
                                                })}
                                        </ul>
                                    )}
                                </div>
                            ) : null}
                        </>
                    ) : null}
                </div>
            </div>
        </>
    );
}
