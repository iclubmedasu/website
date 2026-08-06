'use client';

import { useEffect, useState } from 'react';
import { apiFetch, eventsAPI } from '@/services/api';
import type { Id } from '@/types/backend-contracts';

export function useAuthorizedIdCardBackground(
    eventId: Id | string,
    hasImage: boolean,
    cacheKey: string | null | undefined,
): string | null {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let createdUrl: string | null = null;
        setObjectUrl(null);

        if (!hasImage) return undefined;

        void (async () => {
            try {
                const response = await apiFetch(
                    eventsAPI.getIdCardBackgroundDownloadUrl(eventId),
                );
                if (!response.ok || cancelled) return;
                const blob = await response.blob();
                if (cancelled) return;
                createdUrl = URL.createObjectURL(blob);
                setObjectUrl(createdUrl);
            } catch {
                // Leave background empty on fetch failure.
            }
        })();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [cacheKey, eventId, hasImage]);

    return objectUrl;
}
