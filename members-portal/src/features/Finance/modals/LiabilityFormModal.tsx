'use client';

import { useState } from 'react';
import type { FinanceAccountSummary, FinanceLiabilityRow, FinanceLiabilityStatus } from '@iclub/shared';
import { financeAPI } from '@/services/api';
import { FinanceModal } from '../components/FinanceModal';

interface LiabilityFormModalProps {
    liability?: FinanceLiabilityRow;
    accounts: FinanceAccountSummary[];
    onClose: () => void;
    onSaved: () => void;
}

const LIABILITY_STATUSES: FinanceLiabilityStatus[] = ['ACTIVE', 'PAID', 'OVERDUE'];

export function LiabilityFormModal({ liability, accounts, onClose, onSaved }: LiabilityFormModalProps) {
    const activeAccounts = accounts.filter((account) => account.isActive);

    const [creditor, setCreditor] = useState(liability?.creditor ?? '');
    const [description, setDescription] = useState(liability?.description ?? '');
    const [accountId, setAccountId] = useState(
        String(liability?.accountId ?? activeAccounts[0]?.id ?? ''),
    );
    const [totalAmount, setTotalAmount] = useState(liability ? String(liability.totalAmount) : '');
    const [paidAmount, setPaidAmount] = useState(liability ? String(liability.paidAmount) : '0');
    const [dueDate, setDueDate] = useState(liability?.dueDate ?? '');
    const [currency, setCurrency] = useState(liability?.currency ?? 'EGP');
    const [status, setStatus] = useState<FinanceLiabilityStatus>(liability?.status ?? 'ACTIVE');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        if (!creditor.trim()) {
            setError('Creditor is required');
            return;
        }
        if (!accountId) {
            setError('Account is required');
            return;
        }

        const parsedTotal = parseFloat(totalAmount);
        const parsedPaid = parseFloat(paidAmount) || 0;
        if (Number.isNaN(parsedTotal) || parsedTotal <= 0) {
            setError('Total amount must be greater than zero');
            return;
        }
        if (parsedPaid > parsedTotal) {
            setError('Paid amount cannot exceed total');
            return;
        }

        setBusy(true);
        setError('');
        try {
            const payload = {
                creditor: creditor.trim(),
                description: description.trim() || null,
                accountId: Number(accountId),
                totalAmount: parsedTotal,
                paidAmount: parsedPaid,
                dueDate: dueDate || null,
                currency: currency.trim() || 'EGP',
                status,
            };

            if (liability) {
                await financeAPI.updateLiability(liability.id, payload);
            } else {
                await financeAPI.createLiability(payload);
            }
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save liability');
        } finally {
            setBusy(false);
        }
    };

    return (
        <FinanceModal
            title={liability ? 'Edit liability' : 'Add liability'}
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
                <label htmlFor="finance-liability-creditor" className="form-label">Creditor</label>
                <input
                    id="finance-liability-creditor"
                    className="form-input"
                    value={creditor}
                    onChange={(e) => setCreditor(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-liability-account" className="form-label">Account</label>
                <select
                    id="finance-liability-account"
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
                <label htmlFor="finance-liability-description" className="form-label">Description</label>
                <input
                    id="finance-liability-description"
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-liability-total" className="form-label">Total amount</label>
                <input
                    id="finance-liability-total"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="form-input"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-liability-paid" className="form-label">Paid amount</label>
                <input
                    id="finance-liability-paid"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-liability-due" className="form-label">Due date</label>
                <input
                    id="finance-liability-due"
                    type="date"
                    className="form-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-liability-currency" className="form-label">Currency</label>
                <input
                    id="finance-liability-currency"
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                />
            </div>
            <div className="form-group">
                <label htmlFor="finance-liability-status" className="form-label">Status</label>
                <select
                    id="finance-liability-status"
                    className="form-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FinanceLiabilityStatus)}
                >
                    {LIABILITY_STATUSES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
        </FinanceModal>
    );
}
