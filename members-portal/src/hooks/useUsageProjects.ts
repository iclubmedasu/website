'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    usageDashboardAPI,
    type UsageProjectListItem,
    type UsageProjectsOrgSummary,
} from '@/services/usageDashboardAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsageProjects(from: string | null, to: string | null, enabled = true) {
    const [projects, setProjects] = useState<UsageProjectListItem[]>([]);
    const [summary, setSummary] = useState<UsageProjectsOrgSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!enabled || !from || !to) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await usageDashboardAPI.getProjects({ from, to });
            setProjects(Array.isArray(response.projects) ? response.projects : []);
            setSummary(response.summary ?? null);
        } catch (err) {
            setProjects([]);
            setSummary(null);
            setError(getErrorMessage(err, 'Failed to load project usage'));
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

    return { projects, summary, isLoading, error, refetch };
}
