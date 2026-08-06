'use client';



import { useEffect, useMemo, useRef, useState } from 'react';

import { Check, Loader2, X } from 'lucide-react';

import { eventsAPI } from '@/services/api';

import type {

    EventCustomFieldRef,

    EventIdCardDesignRef,

    Id,

    IdCardBackgroundFocus,

    IdCardLayoutElement,

} from '@/types/backend-contracts';

import IdCardCanvasEditor from './IdCardCanvasEditor';

import {

    canvasSizeFromDesign,

    focusFromDesign,

    layoutFromDesign,

    parseIdCardBackgroundFocus,

} from './idCardFields';

import { useAuthorizedIdCardBackground } from './useAuthorizedIdCardBackground';

import './IdCardDesignEditModal.css';



type SaveState = 'idle' | 'saving' | 'saved' | 'error';



export interface IdCardDesignEditModalProps {

    eventId: Id | string;

    fields?: EventCustomFieldRef[];

    idCardDesign?: EventIdCardDesignRef | null;

    onClose: () => void;

    onReload: () => void;

}



export default function IdCardDesignEditModal({

    eventId,

    fields = [],

    idCardDesign,

    onClose,

    onReload,

}: IdCardDesignEditModalProps) {

    const initialSize = canvasSizeFromDesign(idCardDesign);

    const [elements, setElements] = useState<IdCardLayoutElement[]>(() => layoutFromDesign(idCardDesign));

    const [canvasWidth, setCanvasWidth] = useState(initialSize.width);

    const [canvasHeight, setCanvasHeight] = useState(initialSize.height);

    const [backgroundFocus, setBackgroundFocus] = useState<IdCardBackgroundFocus>(() =>

        focusFromDesign(idCardDesign),

    );

    const [saveState, setSaveState] = useState<SaveState>('idle');

    const [errorMessage, setErrorMessage] = useState('');

    const [dirty, setDirty] = useState(false);

    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

    const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);

    const [backgroundCleared, setBackgroundCleared] = useState(false);

    const [localBgUrl, setLocalBgUrl] = useState<string | null>(null);

    const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const localBgUrlRef = useRef<string | null>(null);



    const hasServerBackground = Boolean(idCardDesign?.idCardBackgroundImageGithubPath) && !backgroundCleared;

    const serverBgUrl = useAuthorizedIdCardBackground(

        eventId,

        hasServerBackground && !pendingBackgroundFile,

        idCardDesign?.idCardBackgroundImageGithubSha

            ?? idCardDesign?.idCardBackgroundImageGithubPath,

    );



    const backgroundImageUrl = localBgUrl ?? (backgroundCleared ? null : serverBgUrl);



    useEffect(() => {

        const size = canvasSizeFromDesign(idCardDesign);

        setElements(layoutFromDesign(idCardDesign));

        setCanvasWidth(size.width);

        setCanvasHeight(size.height);

        setBackgroundFocus(focusFromDesign(idCardDesign));

        setBackgroundCleared(false);

        setPendingBackgroundFile(null);

        if (localBgUrlRef.current) {

            URL.revokeObjectURL(localBgUrlRef.current);

            localBgUrlRef.current = null;

        }

        setLocalBgUrl(null);

        setErrorMessage('');

        setDirty(false);

        setDiscardConfirmOpen(false);

        setSaveState((current) => (current === 'saved' ? current : 'idle'));

    }, [

        idCardDesign?.idCardCanvasWidth,

        idCardDesign?.idCardCanvasHeight,

        idCardDesign?.idCardLayout,

        idCardDesign?.idCardBackgroundFocus,

        idCardDesign?.idCardBackgroundImageGithubPath,

        idCardDesign?.idCardBackgroundImageGithubSha,

    ]);



    useEffect(() => () => {

        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);

        if (localBgUrlRef.current) {

            URL.revokeObjectURL(localBgUrlRef.current);

            localBgUrlRef.current = null;

        }

    }, []);



    const leaveEditor = () => {

        setDiscardConfirmOpen(false);

        onClose();

    };



    const handleCancel = () => {

        if (!dirty && !pendingBackgroundFile && !backgroundCleared) {

            leaveEditor();

            return;

        }

        setDiscardConfirmOpen(true);

    };



    useEffect(() => {

        const onKeyDown = (event: KeyboardEvent) => {

            if (event.key !== 'Escape') return;

            if (discardConfirmOpen) {

                setDiscardConfirmOpen(false);

                return;

            }

            if (!dirty && !pendingBackgroundFile && !backgroundCleared) {

                onClose();

                return;

            }

            setDiscardConfirmOpen(true);

        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);

    }, [backgroundCleared, dirty, discardConfirmOpen, onClose, pendingBackgroundFile]);



    const markSaved = () => {

        setSaveState('saved');

        setDirty(false);

        if (savedResetTimer.current) clearTimeout(savedResetTimer.current);

        savedResetTimer.current = setTimeout(() => setSaveState('idle'), 2000);

    };



    const handleBackgroundFileChange = (file: File | null) => {

        if (!file) return;

        if (localBgUrlRef.current) {

            URL.revokeObjectURL(localBgUrlRef.current);

        }

        const url = URL.createObjectURL(file);

        localBgUrlRef.current = url;

        setLocalBgUrl(url);

        setPendingBackgroundFile(file);

        setBackgroundCleared(false);

        setDirty(true);

        setSaveState('idle');

    };



    const handleBackgroundClear = () => {

        if (localBgUrlRef.current) {

            URL.revokeObjectURL(localBgUrlRef.current);

            localBgUrlRef.current = null;

        }

        setLocalBgUrl(null);

        setPendingBackgroundFile(null);

        setBackgroundCleared(true);

        setDirty(true);

        setSaveState('idle');

    };



    const handleSave = async () => {

        if (saveState === 'saving') return;

        setSaveState('saving');

        setErrorMessage('');

        try {

            const focusPayload = parseIdCardBackgroundFocus(backgroundFocus);

            await eventsAPI.updateIdCardDesign(eventId, {

                canvasWidth,

                canvasHeight,

                layout: elements,

                backgroundFocus: focusPayload,

            });



            if (pendingBackgroundFile) {

                await eventsAPI.uploadIdCardBackgroundImage(eventId, pendingBackgroundFile);

                setPendingBackgroundFile(null);

            } else if (backgroundCleared && idCardDesign?.idCardBackgroundImageGithubPath) {

                await eventsAPI.deleteIdCardBackgroundImage(eventId);

                setBackgroundCleared(false);

            }



            onReload();

            markSaved();

        } catch (error) {

            setErrorMessage(error instanceof Error ? error.message : 'Failed to save ID card design.');

            setSaveState('error');

        }

    };



    const busy = saveState === 'saving';



    const canSave = useMemo(

        () => dirty || Boolean(pendingBackgroundFile) || backgroundCleared,

        [backgroundCleared, dirty, pendingBackgroundFile],

    );



    return (

        <>

            <div

                className="modal-backdrop"

                onClick={handleCancel}

            />

            <div

                className="modal-container id-card-design-edit-modal"

                role="dialog"

                aria-modal="true"

                aria-labelledby="id-card-design-edit-title"

            >

                <div className="modal-header">

                    <div>

                        <h2 className="modal-title" id="id-card-design-edit-title">Edit ID card design</h2>

                        <p className="modal-subtitle">Drag fields and QR code onto the badge canvas</p>

                    </div>

                    <button type="button" className="modal-close-btn" onClick={handleCancel} aria-label="Close">

                        <X />

                    </button>

                </div>



                <div className="modal-body id-card-design-edit-modal__body">

                    <IdCardCanvasEditor

                        elements={elements}

                        canvasWidth={canvasWidth}

                        canvasHeight={canvasHeight}

                        backgroundImageUrl={backgroundImageUrl}

                        backgroundFocus={backgroundFocus}

                        fields={fields}

                        onElementsChange={(next) => {

                            setElements(next);

                            setDirty(true);

                            setSaveState('idle');

                        }}

                        onCanvasSizeChange={(w, h) => {

                            setCanvasWidth(w);

                            setCanvasHeight(h);

                            setDirty(true);

                            setSaveState('idle');

                        }}

                        onBackgroundFocusChange={(next) => {

                            setBackgroundFocus(parseIdCardBackgroundFocus(next));

                            setDirty(true);

                            setSaveState('idle');

                        }}

                        onBackgroundFileChange={handleBackgroundFileChange}

                        onBackgroundClear={handleBackgroundClear}

                        onDirty={() => {

                            setDirty(true);

                            setSaveState('idle');

                        }}

                    />

                    {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

                </div>



                <div className="modal-footer id-card-design-edit-modal__footer">

                    {dirty || pendingBackgroundFile || backgroundCleared ? (

                        <span className="id-card-design-edit-modal__dirty" aria-live="polite">

                            Unsaved changes

                        </span>

                    ) : (

                        <span className="id-card-design-edit-modal__dirty id-card-design-edit-modal__dirty--idle" />

                    )}

                    <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={busy}>

                        Cancel

                    </button>

                    <button

                        type="button"

                        className="btn btn-primary"

                        disabled={!canSave || busy}

                        onClick={() => void handleSave()}

                    >

                        {saveState === 'saving' ? (

                            <>

                                <Loader2 size={14} className="animate-spin" />

                                Saving…

                            </>

                        ) : saveState === 'saved' && !canSave ? (

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



            {discardConfirmOpen ? (

                <>

                    <div

                        className="modal-backdrop id-card-design-discard-backdrop"

                        onClick={() => setDiscardConfirmOpen(false)}

                    />

                    <div

                        className="modal-container modal-warning id-card-design-discard-modal"

                        role="dialog"

                        aria-modal="true"

                        aria-labelledby="id-card-discard-title"

                    >

                        <div className="modal-header">

                            <div className="modal-header-content">

                                <h2 className="modal-title" id="id-card-discard-title">

                                    Discard edits?

                                </h2>

                            </div>

                            <button

                                type="button"

                                className="modal-close-btn"

                                onClick={() => setDiscardConfirmOpen(false)}

                                aria-label="Close"

                            >

                                <X />

                            </button>

                        </div>

                        <div className="modal-body">

                            <p>Do you want to discard the edits?</p>

                        </div>

                        <div className="modal-footer">

                            <button

                                type="button"

                                className="btn btn-secondary"

                                onClick={() => setDiscardConfirmOpen(false)}

                            >

                                Keep editing

                            </button>

                            <button

                                type="button"

                                className="btn btn-warning"

                                onClick={leaveEditor}

                            >

                                Discard

                            </button>

                        </div>

                    </div>

                </>

            ) : null}

        </>

    );

}


