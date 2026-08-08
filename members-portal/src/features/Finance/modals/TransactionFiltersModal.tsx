'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { FinanceAccountSummary } from '@iclub/shared';
import { DateInput } from '@/components/input/DateInput';

export interface TransactionFiltersState {
    accountId: string;
    type: string;
    category: string;
    dateFrom: string;
    dateTo: string;
}

interface TransactionFiltersModalProps {
    accountId: string;
    type: string;
    category: string;
    dateFrom: string;
    dateTo: string;
    accounts: FinanceAccountSummary[];
    categories: string[];
    onClose: () => void;
    onApply: (filters: TransactionFiltersState) => void;
    onClear: () => void;
}

export default function TransactionFiltersModal({
    accountId,
    type,
    category,
    dateFrom,
    dateTo,
    accounts,
    categories,
    onClose,
    onApply,
    onClear,
}: TransactionFiltersModalProps) {
    const [draftAccountId, setDraftAccountId] = useState(accountId);
    const [draftType, setDraftType] = useState(type);
    const [draftCategory, setDraftCategory] = useState(category);
    const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(dateTo);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container events-filters-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="transaction-filters-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="transaction-filters-title">
                            Advanced Filters
                        </h2>
                        <p className="modal-subtitle">
                            Narrow transactions by account, type, category, and date range.
                        </p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close filters">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-section">
                        <h3 className="form-section-title">Account</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="tx-filter-account">
                                Account
                            </label>
                            <select
                                id="tx-filter-account"
                                className="form-input"
                                value={draftAccountId}
                                onChange={(event) => setDraftAccountId(event.target.value)}
                            >
                                <option value="">All accounts</option>
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Type</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="tx-filter-type">
                                Transaction type
                            </label>
                            <select
                                id="tx-filter-type"
                                className="form-input"
                                value={draftType}
                                onChange={(event) => setDraftType(event.target.value)}
                            >
                                <option value="">All types</option>
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Category</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="tx-filter-category">
                                Category
                            </label>
                            <select
                                id="tx-filter-category"
                                className="form-input"
                                value={draftCategory}
                                onChange={(event) => setDraftCategory(event.target.value)}
                            >
                                <option value="">All categories</option>
                                {categories.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Date range</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="tx-filter-date-from">
                                    From
                                </label>
                                <DateInput
                                    id="tx-filter-date-from"
                                    value={draftDateFrom}
                                    onChange={(event) => setDraftDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="tx-filter-date-to">
                                    To
                                </label>
                                <DateInput
                                    id="tx-filter-date-to"
                                    value={draftDateTo}
                                    onChange={(event) => setDraftDateTo(event.target.value)}
                                />
                            </div>
                        </div>
                        <p className="form-hint-text">Filters by transaction date.</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setDraftAccountId('');
                            setDraftType('');
                            setDraftCategory('');
                            setDraftDateFrom('');
                            setDraftDateTo('');
                            onClear();
                        }}
                    >
                        Clear
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                            onApply({
                                accountId: draftAccountId,
                                type: draftType,
                                category: draftCategory,
                                dateFrom: draftDateFrom,
                                dateTo: draftDateTo,
                            })
                        }
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
}
