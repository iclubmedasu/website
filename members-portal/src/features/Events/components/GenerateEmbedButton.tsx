'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Code2, Copy, X } from 'lucide-react';
import { DEFAULT_TICKET_ACCENT, normalizeHex } from '@iclub/shared/utils';
import { buildRegistrationEmbedSnippet } from '@/lib/publicWebsiteUrl';
import './EventExpandedContent/sections/TicketDesign/TicketDesignPanel.css';
import './GenerateEmbedButton.css';

/** Default embed accent; matches design token --purple-600. */
const DEFAULT_EMBED_ACCENT = '#9063b3';

interface GenerateEmbedButtonProps {
    eventSlug: string;
    isPublished?: boolean;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through
        }
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}

type LayoutPreset = 'default' | 'compact' | 'spacious';

export default function GenerateEmbedButton({
    eventSlug,
    isPublished = false,
}: GenerateEmbedButtonProps) {
    const titleId = useId();
    const [open, setOpen] = useState(false);
    const [primaryColor, setPrimaryColor] = useState(DEFAULT_TICKET_ACCENT);
    const [accentColor, setAccentColor] = useState(DEFAULT_EMBED_ACCENT);
    const [borderRadius, setBorderRadius] = useState('16px');
    const [fontFamily, setFontFamily] = useState('');
    const [layout, setLayout] = useState<LayoutPreset>('default');
    const [customCssUrl, setCustomCssUrl] = useState('');
    const [snippet, setSnippet] = useState('');
    const [building, setBuilding] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const rebuildSnippet = useCallback(async () => {
        setBuilding(true);
        setError('');
        try {
            const primary = normalizeHex(primaryColor) ?? (primaryColor.trim() || null);
            const accent = normalizeHex(accentColor) ?? (accentColor.trim() || null);
            const next = await buildRegistrationEmbedSnippet({
                eventSlugOrId: eventSlug,
                primaryColor: primary,
                accentColor: accent,
                borderRadius: borderRadius.trim() || null,
                fontFamily: fontFamily.trim() || null,
                layout,
                customCssUrl: customCssUrl.trim() || null,
            });
            setSnippet(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to build embed snippet.');
        } finally {
            setBuilding(false);
        }
    }, [
        accentColor,
        borderRadius,
        customCssUrl,
        eventSlug,
        fontFamily,
        layout,
        primaryColor,
    ]);

    useEffect(() => {
        if (!open) return;
        void rebuildSnippet();
    }, [open, rebuildSnippet]);

    const handleOpen = () => {
        if (!isPublished) return;
        setOpen(true);
        setCopied(false);
    };

    const handleCopy = async () => {
        const primary = normalizeHex(primaryColor) ?? (primaryColor.trim() || null);
        const accent = normalizeHex(accentColor) ?? (accentColor.trim() || null);
        const text =
            snippet ||
            (await buildRegistrationEmbedSnippet({
                eventSlugOrId: eventSlug,
                primaryColor: primary,
                accentColor: accent,
                borderRadius: borderRadius.trim() || null,
                fontFamily: fontFamily.trim() || null,
                layout,
                customCssUrl: customCssUrl.trim() || null,
            }));
        const ok = await copyTextToClipboard(text);
        if (!ok) {
            setError('Failed to copy snippet.');
            return;
        }
        setCopied(true);
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => setCopied(false), 5000);
    };

    const disabledTitle = 'Publish the event to generate an embed snippet';
    const primaryPicker = normalizeHex(primaryColor) ?? DEFAULT_TICKET_ACCENT;
    const accentPicker = normalizeHex(accentColor) ?? DEFAULT_EMBED_ACCENT;

    return (
        <div className="event-expanded-copy-link">
            <button
                type="button"
                className="event-expanded-copy-link-btn"
                onClick={handleOpen}
                disabled={!isPublished}
                aria-label="Generate embed code"
                title={isPublished ? 'Generate embed code' : disabledTitle}
            >
                <Code2 size={22} strokeWidth={2} aria-hidden="true" />
            </button>

            {open ? (
                <>
                    <div className="modal-backdrop" onClick={() => setOpen(false)} />
                    <div
                        className="modal-container generate-embed-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                    >
                        <div className="modal-header">
                            <div>
                                <h2 id={titleId} className="modal-title">
                                    Generate registration embed
                                </h2>
                                <p className="modal-subtitle">
                                    Paste this snippet on the per-event website. Style tokens below are optional;
                                    the host can also supply a custom CSS URL for full control.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setOpen(false)}
                                aria-label="Close"
                            >
                                <X />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-section">
                                <h3 className="form-section-title">Style tokens</h3>
                                <div className="generate-embed-modal__grid">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="embed-primary-color">
                                            Primary color
                                        </label>
                                        <div className="ticket-design-color-row">
                                            <input
                                                type="color"
                                                className="ticket-design-color-swatch"
                                                value={primaryPicker}
                                                onChange={(event) => setPrimaryColor(event.target.value)}
                                                aria-label="Pick primary color"
                                            />
                                            <input
                                                id="embed-primary-color"
                                                type="text"
                                                className="form-input"
                                                value={primaryColor}
                                                onChange={(event) => setPrimaryColor(event.target.value)}
                                                placeholder={DEFAULT_TICKET_ACCENT}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="embed-accent-color">
                                            Accent color
                                        </label>
                                        <div className="ticket-design-color-row">
                                            <input
                                                type="color"
                                                className="ticket-design-color-swatch"
                                                value={accentPicker}
                                                onChange={(event) => setAccentColor(event.target.value)}
                                                aria-label="Pick accent color"
                                            />
                                            <input
                                                id="embed-accent-color"
                                                type="text"
                                                className="form-input"
                                                value={accentColor}
                                                onChange={(event) => setAccentColor(event.target.value)}
                                                placeholder={DEFAULT_EMBED_ACCENT}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="embed-border-radius">
                                            Border radius
                                        </label>
                                        <input
                                            id="embed-border-radius"
                                            type="text"
                                            className="form-input"
                                            value={borderRadius}
                                            onChange={(event) => setBorderRadius(event.target.value)}
                                            placeholder="16px"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="embed-layout">
                                            Layout preset
                                        </label>
                                        <select
                                            id="embed-layout"
                                            className="form-input"
                                            value={layout}
                                            onChange={(event) => setLayout(event.target.value as LayoutPreset)}
                                        >
                                            <option value="default">Default</option>
                                            <option value="compact">Compact</option>
                                            <option value="spacious">Spacious</option>
                                        </select>
                                    </div>

                                    <div className="form-group generate-embed-modal__full">
                                        <label className="form-label" htmlFor="embed-font-family">
                                            Font family (optional)
                                        </label>
                                        <input
                                            id="embed-font-family"
                                            type="text"
                                            className="form-input"
                                            value={fontFamily}
                                            onChange={(event) => setFontFamily(event.target.value)}
                                            placeholder="Inter, system-ui, sans-serif"
                                        />
                                    </div>

                                    <div className="form-group generate-embed-modal__full">
                                        <label className="form-label" htmlFor="embed-custom-css">
                                            Custom CSS URL (optional, https://)
                                        </label>
                                        <input
                                            id="embed-custom-css"
                                            type="url"
                                            className="form-input"
                                            value={customCssUrl}
                                            onChange={(event) => setCustomCssUrl(event.target.value)}
                                            placeholder="https://example.com/event-theme.css"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Snippet</h3>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="embed-snippet">
                                        Embed code
                                    </label>
                                    <textarea
                                        id="embed-snippet"
                                        className="form-input generate-embed-modal__snippet"
                                        value={building ? 'Building snippet…' : snippet}
                                        readOnly
                                        rows={8}
                                    />
                                </div>
                                {error ? <p className="error-message" role="alert">{error}</p> : null}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void rebuildSnippet()}
                                disabled={building}
                            >
                                Refresh snippet
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => void handleCopy()}
                                disabled={building || !snippet}
                            >
                                <Copy size={16} aria-hidden="true" />
                                {copied ? 'Copied!' : 'Copy snippet'}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
