'use client';

import { Pencil } from 'lucide-react';
import type { FinanceAccountSummary } from '@iclub/shared';

interface AccountBalancesSectionProps {
    accounts: FinanceAccountSummary[];
    totalBalance: number;
    currency: string;
    onAdd?: () => void;
    onEdit?: (account: FinanceAccountSummary) => void;
}

function formatMoney(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

export default function AccountBalancesSection({
    accounts,
    totalBalance,
    currency,
    onAdd,
    onEdit,
}: AccountBalancesSectionProps) {
    return (
        <div className="card">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">Account Balances</h3>
                    <p className="card-subtitle">
                        {accounts.length} account{accounts.length === 1 ? '' : 's'}
                    </p>
                </div>
                {onAdd ? (
                    <button type="button" className="btn btn-secondary finance-card-action" onClick={onAdd}>
                        Add account
                    </button>
                ) : null}
            </div>
            <div className="card-body">
                <div className="finance-balance-grid">
                    <div className="finance-balance-tile finance-balance-tile-total">
                        <p className="finance-balance-label">Total Club Balance</p>
                        <p className="finance-balance-value">{formatMoney(totalBalance, currency)}</p>
                    </div>

                    {accounts.map((account) => (
                        <div
                            key={account.id}
                            className={`finance-balance-tile${onEdit ? ' finance-balance-tile--editable' : ''}`}
                        >
                            {onEdit ? (
                                <button
                                    type="button"
                                    className="finance-balance-edit-btn table-action-btn edit-btn"
                                    onClick={() => onEdit(account)}
                                    aria-label={`Edit ${account.name}`}
                                >
                                    <Pencil size={16} />
                                </button>
                            ) : null}
                            <p className="finance-balance-label">{account.name}</p>
                            <p className="finance-balance-value">
                                {formatMoney(account.currentBalance, account.currency)}
                            </p>
                            <p className="finance-balance-meta">
                                {account.accountType}
                                {!account.isActive ? ' · Inactive' : ''}
                                {account.description ? ` · ${account.description}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
