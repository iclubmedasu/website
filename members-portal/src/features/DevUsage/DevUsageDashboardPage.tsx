'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLUB_TIMEZONE, formatDate } from '@iclub/shared/utils';
import {
    usageDashboardAPI,
    type UsageDashboardSummary,
} from '@/services/api';
import PeriodControl from '@/components/PeriodControl/PeriodControl';
import {
    resolvePeriodRange,
    type PeriodPreset,
    type PeriodRange,
} from '@/components/PeriodControl/periodRange';
import { exportUsageExcel } from './exportUsageExcel';
import '@/components/page/page.css';
import '@/components/cards/universalcard.css';
import '@/components/buttons/buttons.css';
import '@/components/errormsg/errormsg.css';
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

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function formatClubDay(day: string): string {
    return formatDate(`${day}T00:00:00.000Z`, { timeZone: CLUB_TIMEZONE });
}

export default function DevUsageDashboardPage() {
    const [summary, setSummary] = useState<UsageDashboardSummary | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const [preset, setPreset] = useState<PeriodPreset>('this_month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [lastRange, setLastRange] = useState<PeriodRange | null>(null);

    const range = useMemo(
        () => resolvePeriodRange(preset, customFrom, customTo),
        [preset, customFrom, customTo],
    );

    useEffect(() => {
        if (range) setLastRange(range);
    }, [range]);

    const displayRange = range ?? lastRange;

    const load = useCallback(async (nextRange: PeriodRange) => {
        setLoading(true);
        setError('');
        try {
            const data = await usageDashboardAPI.getSummary({
                from: nextRange.startDate,
                to: nextRange.endDate,
            });
            setSummary(data);
        } catch (err) {
            setSummary(null);
            setError(getErrorMessage(err, 'Failed to load usage summary'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!range) {
            // Incomplete/invalid custom range: keep previous data; do not fetch.
            setLoading(false);
            return;
        }
        void load(range);
    }, [range, load]);

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

    const seedCustomFromRange = (seed: PeriodRange | null) => {
        if (!seed) return;
        setCustomFrom(seed.startDate);
        setCustomTo(seed.endDate);
    };

    const handlePresetChange = (next: PeriodPreset) => {
        if (next === 'custom') {
            seedCustomFromRange(range ?? lastRange);
        }
        setPreset(next);
    };

    const retry = () => {
        const nextRange = range ?? lastRange ?? resolvePeriodRange('this_month');
        if (nextRange) {
            void load(nextRange);
        }
    };

    const periodLabel =
        displayRange != null
            ? `${formatClubDay(displayRange.startDate)} – ${formatClubDay(displayRange.endDate)}`
            : summary
              ? `${formatDate(summary.since, { timeZone: CLUB_TIMEZONE })} – ${formatDate(summary.until, { timeZone: CLUB_TIMEZONE })}`
              : null;

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
                                    disabled={loading || exporting || !displayRange}
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
                            <PeriodControl
                                preset={preset}
                                customFrom={customFrom}
                                customTo={customTo}
                                disabled={loading || exporting}
                                ariaLabel="Usage period"
                                onPresetChange={handlePresetChange}
                                onCustomFromChange={(value) => {
                                    setCustomFrom(value);
                                    setPreset('custom');
                                }}
                                onCustomToChange={(value) => {
                                    setCustomTo(value);
                                    setPreset('custom');
                                }}
                            />

                            {loading && !summary ? (
                                <p className="loading-message">Loading usage analytics…</p>
                            ) : null}

                            {error && summary ? <p className="error-message">{error}</p> : null}

                            {summary ? (
                                <>
                                    {periodLabel ? (
                                        <p className="dev-usage-period-meta">
                                            Period: {periodLabel}
                                            {summary.windowDays != null
                                                ? ` (${summary.windowDays} day${summary.windowDays === 1 ? '' : 's'})`
                                                : ''}
                                        </p>
                                    ) : null}
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
