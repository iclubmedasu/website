'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageAnnouncementDetailResponse,
} from '@/services/usageDashboardAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsageAnnouncementDetail(
    announcementId: string | null,
    from: string | null,
    to: string | null,
) {
    const [data, setData] = useState<UsageAnnouncementDetailResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!announcementId || !from || !to) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await usageDashboardAPI.getAnnouncement(announcementId, {
                from,
                to,
            });
            setData(response);
        } catch (err) {
            setData(null);
            setError(getErrorMessage(err, 'Failed to load announcement usage detail'));
        } finally {
            setIsLoading(false);
        }
    }, [announcementId, from, to]);

    useEffect(() => {
        if (!announcementId || !from || !to) {
            setIsLoading(false);
            return;
        }
        void refetch();
    }, [announcementId, from, to, refetch]);

    return { data, isLoading, error, refetch };
}
