'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter, Pencil, Plus, Search } from 'lucide-react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type SortingState,
} from '@tanstack/react-table';
import type {
    FinanceAccountSummary,
    FinanceTransactionFilters,
    FinanceTransactionRow,
    FinanceTransactionType,
} from '@iclub/shared';
import { formatDate } from '@iclub/shared/utils';
import { financeAPI } from '@/services/api';
import TransactionFiltersModal, {
    type TransactionFiltersState,
} from '../modals/TransactionFiltersModal';
import '@/features/Projects/ProjectsPage.css';
import '@/components/SearchField/SearchField.css';
import '@/components/modal/modal.css';
import '@/components/input/input.css';

interface TransactionLogTableProps {
    accounts: FinanceAccountSummary[];
    categories: string[];
    refreshKey?: number;
    onAdd?: () => void;
    onEdit?: (transaction: FinanceTransactionRow) => void;
}

type PageNumberToken = number | '...';

const ROWS_PER_PAGE = 10;
const columnHelper = createColumnHelper<FinanceTransactionRow>();

function formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-EG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function getPageNumbers(current: number, total: number): PageNumberToken[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: PageNumberToken[] = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

export default function TransactionLogTable({
    accounts,
    categories,
    refreshKey = 0,
    onAdd,
    onEdit,
}: TransactionLogTableProps) {
    const [rows, setRows] = useState<FinanceTransactionRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sorting, setSorting] = useState<SortingState>([{ id: 'transactionDate', desc: true }]);

    const [accountId, setAccountId] = useState('');
    const [type, setType] = useState('');
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);

    const hasActiveFilters = Boolean(accountId || type || category || dateFrom || dateTo);

    const filters = useMemo<FinanceTransactionFilters>(() => ({
        accountId: accountId ? Number(accountId) : undefined,
        type: (type || undefined) as FinanceTransactionType | undefined,
        category: category || undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: ROWS_PER_PAGE,
    }), [accountId, type, category, search, dateFrom, dateTo, page]);

    const handleApplyFilters = (next: TransactionFiltersState) => {
        setAccountId(next.accountId);
        setType(next.type);
        setCategory(next.category);
        setDateFrom(next.dateFrom);
        setDateTo(next.dateTo);
        setPage(1);
        setFiltersOpen(false);
    };

    const handleClearFilters = () => {
        setAccountId('');
        setType('');
        setCategory('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
        setFiltersOpen(false);
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void (async () => {
                setLoading(true);
                setError('');
                try {
                    const result = await financeAPI.getTransactions(filters);
                    setRows(result.items);
                    setTotal(result.total);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to load transactions');
                } finally {
                    setLoading(false);
                }
            })();
        }, 250);

        return () => window.clearTimeout(timer);
    }, [filters, refreshKey]);

    const columns = useMemo(
        () => [
            columnHelper.accessor('transactionDate', {
                header: 'Date',
                cell: (info) => formatDate(info.getValue()),
            }),
            columnHelper.accessor('accountName', {
                header: 'Account',
            }),
            columnHelper.accessor('type', {
                header: 'Type',
                cell: (info) => (
                    <span className={`finance-tx-type finance-tx-type-${info.getValue().toLowerCase()}`}>
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor('category', {
                header: 'Category',
            }),
            columnHelper.accessor('description', {
                header: 'Description',
                cell: (info) => info.getValue() || '—',
            }),
            columnHelper.accessor('amount', {
                header: 'Amount',
                cell: (info) => {
                    const row = info.row.original;
                    const signed = row.type === 'EXPENSE' ? -info.getValue() : info.getValue();
                    return (
                        <span className={signed < 0 ? 'finance-amount-expense' : 'finance-amount-income'}>
                            {formatMoney(Math.abs(info.getValue()))}
                        </span>
                    );
                },
            }),
            ...(onEdit
                ? [
                    columnHelper.display({
                        id: 'actions',
                        header: 'Actions',
                        cell: (info) => (
                            <button
                                type="button"
                                className="table-action-btn edit-btn"
                                onClick={() => onEdit(info.row.original)}
                                aria-label="Edit transaction"
                            >
                                <Pencil size={16} />
                            </button>
                        ),
                    }),
                ]
                : []),
        ],
        [onEdit],
    );

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

    return (
        <div className="card members-table-card">
            <div className="card-header">
                <div className="card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Transactions</h3>
                    </div>
                    {onAdd ? (
                        <button
                            type="button"
                            className="card-add-btn"
                            onClick={onAdd}
                            title="Add transaction"
                            aria-label="Add transaction"
                        >
                            <Plus />
                        </button>
                    ) : null}
                </div>
                <p className="card-subtitle">{total} total</p>
            </div>
            <div className="card-body">
                <div className="page-search-row">
                    <div className="page-search-field page-search-field--full">
                        <Search className="page-search-icon" size={16} />
                        <input
                            className="page-search-input"
                            placeholder="Search description, category, reference"
                            value={search}
                            onChange={(e) => {
                                setPage(1);
                                setSearch(e.target.value);
                            }}
                            aria-label="Search transactions"
                        />
                        <button
                            type="button"
                            className={`page-search-filter-btn${hasActiveFilters ? ' page-search-filter-btn--active' : ''}`}
                            onClick={() => setFiltersOpen(true)}
                        >
                            <Filter size={16} />
                            <span className="page-search-filter-label">Advanced Filters</span>
                        </button>
                    </div>
                </div>

                {error ? <p className="error-message">{error}</p> : null}

                {loading ? (
                    <p className="loading-message">Loading transactions…</p>
                ) : (
                    <div className="members-table-shell">
                        {rows.length === 0 ? (
                            <p className="empty-message">No transactions found.</p>
                        ) : (
                            <div className="table-container">
                                <table className="members-table">
                                    <thead>
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <tr key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <th key={header.id}>
                                                        {header.isPlaceholder ? null : (
                                                            <button
                                                                type="button"
                                                                className="finance-table-sort"
                                                                onClick={header.column.getToggleSortingHandler()}
                                                            >
                                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                                {{
                                                                    asc: ' ↑',
                                                                    desc: ' ↓',
                                                                }[header.column.getIsSorted() as string] ?? ''}
                                                            </button>
                                                        )}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody>
                                        {table.getRowModel().rows.map((row, index) => (
                                            <tr key={row.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                                {row.getVisibleCells().map((cell) => (
                                                    <td key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            type="button"
                            className="pagination-btn"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            Previous
                        </button>
                        <div className="pagination-pages">
                            {getPageNumbers(page, totalPages).map((pageNumber, index) =>
                                pageNumber === '...' ? (
                                    <span key={`ellipsis-${index}`} className="pagination-ellipsis">…</span>
                                ) : (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        className={`pagination-page-btn${pageNumber === page ? ' pagination-page-btn--active' : ''}`}
                                        onClick={() => setPage(pageNumber)}
                                    >
                                        {pageNumber}
                                    </button>
                                ),
                            )}
                        </div>
                        <button
                            type="button"
                            className="pagination-btn"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {filtersOpen ? (
                <TransactionFiltersModal
                    accountId={accountId}
                    type={type}
                    category={category}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    accounts={accounts}
                    categories={categories}
                    onClose={() => setFiltersOpen(false)}
                    onApply={handleApplyFilters}
                    onClear={handleClearFilters}
                />
            ) : null}
        </div>
    );
}
