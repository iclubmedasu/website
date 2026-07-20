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
        const currentMemberId = user?.id != null ? String(user.id) : null;
        const localInstanceId = realtime.clientInstanceId;

        const unsubscribeTopic = realtime.subscribe(topic, (message: NotificationRealtimeMessage) => {
            if (message.type !== 'resource.changed') return;
            const actorId = message.actorMemberId != null ? String(message.actorMemberId) : null;
            const messageInstanceId = message.clientInstanceId ?? null;
            // Suppress only the acting tab's own echo. Same member on another device/tab
            // (or messages without clientInstanceId) still refresh.
            if (
                actorId
                && currentMemberId
                && actorId === currentMemberId
                && messageInstanceId
                && localInstanceId
                && messageInstanceId === localInstanceId
            ) {
                return;
            }
            scheduleRefresh();
        });

        const unsubscribeReconnect = realtime.onReconnect(() => {
            scheduleRefresh();
        });

        return () => {
            unsubscribeTopic();
            unsubscribeReconnect();
        };
    }, [enabled, realtime, resource, resourceId, scheduleRefresh, user?.id]);

    useEffect(() => {
        if (!enabled || resourceId == null || resourceId === '') return;

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                scheduleRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [enabled, resourceId, scheduleRefresh]);
}
