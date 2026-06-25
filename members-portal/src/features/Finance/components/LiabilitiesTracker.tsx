'use client';

import { Pencil } from 'lucide-react';
import type { FinanceLiabilityRow } from '@iclub/shared';
import '@/components/badges/badge.css';

interface LiabilitiesTrackerProps {
    liabilities: FinanceLiabilityRow[];
    currency: string;
    onAdd?: () => void;
    onEdit?: (liability: FinanceLiabilityRow) => void;
}

function formatMoney(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

function statusBadgeClass(status: FinanceLiabilityRow['status']): string {
    if (status === 'PAID') return 'badge badge-status-COMPLETED';
    if (status === 'OVERDUE') return 'badge badge-priority-URGENT';
    return 'badge badge-status-IN_PROGRESS';
}

export default function LiabilitiesTracker({
    liabilities,
    currency,
    onAdd,
    onEdit,
}: LiabilitiesTrackerProps) {
    return (
        <div className="card finance-side-card">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">Liabilities</h3>
                    <p className="card-subtitle">Outstanding obligations and payment progress</p>
                </div>
                {onAdd ? (
                    <button type="button" className="btn btn-secondary finance-card-action" onClick={onAdd}>
                        Add liability
                    </button>
                ) : null}
            </div>
            <div className="card-body finance-liabilities-list">
                {liabilities.length === 0 ? (
                    <p className="empty-message">No active liabilities.</p>
                ) : (
                    liabilities.map((liability) => (
                        <div
                            key={liability.id}
                            className={`finance-liability-row finance-list-row--clickable${liability.status === 'OVERDUE' ? ' finance-liability-overdue' : ''}`}
                            onClick={onEdit ? () => onEdit(liability) : undefined}
                            onKeyDown={
                                onEdit
                                    ? (event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onEdit(liability);
                                        }
                                    }
                                    : undefined
                            }
                            role={onEdit ? 'button' : undefined}
                            tabIndex={onEdit ? 0 : undefined}
                        >
                            <div className="finance-liability-header">
                                <div>
                                    <h4 className="finance-liability-creditor">{liability.creditor}</h4>
                                    {liability.description ? (
                                        <p className="finance-liability-description">{liability.description}</p>
                                    ) : null}
                                </div>
                                <div className="finance-list-row-actions">
                                    <span className={statusBadgeClass(liability.status)}>{liability.status}</span>
                                    {onEdit ? (
                                        <button
                                            type="button"
                                            className="table-action-btn edit-btn"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onEdit(liability);
                                            }}
                                            aria-label={`Edit ${liability.creditor}`}
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="finance-liability-meta">
                                <span>Account: {liability.accountName}</span>
                                <span>Remaining: {formatMoney(liability.remainingAmount, liability.currency || currency)}</span>
                                <span>Due: {liability.dueDate ?? '—'}</span>
                            </div>

                            <div className="finance-progress-track" aria-hidden="true">
                                <div
                                    className="finance-progress-fill"
                                    style={{ width: `${liability.progressPercent}%` }}
                                />
                            </div>
                            <p className="finance-progress-label">
                                {formatMoney(liability.paidAmount, liability.currency || currency)} paid of{' '}
                                {formatMoney(liability.totalAmount, liability.currency || currency)} ({liability.progressPercent}%)
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
