'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
    FinanceAccountSummary,
    FinanceDashboardResponse,
    FinanceLiabilityRow,
    FinanceScheduledItemRow,
    FinanceTransactionRow,
} from '@iclub/shared';
import { useAuth } from '@/context/AuthContext';
import { financeAPI } from '@/services/api';
import AccountBalancesSection from './components/AccountBalancesSection';
import FinanceChartsSection from './components/FinanceChartsSection';
import TransactionLogTable from './components/TransactionLogTable';
import LiabilitiesTracker from './components/LiabilitiesTracker';
import UpcomingScheduledList from './components/UpcomingScheduledList';
import { AccountFormModal } from './modals/AccountFormModal';
import { TransactionFormModal } from './modals/TransactionFormModal';
import { LiabilityFormModal } from './modals/LiabilityFormModal';
import { ScheduledItemFormModal } from './modals/ScheduledItemFormModal';
import { exportFinanceExcel } from './exportFinanceExcel';
import './FinanceDashboardPage.css';
import '@/components/cards/universalcard.css';
import '@/components/buttons/buttons.css';
import '@/components/input/input.css';
import '@/components/modal/modal.css';

type FinanceModalState =
    | { kind: 'account'; item?: FinanceAccountSummary }
    | { kind: 'transaction'; item?: FinanceTransactionRow }
    | { kind: 'liability'; item?: FinanceLiabilityRow }
    | { kind: 'scheduled'; item?: FinanceScheduledItemRow }
    | null;

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export default function FinanceDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const canViewFinance = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isFinanceViewer);

    const [dashboard, setDashboard] = useState<FinanceDashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState<FinanceModalState>(null);
    const [transactionsRefreshKey, setTransactionsRefreshKey] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await financeAPI.getDashboard();
            setDashboard(data);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load finance dashboard'));
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSaved = useCallback(async () => {
        setModal(null);
        await loadDashboard();
        setTransactionsRefreshKey((key) => key + 1);
    }, [loadDashboard]);

    const handleExport = useCallback(async () => {
        setExporting(true);
        setExportError('');
        try {
            const data = await financeAPI.exportData();
            await exportFinanceExcel(data);
        } catch (err) {
            setExportError(getErrorMessage(err, 'Failed to export finance data'));
        } finally {
            setExporting(false);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        if (!canViewFinance) {
            router.replace('/teams');
        }
    }, [user, canViewFinance, router]);

    useEffect(() => {
        if (!canViewFinance) return;
        void loadDashboard();
    }, [canViewFinance, loadDashboard]);

    if (!user || !canViewFinance) {
        return null;
    }

    return (
        <div className="members-page finance-page">
            <div className="page-header card-header-with-action">
                <h1 className="members-page-title members-page-title-inline">Finance</h1>
                <button
                    type="button"
                    className="btn btn-secondary finance-card-action"
                    onClick={() => void handleExport()}
                    disabled={exporting || loading}
                >
                    {exporting ? 'Exporting…' : 'Export Excel'}
                </button>
            </div>
            <hr className="title-divider" />

            {exportError ? <p className="error-message">{exportError}</p> : null}

            {loading ? (
                <p className="loading-message">Loading finance dashboard…</p>
            ) : error ? (
                <div className="card">
                    <div className="card-body">
                        <p className="error-message">{error}</p>
                        <button type="button" className="btn btn-primary" onClick={() => void loadDashboard()}>
                            Retry
                        </button>
                    </div>
                </div>
            ) : dashboard ? (
                <div className="finance-cards-stack">
                    <AccountBalancesSection
                        accounts={dashboard.accounts}
                        totalBalance={dashboard.totalBalance}
                        currency={dashboard.currency}
                        onAdd={() => setModal({ kind: 'account' })}
                        onEdit={(item) => setModal({ kind: 'account', item })}
                    />

                    <FinanceChartsSection
                        balanceOverTime={dashboard.balanceOverTime}
                        incomeVsExpenseByMonth={dashboard.incomeVsExpenseByMonth}
                        expenseByCategory={dashboard.expenseByCategory}
                        currency={dashboard.currency}
                    />

                    <TransactionLogTable
                        accounts={dashboard.accounts}
                        categories={dashboard.categories}
                        refreshKey={transactionsRefreshKey}
                        onAdd={() => setModal({ kind: 'transaction' })}
                        onEdit={(item) => setModal({ kind: 'transaction', item })}
                    />

                    <div className="finance-bottom-grid">
                        <LiabilitiesTracker
                            liabilities={dashboard.liabilities}
                            currency={dashboard.currency}
                            onAdd={() => setModal({ kind: 'liability' })}
                            onEdit={(item) => setModal({ kind: 'liability', item })}
                        />
                        <UpcomingScheduledList
                            items={dashboard.upcomingScheduledItems}
                            currency={dashboard.currency}
                            onAdd={() => setModal({ kind: 'scheduled' })}
                            onEdit={(item) => setModal({ kind: 'scheduled', item })}
                        />
                    </div>
                </div>
            ) : null}

            {modal?.kind === 'account' ? (
                <AccountFormModal
                    account={modal.item}
                    onClose={() => setModal(null)}
                    onSaved={() => void handleSaved()}
                />
            ) : null}

            {modal?.kind === 'transaction' && dashboard ? (
                <TransactionFormModal
                    transaction={modal.item}
                    accounts={dashboard.accounts}
                    categories={dashboard.categories}
                    onClose={() => setModal(null)}
                    onSaved={() => void handleSaved()}
                />
            ) : null}

            {modal?.kind === 'liability' && dashboard ? (
                <LiabilityFormModal
                    liability={modal.item}
                    accounts={dashboard.accounts}
                    onClose={() => setModal(null)}
                    onSaved={() => void handleSaved()}
                />
            ) : null}

            {modal?.kind === 'scheduled' && dashboard ? (
                <ScheduledItemFormModal
                    item={modal.item}
                    accounts={dashboard.accounts}
                    onClose={() => setModal(null)}
                    onSaved={() => void handleSaved()}
                />
            ) : null}
        </div>
    );
}
