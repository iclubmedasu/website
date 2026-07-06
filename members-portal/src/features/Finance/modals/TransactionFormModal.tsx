'use client';

import { useMemo, useState } from 'react';
import type { FinanceAccountSummary, FinanceTransactionRow } from '@iclub/shared';
import { fromDateInputValue, toDateInputValue } from '@iclub/shared/utils';
import { financeAPI } from '@/services/api';
import { FinanceModal } from '../components/FinanceModal';

interface TransactionFormModalProps {
    transaction?: FinanceTransactionRow;
    accounts: FinanceAccountSummary[];
    categories: string[];
    onClose: () => void;
    onSaved: () => void;
}

export function TransactionFormModal({
    transaction,
    accounts,
    categories,
    onClose,
    onSaved,
}: TransactionFormModalProps) {
    const activeAccounts = accounts.filter((account) => account.isActive);

    const [accountId, setAccountId] = useState(
        String(transaction?.accountId ?? activeAccounts[0]?.id ?? ''),
    );
    const [type, setType] = useState<'INCOME' | 'EXPENSE'>(transaction?.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME');
    const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
    const [category, setCategory] = useState(transaction?.category ?? '');
    const [transactionDate, setTransactionDate] = useState(
        transaction?.transactionDate
            ? toDateInputValue(transaction.transactionDate)
            : toDateInputValue(new Date()),
    );
    const [description, setDescription] = useState(transaction?.description ?? '');
    const [reference, setReference] = useState(transaction?.reference ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const categoryOptions = useMemo(() => {
        const options = [...categories];
        if (category && !options.includes(category)) {
            options.unshift(category);
        }
        return options;
    }, [categories, category]);

    const save = async () => {
        const parsedAmount = parseFloat(amount);
        if (!accountId) {
            setError('Account is required');
            return;
        }
        if (!category.trim()) {
            setError('Category is required');
            return;
        }
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            setError('Amount must be greater than zero');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const payload = {
                accountId: Number(accountId),
                type,
                amount: parsedAmount,
                category: category.trim(),
                transactionDate: fromDateInputValue(transactionDate) ?? transactionDate,
                description: description.trim() || null,
                reference: reference.trim() || null,
            };

            if (transaction) {
                await financeAPI.updateTransaction(transaction.id, payload);
            } else {
                await financeAPI.createTransaction(payload);
            }
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save transaction');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!transaction) return;
        if (!window.confirm('Delete this transaction?')) return;

        setBusy(true);
        setError('');
        try {
            await financeAPI.deleteTransaction(transaction.id);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete transaction');
        } finally {
            setBusy(false);
        }
    };

    return (
        <FinanceModal
            title={transaction ? 'Edit transaction' : 'Add transaction'}
            onClose={onClose}
            footer={
                <>
                    {transaction ? (
                        <button type="button" className="btn btn-secondary" onClick={() => void remove()} disabled={busy}>
                            Delete
                        </button>
                    ) : null}
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
                <label htmlFor="finance-tx-account" className="form-label">Account</label>
                <select
                    id="finance-tx-account"
                    className="form-input"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                >
                    <option value="">Select account</option>
                    {activeAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="finance-tx-type" className="form-label">Type</label>
                <select
                    id="finance-tx-type"
                    className="form-input"
                    value={type}
                    onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}
                >
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="finance-tx-amount" className="form-label">Amount</label>
                <input
                    id="finance-tx-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-tx-category" className="form-label">Category</label>
                <select
                    id="finance-tx-category"
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="">Select category</option>
                    {categoryOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="finance-tx-date" className="form-label">Date</label>
                <input
                    id="finance-tx-date"
                    type="date"
                    className="form-input"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-tx-description" className="form-label">Description</label>
                <input
                    id="finance-tx-description"
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-tx-reference" className="form-label">Reference</label>
                <input
                    id="finance-tx-reference"
                    className="form-input"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                />
            </div>
        </FinanceModal>
    );
}
