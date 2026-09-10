'use client';

import { useCallback, useEffect, useState } from 'react';
import { kpisAPI, type EmployeeKpiDetailResponse } from '@/services/kpisAPI';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function useEmployeeKPIDetail(
    memberId: string | null,
    startDate: string | null,
    endDate: string | null,
) {
    const [data, setData] = useState<EmployeeKpiDetailResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!memberId || !startDate || !endDate) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await kpisAPI.getEmployee(memberId, { startDate, endDate });
            setData(response);
        } catch (err) {
            setData(null);
            setError(getErrorMessage(err, 'Failed to load employee KPI detail'));
        } finally {
            setIsLoading(false);
        }
    }, [memberId, startDate, endDate]);

    useEffect(() => {
        if (!memberId || !startDate || !endDate) {
            setIsLoading(false);
            return;
        }
        void refetch();
    }, [memberId, startDate, endDate, refetch]);

    return { data, isLoading, error, refetch };
}
