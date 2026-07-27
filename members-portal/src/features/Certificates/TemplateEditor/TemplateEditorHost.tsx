'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/services/api';
import {
    certificatesAPI,
    type BackgroundFocus,
} from '@/services/certificatesAPI';
import TemplateEditor, { type CanvasElement } from './TemplateEditor';

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function parseLayout(layout: unknown): CanvasElement[] {
    if (!Array.isArray(layout)) return [];
    return layout as CanvasElement[];
}

function parseBackgroundFocus(value: unknown): BackgroundFocus | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const scale = Number(raw.scale);
    const offsetX = Number(raw.offsetX);
    const offsetY = Number(raw.offsetY);
    if (![scale, offsetX, offsetY].every(Number.isFinite)) return null;
    return {
        scale: Math.max(1, scale),
        offsetX: Math.min(1, Math.max(0, offsetX)),
        offsetY: Math.min(1, Math.max(0, offsetY)),
    };
}

export interface TemplateEditorHostProps {
    mode: 'create' | 'edit';
    templateId?: number | null;
    nested?: boolean;
    onSaved: () => void;
}

export default function TemplateEditorHost({
    mode,
    templateId = null,
    nested = false,
    onSaved,
}: TemplateEditorHostProps) {
    const isEdit = mode === 'edit' && templateId != null;

    const [loading, setLoading] = useState(isEdit);
    const [error, setError] = useState<string | null>(null);
    const [readyKey, setReadyKey] = useState<string | null>(isEdit ? null : 'new');
    const [editorProps, setEditorProps] = useState({
        mode: (isEdit ? 'edit' : 'create') as 'create' | 'edit',
        initialTemplateId: null as number | null,
        initialName: '',
        initialElements: [] as CanvasElement[],
        initialCanvasWidth: 1122,
        initialCanvasHeight: 794,
        initialBackgroundImageUrl: null as string | null,
        initialBackgroundFocus: null as BackgroundFocus | null,
        hasIssuedCertificates: false,
    });

    useEffect(() => {
        if (!isEdit || templateId == null) {
            setLoading(false);
            setReadyKey('new');
            setEditorProps({
                mode: 'create',
                initialTemplateId: null,
                initialName: '',
                initialElements: [],
                initialCanvasWidth: 1122,
                initialCanvasHeight: 794,
                initialBackgroundImageUrl: null,
                initialBackgroundFocus: null,
                hasIssuedCertificates: false,
            });
            return;
        }

        let cancelled = false;
        /** Only revoke if we never handed the URL off to the editor. */
        let ownedBlobUrl: string | null = null;
        let handedOff = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const template = await certificatesAPI.getTemplate(templateId);
                let backgroundImageUrl: string | null = null;

                if (template.backgroundImagePath) {
                    const bgResponse = await apiFetch(
                        certificatesAPI.getTemplateBackgroundUrl(template.id),
                    );
                    if (!bgResponse.ok) {
                        throw new Error('Failed to load template background image');
                    }
                    const blob = await bgResponse.blob();
                    ownedBlobUrl = URL.createObjectURL(blob);
                    if (cancelled) {
                        URL.revokeObjectURL(ownedBlobUrl);
                        ownedBlobUrl = null;
                        return;
                    }
                    backgroundImageUrl = ownedBlobUrl;
                }

                if (cancelled) return;

                setEditorProps({
                    mode: 'edit',
                    initialTemplateId: template.id,
                    initialName: template.name,
                    initialElements: parseLayout(template.layout),
                    initialCanvasWidth: template.canvasWidth || 1122,
                    initialCanvasHeight: template.canvasHeight || 794,
                    initialBackgroundImageUrl: backgroundImageUrl,
                    initialBackgroundFocus: parseBackgroundFocus(template.backgroundFocus),
                    hasIssuedCertificates:
                        Boolean(template.hasIssuedCertificates) ||
                        (template.issuedCertificateCount ?? 0) > 0,
                });
                // Include bg token so remount picks up a fresh blob after Strict Mode / reload
                setReadyKey(
                    backgroundImageUrl
                        ? `${template.id}:bg:${Date.now()}`
                        : `${template.id}:${Date.now()}`,
                );
                handedOff = true;
                ownedBlobUrl = null;
            } catch (err) {
                if (!cancelled) {
                    setError(getErrorMessage(err, 'Failed to load template'));
                    setReadyKey(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
            if (!handedOff && ownedBlobUrl) {
                URL.revokeObjectURL(ownedBlobUrl);
            }
        };
    }, [isEdit, templateId]);

    if (loading) {
        return <p className="loading-message">Loading template editor…</p>;
    }

    if (error) {
        return <p className="error-message">{error}</p>;
    }

    if (!readyKey) {
        return null;
    }

    return (
        <TemplateEditor
            key={readyKey}
            {...editorProps}
            nested={nested}
            onSaved={onSaved}
        />
    );
}
