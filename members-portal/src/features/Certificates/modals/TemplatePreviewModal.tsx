'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/services/api';
import {
    certificatesAPI,
    type BackgroundFocus,
    type CertificateTemplate,
} from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';
import {
    previewTextFor,
    type CanvasElement,
} from '../TemplateEditor/TemplateEditor';
import './TemplatePreviewModal.css';

const DEFAULT_FOCUS: BackgroundFocus = { scale: 1, offsetX: 0.5, offsetY: 0.5 };

function parseLayout(layout: unknown): CanvasElement[] {
    if (!Array.isArray(layout)) return [];
    return layout as CanvasElement[];
}

function parseBackgroundFocus(value: unknown): BackgroundFocus {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...DEFAULT_FOCUS };
    }
    const raw = value as Record<string, unknown>;
    const scale = Number(raw.scale);
    const offsetX = Number(raw.offsetX);
    const offsetY = Number(raw.offsetY);
    if (![scale, offsetX, offsetY].every(Number.isFinite)) {
        return { ...DEFAULT_FOCUS };
    }
    return {
        scale: Math.max(1, scale),
        offsetX: Math.min(1, Math.max(0, offsetX)),
        offsetY: Math.min(1, Math.max(0, offsetY)),
    };
}

function getPanExtents(
    focus: BackgroundFocus,
    natural: { w: number; h: number } | null,
    cw: number,
    ch: number,
) {
    if (!natural || natural.w <= 0 || natural.h <= 0) {
        return { scaledW: cw, scaledH: ch, left: 0, top: 0 };
    }
    const coverScale = Math.max(cw / natural.w, ch / natural.h);
    const totalScale = coverScale * focus.scale;
    const scaledW = natural.w * totalScale;
    const scaledH = natural.h * totalScale;
    const maxX = Math.max(0, scaledW - cw);
    const maxY = Math.max(0, scaledH - ch);
    return {
        scaledW,
        scaledH,
        left: -maxX * focus.offsetX,
        top: -maxY * focus.offsetY,
    };
}

interface TemplatePreviewModalProps {
    templateId: Id | null;
    onClose: () => void;
}

export default function TemplatePreviewModal({ templateId, onClose }: TemplatePreviewModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [template, setTemplate] = useState<CertificateTemplate | null>(null);
    const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

    useEffect(() => {
        if (templateId == null) {
            setTemplate(null);
            setBackgroundUrl(null);
            setNaturalSize(null);
            setError(null);
            return;
        }

        let cancelled = false;
        let ownedBlobUrl: string | null = null;
        let handedOff = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            setNaturalSize(null);
            try {
                const data = await certificatesAPI.getTemplate(templateId);
                let bgUrl: string | null = null;
                if (data.backgroundImagePath) {
                    const bgResponse = await apiFetch(
                        certificatesAPI.getTemplateBackgroundUrl(data.id),
                    );
                    if (!bgResponse.ok) {
                        throw new Error('Failed to load template background');
                    }
                    const blob = await bgResponse.blob();
                    ownedBlobUrl = URL.createObjectURL(blob);
                    if (cancelled) {
                        URL.revokeObjectURL(ownedBlobUrl);
                        ownedBlobUrl = null;
                        return;
                    }
                    bgUrl = ownedBlobUrl;
                }
                if (cancelled) return;
                setTemplate(data);
                setBackgroundUrl(bgUrl);
                handedOff = true;
                ownedBlobUrl = null;
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load template preview');
                    setTemplate(null);
                    setBackgroundUrl(null);
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
    }, [templateId]);

    useEffect(() => {
        return () => {
            if (backgroundUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(backgroundUrl);
            }
        };
    }, [backgroundUrl]);

    const elements = useMemo(
        () => (template ? parseLayout(template.layout) : []),
        [template],
    );
    const focus = useMemo(
        () => (template ? parseBackgroundFocus(template.backgroundFocus) : DEFAULT_FOCUS),
        [template],
    );

    if (templateId == null) return null;

    const canvasWidth = template?.canvasWidth || 1122;
    const canvasHeight = template?.canvasHeight || 794;
    const fitScale = Math.min(1, Math.min(720 / canvasWidth, 480 / canvasHeight));

    const bgStyle = (): CSSProperties => {
        if (!naturalSize) {
            return {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${focus.offsetX * 100}% ${focus.offsetY * 100}%`,
                transform: focus.scale > 1 ? `scale(${focus.scale})` : undefined,
                transformOrigin: `${focus.offsetX * 100}% ${focus.offsetY * 100}%`,
                pointerEvents: 'none',
                userSelect: 'none',
            };
        }
        const { scaledW, scaledH, left, top } = getPanExtents(
            focus,
            naturalSize,
            canvasWidth,
            canvasHeight,
        );
        return {
            position: 'absolute',
            left,
            top,
            width: scaledW,
            height: scaledH,
            maxWidth: 'none',
            pointerEvents: 'none',
            userSelect: 'none',
        };
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container template-preview-modal" role="dialog" aria-modal="true">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <h2 className="modal-title">
                            {template ? `Preview: ${template.name}` : 'Template Preview'}
                        </h2>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>
                <div className="modal-body template-preview-modal-body">
                    {loading && <p className="loading-message">Loading preview…</p>}
                    {error && <div className="error-message">{error}</div>}
                    {!loading && !error && template && (
                        <div className="template-preview-viewport">
                            <div
                                className="template-preview-scale-wrap"
                                style={{
                                    width: canvasWidth * fitScale,
                                    height: canvasHeight * fitScale,
                                }}
                            >
                                <div
                                    className="template-preview-canvas"
                                    style={{
                                        width: canvasWidth,
                                        height: canvasHeight,
                                        transform: `scale(${fitScale})`,
                                    }}
                                >
                                    {backgroundUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={backgroundUrl}
                                            alt=""
                                            className="template-preview-bg"
                                            draggable={false}
                                            style={bgStyle()}
                                            onLoad={(e) => {
                                                const w = e.currentTarget.naturalWidth;
                                                const h = e.currentTarget.naturalHeight;
                                                if (w > 0 && h > 0) setNaturalSize({ w, h });
                                            }}
                                        />
                                    ) : (
                                        <div className="template-preview-bg-placeholder" />
                                    )}
                                    {elements.map((element) => (
                                        <div
                                            key={element.id}
                                            className={`template-preview-element template-preview-element--align-${element.align}`}
                                            style={{
                                                left: element.x,
                                                top: element.y,
                                                width: element.width,
                                                height: element.height,
                                                fontSize: element.fontSize,
                                                fontWeight: element.fontWeight,
                                                textAlign: element.align,
                                                color: element.color,
                                            }}
                                        >
                                            {previewTextFor(element)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {!loading && !error && template && (
                        <p className="template-preview-caption">
                            Sample data preview ({canvasWidth}×{canvasHeight}px)
                        </p>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </>
    );
}
