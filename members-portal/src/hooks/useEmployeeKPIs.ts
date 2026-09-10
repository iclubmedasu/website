'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    kpisAPI,
    type EmployeeKpiListItem,
    type EmployeeKpiOrgSummary,
} from '@/services/kpisAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useEmployeeKPIs(startDate: string | null, endDate: string | null) {
    const [data, setData] = useState<EmployeeKpiListItem[]>([]);
    const [summary, setSummary] = useState<EmployeeKpiOrgSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!startDate || !endDate) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await kpisAPI.getEmployees({ startDate, endDate });
            setData(Array.isArray(response.employees) ? response.employees : []);
            setSummary(response.summary ?? null);
        } catch (err) {
            setData([]);
            setSummary(null);
            setError(getErrorMessage(err, 'Failed to load employee KPIs'));
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (!startDate || !endDate) {
            setIsLoading(false);
            return;
        }
        void refetch();
    }, [startDate, endDate, refetch]);

    return { data, summary, isLoading, error, refetch };
}
