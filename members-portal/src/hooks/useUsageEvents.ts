'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageEventListItem,
    type UsageEventsOrgSummary,
} from '@/services/usageDashboardAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsageEvents(from: string | null, to: string | null, enabled = true) {
    const [events, setEvents] = useState<UsageEventListItem[]>([]);
    const [summary, setSummary] = useState<UsageEventsOrgSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!enabled || !from || !to) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await usageDashboardAPI.getEvents({ from, to });
            setEvents(Array.isArray(response.events) ? response.events : []);
            setSummary(response.summary ?? null);
        } catch (err) {
            setEvents([]);
            setSummary(null);
            setError(getErrorMessage(err, 'Failed to load event usage'));
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

    return { events, summary, isLoading, error, refetch };
}
