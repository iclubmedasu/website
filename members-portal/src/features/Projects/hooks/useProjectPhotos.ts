'use client';

import { useCallback, useEffect, useState } from 'react';
import { projectPhotosAPI, type UpdateProjectPhotoPayload } from '@/services/api';
import type { Id, ProjectPhotoRef } from '@/types/backend-contracts';

export function useProjectPhotos(projectId: Id | string | null | undefined) {
    const [photos, setPhotos] = useState<ProjectPhotoRef[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (opts?: { silent?: boolean }) => {
        if (projectId == null || projectId === '') {
            setPhotos([]);
            setError(null);
            setLoading(false);
            return;
        }

        if (!opts?.silent) setLoading(true);
        setError(null);
        try {
            const list = await projectPhotosAPI.list(projectId);
            setPhotos(list);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load photos');
            setPhotos([]);
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const uploadPhoto = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void,
    ) => {
        const result = await projectPhotosAPI.upload(formData, onProgress);
        await refresh({ silent: true });
        return result;
    }, [refresh]);

    const updatePhoto = useCallback(async (id: Id | string, patch: UpdateProjectPhotoPayload) => {
        const result = await projectPhotosAPI.update(id, patch);
        setPhotos((prev) =>
            prev.map((photo) =>
                String(photo.id) === String(id) ? { ...photo, ...result } : photo,
            ),
        );
        return result;
    }, []);

    const deletePhoto = useCallback(async (id: Id | string) => {
        const result = await projectPhotosAPI.remove(id);
        await refresh({ silent: true });
        return result;
    }, [refresh]);

    const restorePhoto = useCallback(async (id: Id | string) => {
        const result = await projectPhotosAPI.restore(id);
        await refresh({ silent: true });
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

export type UseProjectPhotosReturn = ReturnType<typeof useProjectPhotos>;
