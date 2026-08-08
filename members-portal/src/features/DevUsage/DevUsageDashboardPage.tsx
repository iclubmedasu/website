'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageDashboardSummary,
    type UsageDashboardSummaryParams,
} from '@/services/api';
import { exportUsageExcel } from './exportUsageExcel';
import { DateInput } from '@/components/input/DateInput';
import '@/components/page/page.css';
import '@/components/cards/universalcard.css';
import '@/components/buttons/buttons.css';
import '@/components/errormsg/errormsg.css';
import '@/components/input/input.css';
import '@/features/Finance/FinanceDashboardPage.css';
import './DevUsageDashboardPage.css';

const STATS: { key: keyof UsageDashboardSummary['counts']; label: string }[] = [
    { key: 'eventsCreated', label: 'Events created' },
    { key: 'certificatesIssued', label: 'Certificates issued' },
    { key: 'checkInsScanned', label: 'Check-ins scanned' },
    { key: 'registrationsCreated', label: 'Registrations created' },
    { key: 'dataExports', label: 'Data exports' },
    { key: 'logins', label: 'Logins' },
    { key: 'activeMembers', label: 'Active members (logins)' },
];

const PRESETS = [7, 30, 90] as const;

type PeriodMode = 'preset' | 'custom';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function formatPeriodBound(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            dateStyle: 'medium',
        });
    } catch {
        return iso;
    }
}

/**
 * Resolve the query for the next fetch.
 * Incomplete custom dates → null (keep current summary, do not fetch/error).
 * Invalid range (from > to) → 'invalid-range' (inline message only).
 */
function resolveFetchParams(
    periodMode: PeriodMode,
    presetDays: number,
    customFrom: string,
    customTo: string,
): UsageDashboardSummaryParams | 'invalid-range' | null {
    if (periodMode === 'custom') {
        if (!customFrom || !customTo) {
            return null;
        }
        if (customFrom > customTo) {
            return 'invalid-range';
        }
        return { from: customFrom, to: customTo };
    }
    return { days: presetDays };
}

export default function DevUsageDashboardPage() {
    const [summary, setSummary] = useState<UsageDashboardSummary | null>(null);
    const [error, setError] = useState('');
    const [rangeHint, setRangeHint] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const [periodMode, setPeriodMode] = useState<PeriodMode>('preset');
    const [presetDays, setPresetDays] = useState<number>(30);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchParams = useMemo(
        () => resolveFetchParams(periodMode, presetDays, customFrom, customTo),
        [periodMode, presetDays, customFrom, customTo],
    );

    const load = useCallback(async (params: UsageDashboardSummaryParams) => {
        setLoading(true);
        setError('');
        setRangeHint('');
        try {
            const data = await usageDashboardAPI.getSummary(params);
            setSummary(data);
        } catch (err) {
            setSummary(null);
            setError(getErrorMessage(err, 'Failed to load usage summary'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (fetchParams === null) {
            // Incomplete custom range: wait for the other date; keep previous data.
            setLoading(false);
            setRangeHint('');
            return;
        }
        if (fetchParams === 'invalid-range') {
            setLoading(false);
            setRangeHint('From must be on or before To.');
            return;
        }
        void load(fetchParams);
    }, [fetchParams, load]);

    const handleExport = useCallback(async () => {
        if (!summary) return;
        setExporting(true);
        setExportError('');
        try {
            await exportUsageExcel(summary);
        } catch (err) {
            setExportError(getErrorMessage(err, 'Failed to export usage analytics'));
        } finally {
            setExporting(false);
        }
    }, [summary]);

    const selectPreset = (days: number) => {
        setPeriodMode('preset');
        setPresetDays(days);
        setRangeHint('');
    };

    const onCustomFromChange = (value: string) => {
        setCustomFrom(value);
        setPeriodMode('custom');
    };

    const onCustomToChange = (value: string) => {
        setCustomTo(value);
        setPeriodMode('custom');
    };

    const retry = () => {
        const params = resolveFetchParams(periodMode, presetDays, customFrom, customTo);
        if (params && params !== 'invalid-range') {
            void load(params);
        } else {
            // Fall back to last preset so Retry always works
            void load({ days: presetDays });
        }
    };

    return (
        <div className="members-page dev-usage-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Usage analytics</h1>
            </div>
            <hr className="title-divider" />

            {exportError ? <p className="error-message">{exportError}</p> : null}

            {error && !loading && !summary ? (
                <div className="card">
                    <div className="card-body">
                        <p className="error-message">{error}</p>
                        <button type="button" className="btn btn-primary" onClick={retry}>
                            Retry
                        </button>
                    </div>
                </div>
            ) : (
                <div className="finance-cards-stack">
                    <div className="card">
                        <div className="card-header card-header-with-action">
                            <div className="card-header-left">
                                <h3 className="card-title">Overview</h3>
                            </div>
                            <div className="dev-usage-card-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary finance-card-action"
                                    onClick={retry}
                                    disabled={loading || exporting}
                                >
                                    {loading ? 'Refreshing…' : 'Refresh'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary finance-card-action"
                                    onClick={() => void handleExport()}
                                    disabled={exporting || loading || !summary}
                                >
                                    {exporting ? 'Exporting…' : 'Export Excel'}
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="dev-usage-period-row">
                                <div className="dev-usage-preset-group" role="group" aria-label="Period presets">
                                    {PRESETS.map((days) => (
                                        <button
                                            key={days}
                                            type="button"
                                            className={`btn btn-secondary finance-card-action${
                                                periodMode === 'preset' && presetDays === days
                                                    ? ' dev-usage-preset--active'
                                                    : ''
                                            }`}
                                            onClick={() => selectPreset(days)}
                                            disabled={loading}
                                        >
                                            {days} days
                                        </button>
                                    ))}
                                </div>
                                <div className="finance-filters dev-usage-custom-dates">
                                    <label className="form-group">
                                        <span className="form-label">From</span>
                                        <DateInput
                                            value={customFrom}
                                            disabled={loading}
                                            onChange={(e) => onCustomFromChange(e.target.value)}
                                        />
                                    </label>
                                    <label className="form-group">
                                        <span className="form-label">To</span>
                                        <DateInput
                                            value={customTo}
                                            disabled={loading}
                                            onChange={(e) => onCustomToChange(e.target.value)}
                                        />
                                    </label>
                                </div>
                            </div>

                            {rangeHint ? <p className="error-message">{rangeHint}</p> : null}

                            {loading && !summary ? (
                                <p className="loading-message">Loading usage analytics…</p>
                            ) : null}

                            {error && summary ? <p className="error-message">{error}</p> : null}

                            {summary ? (
                                <>
                                    <p className="dev-usage-period-meta">
                                        Period: {formatPeriodBound(summary.since)} – {formatPeriodBound(summary.until)}
                                        {' '}({summary.windowDays} day{summary.windowDays === 1 ? '' : 's'})
                                    </p>
                                    <div className="dashboard-stats-grid">
                                        {STATS.map((stat) => (
                                            <div key={stat.key} className="dashboard-stat-tile">
                                                <p className="dashboard-stat-label">{stat.label}</p>
                                                <p className="dashboard-stat-value">{summary.counts[stat.key]}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
