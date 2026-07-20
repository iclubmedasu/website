'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/services/api';
import {
    certificatesAPI,
    type BackgroundFocus,
} from '@/services/certificatesAPI';
import TemplateEditor, {
    type CanvasElement,
} from './TemplateEditor';

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

export default function TemplateEditorPage() {
    const params = useParams<{ id?: string }>();
    const routeId = params?.id;
    const isEdit = typeof routeId === 'string' && routeId.length > 0 && routeId !== 'new';

    const [loading, setLoading] = useState(isEdit);
    const [error, setError] = useState<string | null>(null);
    const [readyKey, setReadyKey] = useState(isEdit ? null : 'new');
    const [editorProps, setEditorProps] = useState({
        mode: (isEdit ? 'edit' : 'create') as 'create' | 'edit',
        initialTemplateId: null as number | null,
        initialName: '',
        initialElements: [] as CanvasElement[],
        initialCanvasWidth: 1122,
        initialCanvasHeight: 794,
        initialBackgroundImageUrl: null as string | null,
        initialBackgroundFocus: null as BackgroundFocus | null,
    });

    useEffect(() => {
        if (!isEdit || !routeId) {
            setLoading(false);
            setReadyKey('new');
            return;
        }

        let cancelled = false;
        let loadedBlobUrl: string | null = null;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const template = await certificatesAPI.getTemplate(routeId);
                let backgroundImageUrl: string | null = null;

                if (template.backgroundImagePath) {
                    const bgResponse = await apiFetch(
                        certificatesAPI.getTemplateBackgroundUrl(template.id),
                    );
                    if (bgResponse.ok) {
                        const blob = await bgResponse.blob();
                        loadedBlobUrl = URL.createObjectURL(blob);
                        if (cancelled) {
                            URL.revokeObjectURL(loadedBlobUrl);
                            loadedBlobUrl = null;
                            return;
                        }
                        backgroundImageUrl = loadedBlobUrl;
                    }
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
                });
                setReadyKey(String(template.id));
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
            if (loadedBlobUrl) URL.revokeObjectURL(loadedBlobUrl);
        };
    }, [isEdit, routeId]);

    if (loading) {
        return (
            <div className="certificates-page">
                <p className="loading-message">Loading template editor…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="certificates-page">
                <div className="page-header">
                    <h1 className="members-page-title members-page-title-inline">
                        Edit Template
                    </h1>
                    <div className="page-header-actions">
                        <Link href="/certificates" className="btn btn-secondary">
                            <ArrowLeft size={16} />
                            Back to Certificates
                        </Link>
                    </div>
                </div>
                <hr className="title-divider" />
                <p className="error-message">{error}</p>
            </div>
        );
    }

    if (!readyKey) {
        return null;
    }

    return (
        <div className="certificates-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">
                    {editorProps.mode === 'edit' ? 'Edit Template' : 'New Template'}
                </h1>
                <div className="page-header-actions">
                    <Link href="/certificates" className="btn btn-secondary">
                        <ArrowLeft size={16} />
                        Back to Certificates
                    </Link>
                </div>
            </div>
            <hr className="title-divider" />
            <TemplateEditor key={readyKey} {...editorProps} />
        </div>
    );
}
