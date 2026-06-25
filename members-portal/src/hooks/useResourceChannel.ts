'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOptionalRealtimeContext } from '@/context/RealtimeContext';
import type { NotificationRealtimeMessage, RealtimeResourceType } from '@/types/backend-contracts';

interface UseResourceChannelOptions {
    resource: RealtimeResourceType;
    resourceId: string | number | null | undefined;
    enabled?: boolean;
    onRefresh: () => void;
    debounceMs?: number;
}

export function useResourceChannel({
    resource,
    resourceId,
    enabled = true,
    onRefresh,
    debounceMs = 400,
}: UseResourceChannelOptions): void {
    const { user } = useAuth();
    const realtime = useOptionalRealtimeContext();
    const onRefreshRef = useRef(onRefresh);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    const scheduleRefresh = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            onRefreshRef.current();
        }, debounceMs);
    }, [debounceMs]);

    useEffect(() => {
        if (!enabled || !realtime || resourceId == null || resourceId === '') {
            return;
        }

        const topic = `${resource}:${resourceId}`;
        return realtime.subscribe(topic, (message: NotificationRealtimeMessage) => {
            if (message.type !== 'resource.changed') return;
            const actorId = message.actorMemberId != null ? String(message.actorMemberId) : null;
            const currentMemberId = user?.id != null ? String(user.id) : null;
            if (actorId && currentMemberId && actorId === currentMemberId) {
                return;
            }
            scheduleRefresh();
        });
    }, [enabled, realtime, resource, resourceId, scheduleRefresh, user?.id]);

    useEffect(() => {
        if (!enabled || resourceId == null || resourceId === '') return;

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                scheduleRefresh();
            }
        };

        window.addEventListener('focus', scheduleRefresh);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', scheduleRefresh);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [enabled, resourceId, scheduleRefresh]);
}
