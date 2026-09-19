'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageAnnouncementListItem,
    type UsageAnnouncementsOrgSummary,
} from '@/services/usageDashboardAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsageAnnouncements(from: string | null, to: string | null, enabled = true) {
    const [announcements, setAnnouncements] = useState<UsageAnnouncementListItem[]>([]);
    const [summary, setSummary] = useState<UsageAnnouncementsOrgSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!enabled || !from || !to) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await usageDashboardAPI.getAnnouncements({ from, to });
            setAnnouncements(Array.isArray(response.announcements) ? response.announcements : []);
            setSummary(response.summary ?? null);
        } catch (err) {
            setAnnouncements([]);
            setSummary(null);
            setError(getErrorMessage(err, 'Failed to load announcement usage'));
        } finally {
            setIsLoading(false);
        }
    }, [enabled, from, to]);

    useEffect(() => {
        if (!enabled || !from || !to) {
            setIsLoading(false);
            return;
        }
        void refetch();
    }, [enabled, from, to, refetch]);

    return { announcements, summary, isLoading, error, refetch };
}
