'use client';

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from 'react';
import {
    Check,
    ImagePlus,
    Loader2,
    RotateCcw,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import {
    DEFAULT_TICKET_ACCENT,
    normalizeHex,
} from '@iclub/shared/utils';
import { eventsAPI } from '@/services/api';
import type {
    EventSessionRef,
    EventTicketDesignRef,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import TicketPreview, {
    draftFromDesign,
    useAuthorizedTicketImage,
} from './TicketPreview';
import './TicketDesignPanel.css';
import './TicketDesignEditModal.css';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface TicketDesignEditModalProps {
    eventId: Id | string;
    eventTitle: string;
    eventVenue?: string | null;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    sessions?: EventSessionRef[];
    tiers?: EventTierRef[];
    ticketDesign?: EventTicketDesignRef | null;
    onClose: () => void;
    onReload: () => void;
}

export default function TicketDesignEditModal({
    eventId,
    eventTitle,
    eventVenue,
    eventDate,
    eventEndDate,
    eventTimezone,
    sessions = [],
    tiers = [],
    ticketDesign,
    onClose,
    onReload,
}: TicketDesignEditModalProps) {
    const [draft, setDraft] = useState(() => draftFromDesign(ticketDesign));
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [uploadingSlot, setUploadingSlot] = useState<'header' | 'footer' | null>(null);
    const [removingSlot, setRemovingSlot] = useState<'header' | 'footer' | null>(null);
    const headerInputRef = useRef<HTMLInputElement>(null);
    const footerInputRef = useRef<HTMLInputElement>(null);
    const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hasHeaderImage = Boolean(ticketDesign?.ticketHeaderImageGithubPath);
    const hasFooterImage = Boolean(ticketDesign?.ticketFooterImageGithubPath);
    const headerThumb = useAuthorizedTicketImage(
        eventId,
        'header',
        hasHeaderImage,
        ticketDesign?.ticketHeaderImageGithubSha ?? ticketDesign?.ticketHeaderImageGithubPath,
    );
    const footerThumb = useAuthorizedTicketImage(
        eventId,
        'footer',
        hasFooterImage,
        ticketDesign?.ticketFooterImageGithubSha ?? ticketDesign?.ticketFooterImageGithubPath,
    );

    useEffect(() => {
        setDraft(draftFromDesign(ticketDesign));
        setErrorMessage('');
        // Keep "Saved" visible after onReload refreshes ticketDesign.
        setSaveState((current) => (current === 'saved' ? current : 'idle'));
    }, [
        ticketDesign?.ticketAccentColor,
        ticketDesign?.ticketHeaderTitle,
        ticketDesign?.ticketHeaderSubtitle,
        ticketDesign?.ticketFooterNote,
        ticketDesign?.ticketHeaderImageGithubPath,
        ticketDesign?.ticketFooterImageGithubPath,
    ]);

    useEffect(() => () => {
        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const baseline = useMemo(() => draftFromDesign(ticketDesign), [
        ticketDesign?.ticketAccentColor,
        ticketDesign?.ticketHeaderTitle,
        ticketDesign?.ticketHeaderSubtitle,
        ticketDesign?.ticketFooterNote,
    ]);

    const isDirty = (
        draft.accentColor !== baseline.accentColor
        || draft.headerTitle !== baseline.headerTitle
        || draft.headerSubtitle !== baseline.headerSubtitle
        || draft.footerNote !== baseline.footerNote
    );

    const markSaved = () => {
        setSaveState('saved');
        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);
        savedResetTimer.current = setTimeout(() => setSaveState('idle'), 2000);
    };

    const handleSave = async () => {
        if (saveState === 'saving') return;
        const normalizedAccent = normalizeHex(draft.accentColor);
        if (draft.accentColor.trim() && !normalizedAccent) {
            setErrorMessage('Accent color must be a valid hex value (e.g. #561789).');
            setSaveState('error');
            return;
        }

        setSaveState('saving');
        setErrorMessage('');
        try {
            const accentToSave = !normalizedAccent || normalizedAccent === DEFAULT_TICKET_ACCENT
                ? null
                : normalizedAccent;
            await eventsAPI.updateTicketDesign(eventId, {
                accentColor: accentToSave,
                headerTitle: draft.headerTitle.trim() || null,
                headerSubtitle: draft.headerSubtitle.trim() || null,
                footerNote: draft.footerNote.trim() || null,
            });
            onReload();
            markSaved();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to save ticket design.');
            setSaveState('error');
        }
    };

    const handleReset = async () => {
        if (saveState === 'saving') return;
        setSaveState('saving');
        setErrorMessage('');
        try {
            await eventsAPI.updateTicketDesign(eventId, {
                accentColor: null,
                headerTitle: null,
                headerSubtitle: null,
                footerNote: null,
            });
            setDraft(draftFromDesign(null));
            onReload();
            markSaved();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to reset ticket design.');
            setSaveState('error');
        }
    };

    const handleImageSelected = async (slot: 'header' | 'footer', event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setUploadingSlot(slot);
        setErrorMessage('');
        try {
            await eventsAPI.uploadTicketDesignImage(eventId, slot, file);
            onReload();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `Failed to upload ${slot} image.`);
        } finally {
            setUploadingSlot(null);
        }
    };

    const handleRemoveImage = async (slot: 'header' | 'footer') => {
        setRemovingSlot(slot);
        setErrorMessage('');
        try {
            await eventsAPI.deleteTicketDesignImage(eventId, slot);
            onReload();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `Failed to remove ${slot} image.`);
        } finally {
            setRemovingSlot(null);
        }
    };

    const hexInputValue = normalizeHex(draft.accentColor) ?? draft.accentColor;
    const colorPickerValue = normalizeHex(draft.accentColor) ?? DEFAULT_TICKET_ACCENT;
    const busy = saveState === 'saving' || uploadingSlot !== null || removingSlot !== null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div
                className="modal-container ticket-design-edit-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ticket-design-edit-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="ticket-design-edit-title">Edit ticket design</h2>
                        <p className="modal-subtitle">Customize how tickets look for this event</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body ticket-design-edit-modal__body">
                    <div className="ticket-design-edit-modal__preview">
                        <TicketPreview
                            eventTitle={eventTitle}
                            eventVenue={eventVenue}
                            eventDate={eventDate}
                            eventEndDate={eventEndDate}
                            eventTimezone={eventTimezone}
                            sessions={sessions}
                            tiers={tiers}
                            draft={draft}
                            headerThumb={headerThumb}
                            footerThumb={footerThumb}
                        />
                    </div>

                    <div className="ticket-design-controls ticket-design-edit-modal__controls">
                        <div className="form-group">
                            <label className="form-label" htmlFor={`ticket-accent-${eventId}`}>Accent color</label>
                            <div className="ticket-design-color-row">
                                <input
                                    type="color"
                                    className="ticket-design-color-swatch"
                                    value={colorPickerValue}
                                    onChange={(event) => {
                                        setDraft((current) => ({ ...current, accentColor: event.target.value }));
                                        setSaveState('idle');
                                    }}
                                    aria-label="Pick accent color"
                                />
                                <input
                                    id={`ticket-accent-${eventId}`}
                                    type="text"
                                    className="form-input"
                                    value={hexInputValue}
                                    onChange={(event) => {
                                        setDraft((current) => ({ ...current, accentColor: event.target.value }));
                                        setSaveState('idle');
                                    }}
                                    placeholder={DEFAULT_TICKET_ACCENT}
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor={`ticket-header-title-${eventId}`}>Header title</label>
                            <input
                                id={`ticket-header-title-${eventId}`}
                                type="text"
                                className="form-input"
                                value={draft.headerTitle}
                                onChange={(event) => {
                                    setDraft((current) => ({ ...current, headerTitle: event.target.value }));
                                    setSaveState('idle');
                                }}
                                placeholder={eventTitle}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor={`ticket-header-subtitle-${eventId}`}>Header subtitle</label>
                            <input
                                id={`ticket-header-subtitle-${eventId}`}
                                type="text"
                                className="form-input"
                                value={draft.headerSubtitle}
                                onChange={(event) => {
                                    setDraft((current) => ({ ...current, headerSubtitle: event.target.value }));
                                    setSaveState('idle');
                                }}
                                placeholder="Your ticket"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor={`ticket-footer-note-${eventId}`}>Footer note</label>
                            <textarea
                                id={`ticket-footer-note-${eventId}`}
                                className="form-input ticket-design-textarea"
                                value={draft.footerNote}
                                onChange={(event) => {
                                    setDraft((current) => ({ ...current, footerNote: event.target.value }));
                                    setSaveState('idle');
                                }}
                                placeholder="Optional note shown under the check-in instructions"
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <span className="form-label">Header image</span>
                            <div className="ticket-design-image-row">
                                {headerThumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={headerThumb} alt="Header banner" className="ticket-design-image-thumb" />
                                ) : (
                                    <div className="ticket-design-image-thumb ticket-design-image-thumb--empty" aria-hidden>
                                        <ImagePlus size={16} />
                                    </div>
                                )}
                                <div className="ticket-design-image-actions">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={busy}
                                        onClick={() => headerInputRef.current?.click()}
                                    >
                                        {uploadingSlot === 'header'
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Upload size={14} />}
                                        {hasHeaderImage ? 'Replace' : 'Upload'}
                                    </button>
                                    {hasHeaderImage ? (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            disabled={busy}
                                            onClick={() => void handleRemoveImage('header')}
                                        >
                                            {removingSlot === 'header'
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Trash2 size={14} />}
                                            Remove
                                        </button>
                                    ) : null}
                                </div>
                                <input
                                    ref={headerInputRef}
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES}
                                    className="ticket-design-file-input"
                                    onChange={(event) => void handleImageSelected('header', event)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <span className="form-label">Footer image</span>
                            <div className="ticket-design-image-row">
                                {footerThumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={footerThumb} alt="Footer banner" className="ticket-design-image-thumb" />
                                ) : (
                                    <div className="ticket-design-image-thumb ticket-design-image-thumb--empty" aria-hidden>
                                        <ImagePlus size={16} />
                                    </div>
                                )}
                                <div className="ticket-design-image-actions">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={busy}
                                        onClick={() => footerInputRef.current?.click()}
                                    >
                                        {uploadingSlot === 'footer'
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Upload size={14} />}
                                        {hasFooterImage ? 'Replace' : 'Upload'}
                                    </button>
                                    {hasFooterImage ? (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            disabled={busy}
                                            onClick={() => void handleRemoveImage('footer')}
                                        >
                                            {removingSlot === 'footer'
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Trash2 size={14} />}
                                            Remove
                                        </button>
                                    ) : null}
                                </div>
                                <input
                                    ref={footerInputRef}
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES}
                                    className="ticket-design-file-input"
                                    onChange={(event) => void handleImageSelected('footer', event)}
                                />
                            </div>
                        </div>

                        {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
                    </div>
                </div>

                <div className="modal-footer ticket-design-edit-modal__footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => void handleReset()}
                    >
                        <RotateCcw size={14} />
                        Reset to defaults
                    </button>
                    <div className="ticket-design-edit-modal__footer-end">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saveState === 'saving'}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!isDirty || busy}
                            onClick={() => void handleSave()}
                        >
                            {saveState === 'saving' ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Saving…
                                </>
                            ) : saveState === 'saved' && !isDirty ? (
                                <>
                                    <Check size={14} />
                                    Saved
                                </>
                            ) : (
                                'Save'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
