'use client';

import { useEffect, useMemo, useState } from 'react';
import { announcementsAPI } from '@/services/api';
import type { Id } from '@/types/backend-contracts';
import type { AvailabilityResponseLike } from '@/features/Announcements/announcementAvailability';

export interface TargetAvailabilityAnnouncement {
    id: number;
    title: string;
    targetType: string;
    eventId: number | null;
    projectId: number | null;
}

export interface TargetAvailabilityResponse extends AvailabilityResponseLike {
    memberId: number;
    notes?: string | null;
    periods?: Array<{ startDate: string; endDate: string }>;
}

type Target =
    | { eventId: Id | string; projectId?: never }
    | { projectId: Id | string; eventId?: never }
    | null
    | undefined;

function targetKey(target: Target): string | null {
    if (!target) return null;
    if ('eventId' in target && target.eventId != null && target.eventId !== '') {
        return `event:${target.eventId}`;
    }
    if ('projectId' in target && target.projectId != null && target.projectId !== '') {
        return `project:${target.projectId}`;
    }
    return null;
}

export function useTargetAvailability(target: Target) {
    const key = targetKey(target);
    const [announcement, setAnnouncement] = useState<TargetAvailabilityAnnouncement | null>(null);
    const [responses, setResponses] = useState<TargetAvailabilityResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!key || !target) {
            setAnnouncement(null);
            setResponses([]);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const query =
                    'eventId' in target && target.eventId != null
                        ? { eventId: target.eventId }
                        : { projectId: (target as { projectId: Id | string }).projectId };
                const data = await announcementsAPI.getAvailability(query);
                if (cancelled) return;
                setAnnouncement(data?.announcement ?? null);
                setResponses(Array.isArray(data?.responses) ? data.responses : []);
            } catch (err) {
                if (cancelled) return;
                setAnnouncement(null);
                setResponses([]);
                setError(err instanceof Error ? err.message : 'Failed to load availability');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [key]);

    const byMemberId = useMemo(() => {
        const map = new Map<number, TargetAvailabilityResponse>();
        for (const row of responses) {
            const id = Number(row.memberId);
            if (!Number.isNaN(id)) map.set(id, row);
        }
        return map;
    }, [responses]);

    return { announcement, responses, byMemberId, loading, error };
}
