import { useEffect, useRef, useState } from 'react';
import type { EmailOutboxBatchStatus } from '@/types/backend-contracts';
import { emailOutboxAPI } from '@/services/api';
import './BulkEmailProgressBanner.css';

export type BulkEmailProgressKind = 'ticket' | 'reminder' | 'certificate';

export type BulkEmailProgressBatch = {
    batchId: string;
    kind: BulkEmailProgressKind;
    skipped: number;
};

type BulkEmailProgressBannerProps = {
    batch: BulkEmailProgressBatch | null;
    onRefresh?: () => void;
    onComplete: (summary: string) => void;
};

const POLL_MS = 1500;

function kindLabel(kind: BulkEmailProgressKind, plural: boolean): string {
    if (kind === 'reminder') return plural ? 'reminders' : 'reminder';
    if (kind === 'certificate') return plural ? 'certificates' : 'certificate';
    return plural ? 'tickets' : 'ticket';
}

function formatFinalSummary(
    status: EmailOutboxBatchStatus,
    kind: BulkEmailProgressKind,
    skipped: number,
): string {
    const label = kindLabel(kind, status.sent !== 1);
    const parts = [
        `Sent ${status.sent} ${label}.`,
        status.failed > 0 ? `Failed: ${status.failed}.` : '',
        skipped > 0 ? `Skipped: ${skipped}.` : '',
        status.failed > 0
            ? 'Filter Not sent and resend to retry failures.'
            : '',
    ];
    return parts.filter(Boolean).join(' ');
}

export default function BulkEmailProgressBanner({
    batch,
    onRefresh,
    onComplete,
}: BulkEmailProgressBannerProps) {
    const [status, setStatus] = useState<EmailOutboxBatchStatus | null>(null);
    const completedRef = useRef<string | null>(null);
    const onCompleteRef = useRef(onComplete);
    const onRefreshRef = useRef(onRefresh);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!batch?.batchId) {
            setStatus(null);
            completedRef.current = null;
            return;
        }

        let cancelled = false;
        completedRef.current = null;

        const poll = async () => {
            try {
                const next = await emailOutboxAPI.getBatchStatus(batch.batchId);
                if (cancelled) return;
                setStatus(next);
                onRefreshRef.current?.();

                if (next.pending + next.processing === 0) {
                    if (completedRef.current === batch.batchId) return;
                    completedRef.current = batch.batchId;
                    onCompleteRef.current(formatFinalSummary(next, batch.kind, batch.skipped));
                }
            } catch {
                // Keep polling; transient network errors should not clear the banner.
            }
        };

        void poll();
        const timer = window.setInterval(() => {
            void poll();
        }, POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [batch?.batchId, batch?.kind, batch?.skipped]);

    if (!batch?.batchId || !status) {
        return null;
    }

    const done = status.sent + status.failed;
    const percent = status.total > 0 ? Math.min(100, Math.round((done / status.total) * 100)) : 0;
    const label = kindLabel(batch.kind, true);

    return (
        <div className="bulk-email-progress-banner" role="status" aria-live="polite">
            <div className="bulk-email-progress-banner__text">
                Sending {label} {done}/{status.total}…
            </div>
            <div
                className="bulk-email-progress-banner__track"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                role="progressbar"
            >
                <div
                    className="bulk-email-progress-banner__fill"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}
