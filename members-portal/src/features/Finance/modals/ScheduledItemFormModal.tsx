'use client';

import { useState } from 'react';
import {
    FinanceAccountSummary,
    FinanceScheduledItemRow,
    FinanceScheduledItemType,
    FinanceScheduledRecurrence,
} from '@iclub/shared';
import { fromDateInputValue, toDateInputValue } from '@iclub/shared/utils';
import { financeAPI } from '@/services/api';
import { FormToggleRow } from '@/components/toggle/FormToggleRow';
import { FinanceModal } from '../components/FinanceModal';

interface ScheduledItemFormModalProps {
    item?: FinanceScheduledItemRow;
    accounts: FinanceAccountSummary[];
    onClose: () => void;
    onSaved: () => void;
}

const SCHEDULED_TYPES: FinanceScheduledItemType[] = ['INCOME', 'EXPENSE'];
const RECURRENCE_OPTIONS: { value: FinanceScheduledRecurrence | ''; label: string }[] = [
    { value: '', label: 'None' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'YEARLY', label: 'Yearly' },
];

export function ScheduledItemFormModal({ item, accounts, onClose, onSaved }: ScheduledItemFormModalProps) {
    const activeAccounts = accounts.filter((account) => account.isActive);

    const [title, setTitle] = useState(item?.title ?? '');
    const [type, setType] = useState<FinanceScheduledItemType>(item?.type ?? 'EXPENSE');
    const [amount, setAmount] = useState(item ? String(item.amount) : '');
    const [dueDate, setDueDate] = useState(
        item?.dueDate ? toDateInputValue(item.dueDate) : toDateInputValue(new Date()),
    );
    const [accountId, setAccountId] = useState(
        String(item?.accountId ?? activeAccounts[0]?.id ?? ''),
    );
    const [recurrence, setRecurrence] = useState<FinanceScheduledRecurrence | ''>(item?.recurrence ?? '');
    const [notes, setNotes] = useState(item?.notes ?? '');
    const [isCompleted, setIsCompleted] = useState(item?.isCompleted ?? false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        if (!title.trim()) {
            setError('Title is required');
            return;
        }
        if (!accountId) {
            setError('Account is required');
            return;
        }

        const parsedAmount = parseFloat(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            setError('Amount must be greater than zero');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const payload = {
                title: title.trim(),
                type,
                amount: parsedAmount,
                dueDate: fromDateInputValue(dueDate) ?? dueDate,
                accountId: Number(accountId),
                recurrence: recurrence || null,
                notes: notes.trim() || null,
            };

            if (item) {
                await financeAPI.updateScheduledItem(item.id, { ...payload, isCompleted });
            } else {
                await financeAPI.createScheduledItem(payload);
            }
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save scheduled item');
        } finally {
            setBusy(false);
        }
    };

    return (
        <FinanceModal
            title={item ? 'Edit scheduled item' : 'Add scheduled item'}
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
                <label htmlFor="finance-scheduled-title" className="form-label">Title</label>
                <input
                    id="finance-scheduled-title"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-scheduled-type" className="form-label">Type</label>
                <select
                    id="finance-scheduled-type"
                    className="form-input"
                    value={type}
                    onChange={(e) => setType(e.target.value as FinanceScheduledItemType)}
                >
                    {SCHEDULED_TYPES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="finance-scheduled-amount" className="form-label">Amount</label>
                <input
                    id="finance-scheduled-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-scheduled-due" className="form-label">Due date</label>
                <input
                    id="finance-scheduled-due"
                    type="date"
                    className="form-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-scheduled-account" className="form-label">Account</label>
                <select
                    id="finance-scheduled-account"
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
                <label htmlFor="finance-scheduled-recurrence" className="form-label">Recurrence</label>
                <select
                    id="finance-scheduled-recurrence"
                    className="form-input"
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as FinanceScheduledRecurrence | '')}
                >
                    {RECURRENCE_OPTIONS.map((option) => (
                        <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="finance-scheduled-notes" className="form-label">Notes</label>
                <input
                    id="finance-scheduled-notes"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>
            {item ? (
                <FormToggleRow
                    label="Completed"
                    checked={isCompleted}
                    onChange={setIsCompleted}
                    disabled={busy}
                />
            ) : null}
        </FinanceModal>
    );
}
