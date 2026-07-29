'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
    documentsAPI,
    type DocumentAccessGrant,
    type DocumentAccessTarget,
} from '@/services/documentsAPI';
import type { Id } from '@/types/backend-contracts';
import '@/components/modal/modal.css';

interface ManageAccessModalProps {
    targetType: DocumentAccessTarget | null;
    targetId: Id | null;
    targetTitle?: string;
    onClose: () => void;
    onChanged?: () => void | Promise<void>;
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

export default function ManageAccessModal({
    targetType,
    targetId,
    targetTitle = '',
    onClose,
    onChanged,
}: ManageAccessModalProps) {
    const [grants, setGrants] = useState<DocumentAccessGrant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyGrantId, setBusyGrantId] = useState<Id | null>(null);

    const isOpen = targetType != null && targetId != null;
    const isCategory = targetType === 'category';

    useEffect(() => {
        if (!isOpen || targetId == null || targetType == null) {
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
                const grantList =
                    targetType === 'category'
                        ? await documentsAPI.listCategoryGrants(targetId)
                        : await documentsAPI.listGrants(targetId);
                if (!cancelled) setGrants(grantList);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(
                        getErrorMessage(
                            err,
                            isCategory
                                ? 'Failed to load folder access'
                                : 'Failed to load document access',
                        ),
                    );
                    setGrants([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [isOpen, targetId, targetType, isCategory]);

    if (!isOpen || targetId == null || targetType == null) return null;

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
            const updated =
                targetType === 'category'
                    ? await documentsAPI.revokeCategoryGrant(targetId, grant.id)
                    : await documentsAPI.revokeGrant(targetId, grant.id);
            setGrants((current) =>
                current.map((item) =>
                    Number(item.id) === Number(grant.id) ? { ...item, ...updated } : item,
                ),
            );
            await onChanged?.();
        } catch (err: unknown) {
            setGrants(previous);
            setActionError(getErrorMessage(err, 'Failed to revoke grant'));
        } finally {
            setBusyGrantId(null);
        }
    };

    const teamGrants = grants.filter((grant) => grant.grantedToType === 'TEAM');

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="manage-access-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="manage-access-title">
                            Manage access
                        </h2>
                        <p className="modal-subtitle">{targetTitle}</p>
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
                            <p>Loading access…</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : (
                        <>
                            {actionError ? (
                                <div className="error-message">{actionError}</div>
                            ) : null}

                            <div className="form-section">
                                <h3 className="form-section-title">Access</h3>
                                {teamGrants.length === 0 ? (
                                    <p className="form-hint">No grants yet.</p>
                                ) : (
                                    <ul className="modal-card-list">
                                        {teamGrants.map((grant) => {
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
                                                                void handleRevokeGrant(grant)
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
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
