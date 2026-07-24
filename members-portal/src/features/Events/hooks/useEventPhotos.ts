'use client';

import { useCallback, useEffect, useState } from 'react';
import { eventPhotosAPI, type UpdateEventPhotoPayload } from '@/services/api';
import type { EventPhotoRef, Id } from '@/types/backend-contracts';

export interface EventPhotoDayGroup {
    eventDay: string | null;
    photos: EventPhotoRef[];
}

function normalizeEventDay(eventDay: EventPhotoRef['eventDay']): string | null {
    if (eventDay == null || eventDay === '') return null;
    return String(eventDay).slice(0, 10);
}

/** Group flat API list by day, preserving API order within and across groups. */
function groupPhotosByDay(photos: EventPhotoRef[]): EventPhotoDayGroup[] {
    const groups: EventPhotoDayGroup[] = [];
    const indexByDay = new Map<string | null, number>();

    for (const photo of photos) {
        const day = normalizeEventDay(photo.eventDay);
        let index = indexByDay.get(day);
        if (index === undefined) {
            index = groups.length;
            indexByDay.set(day, index);
            groups.push({ eventDay: day, photos: [] });
        }
        groups[index].photos.push(photo);
    }

    return groups;
}

export function useEventPhotos(eventId: Id | string | null | undefined) {
    const [photos, setPhotos] = useState<EventPhotoDayGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (opts?: { silent?: boolean }) => {
        if (eventId == null || eventId === '') {
            setPhotos([]);
            setError(null);
            setLoading(false);
            return;
        }

        if (!opts?.silent) setLoading(true);
        setError(null);
        try {
            const list = await eventPhotosAPI.list(eventId);
            setPhotos(groupPhotosByDay(list));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load photos');
            setPhotos([]);
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const uploadPhoto = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void,
    ) => {
        const result = await eventPhotosAPI.upload(formData, onProgress);
        await refresh({ silent: true });
        return result;
    }, [refresh]);

    const updatePhoto = useCallback(async (id: Id | string, patch: UpdateEventPhotoPayload) => {
        const result = await eventPhotosAPI.update(id, patch);
        await refresh();
        return result;
    }, [refresh]);

    const deletePhoto = useCallback(async (id: Id | string) => {
        const result = await eventPhotosAPI.remove(id);
        await refresh();
        return result;
    }, [refresh]);

    const restorePhoto = useCallback(async (id: Id | string) => {
        const result = await eventPhotosAPI.restore(id);
        await refresh();
        return result;
    }, [refresh]);

    return {
        photos,
        loading,
        error,
        uploadPhoto,
        updatePhoto,
        deletePhoto,
        restorePhoto,
        refresh,
    };
}

export type UseEventPhotosReturn = ReturnType<typeof useEventPhotos>;
