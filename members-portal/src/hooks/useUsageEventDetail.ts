'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageEventDetailResponse,
} from '@/services/usageDashboardAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsageEventDetail(
    eventId: string | null,
    from: string | null,
    to: string | null,
) {
    const [data, setData] = useState<UsageEventDetailResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!eventId || !from || !to) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await usageDashboardAPI.getEvent(eventId, { from, to });
            setData(response);
        } catch (err) {
            setData(null);
            setError(getErrorMessage(err, 'Failed to load event usage detail'));
        } finally {
            setIsLoading(false);
        }
    }, [eventId, from, to]);

    useEffect(() => {
        if (!eventId || !from || !to) {
            setIsLoading(false);
            return;
        }
        void refetch();
    }, [eventId, from, to, refetch]);

    return { data, isLoading, error, refetch };
}
