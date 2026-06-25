'use client';

import { useState } from 'react';
import type { FinanceAccountSummary, FinanceAccountType } from '@iclub/shared';
import { financeAPI } from '@/services/api';
import { FormToggleRow } from '@/components/toggle/FormToggleRow';
import { FinanceModal } from '../components/FinanceModal';

interface AccountFormModalProps {
    account?: FinanceAccountSummary;
    onClose: () => void;
    onSaved: () => void;
}

const ACCOUNT_TYPES: FinanceAccountType[] = ['BANK', 'CASH', 'DIGITAL', 'OTHER'];

export function AccountFormModal({ account, onClose, onSaved }: AccountFormModalProps) {
    const [name, setName] = useState(account?.name ?? '');
    const [accountType, setAccountType] = useState<FinanceAccountType>(account?.accountType ?? 'BANK');
    const [currency, setCurrency] = useState(account?.currency ?? 'EGP');
    const [openingBalance, setOpeningBalance] = useState(
        account ? String(account.openingBalance) : '0',
    );
    const [description, setDescription] = useState(account?.description ?? '');
    const [isActive, setIsActive] = useState(account?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const payload = {
                name: name.trim(),
                accountType,
                currency: currency.trim() || 'EGP',
                openingBalance: parseFloat(openingBalance) || 0,
                description: description.trim() || null,
            };

            if (account) {
                await financeAPI.updateAccount(account.id, { ...payload, isActive });
            } else {
                await financeAPI.createAccount(payload);
            }
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save account');
        } finally {
            setBusy(false);
        }
    };

    return (
        <FinanceModal
            title={account ? 'Edit account' : 'Add account'}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                        Save
                    </button>
                </>
            }
        >
            {error ? <p className="error-message">{error}</p> : null}
            <div className="form-group">
                <label htmlFor="finance-account-name" className="form-label">Name</label>
                <input
                    id="finance-account-name"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-account-type" className="form-label">Account type</label>
                <select
                    id="finance-account-type"
                    className="form-input"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as FinanceAccountType)}
                >
                    {ACCOUNT_TYPES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="finance-account-currency" className="form-label">Currency</label>
                <input
                    id="finance-account-currency"
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-account-opening" className="form-label">Opening balance</label>
                <input
                    id="finance-account-opening"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-account-description" className="form-label">Description</label>
                <input
                    id="finance-account-description"
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
            {account ? (
                <FormToggleRow
                    label="Active"
                    checked={isActive}
                    onChange={setIsActive}
                    disabled={busy}
                />
            ) : null}
        </FinanceModal>
    );
}
