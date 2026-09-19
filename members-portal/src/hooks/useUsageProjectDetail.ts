'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageProjectDetailResponse,
} from '@/services/usageDashboardAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsageProjectDetail(
    projectId: string | null,
    from: string | null,
    to: string | null,
) {
    const [data, setData] = useState<UsageProjectDetailResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!projectId || !from || !to) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await usageDashboardAPI.getProject(projectId, { from, to });
            setData(response);
        } catch (err) {
            setData(null);
            setError(getErrorMessage(err, 'Failed to load project usage detail'));
        } finally {
            setIsLoading(false);
        }
    }, [projectId, from, to]);

    useEffect(() => {
        if (!projectId || !from || !to) {
            setIsLoading(false);
            return;
        }
        void refetch();
    }, [projectId, from, to, refetch]);

    return { data, isLoading, error, refetch };
}
