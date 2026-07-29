'use client';

import { useCallback, useEffect, useState } from 'react';
import { announcementsAPI } from '@/services/api';

export function useAnnouncements(includeInactive = false) {
    const [announcements, setAnnouncements] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await announcementsAPI.getAll(
                includeInactive ? { includeInactive: true } : undefined,
            );
            setAnnouncements(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load announcements');
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { announcements, loading, error, refetch };
}
