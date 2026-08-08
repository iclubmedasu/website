'use client';



import {

    useEffect,

    useRef,

    useState,

    type CSSProperties,

    type ChangeEvent,

    type MouseEvent as ReactMouseEvent,

} from 'react';

import { AlignCenter, AlignLeft, AlignRight, QrCode, Type } from 'lucide-react';

import type {

    EventCustomFieldRef,

    IdCardBackgroundFocus,

    IdCardLayoutElement,

} from '@/types/backend-contracts';

import ClampedNumberInput from '@/features/Certificates/TemplateEditor/ClampedNumberInput';
import { createUuid } from '@/utils/createUuid';

import IdCardPreview from './IdCardPreview';

import {

    DEFAULT_ID_CARD_BACKGROUND_FOCUS,

    ID_CARD_CANVAS_MAX,

    ID_CARD_CANVAS_MIN,

    ID_CARD_FOCUS_SCALE_MAX,

    buildAvailableIdCardFields,

    getIdCardPanExtents,

    parseIdCardBackgroundFocus,

    sampleIdCardFieldValue,

    type IdCardFieldOption,

} from './idCardFields';

import './IdCardCanvasEditor.css';



const DEFAULT_FONT_SIZE = 18;

const DEFAULT_ELEMENT_HEIGHT = Math.ceil(DEFAULT_FONT_SIZE * 1.4);

const DEFAULT_QR_SIZE = 140;

const MIN_ELEMENT_SIZE = 16;



type Selection = 'background' | string | null;



function clamp(n: number, min: number, max: number): number {

    return Math.min(max, Math.max(min, n));

}



function clampElementsToCanvas(

    elements: IdCardLayoutElement[],

    width: number,

    height: number,

): IdCardLayoutElement[] {

    return elements.map((el) => {

        const elWidth = el.type === 'qr'

            ? Math.min(el.width, width, height)

            : Math.min(el.width, width);

        const elHeight = el.type === 'qr'

            ? elWidth

            : Math.min(el.height, height);

        return {

            ...el,

            width: elWidth,

            height: elHeight,

            x: clamp(el.x, 0, Math.max(0, width - elWidth)),

            y: clamp(el.y, 0, Math.max(0, height - elHeight)),

        };

    });

}



function fieldAlreadyOnCanvas(elements: IdCardLayoutElement[], fieldKey: string): boolean {

    return elements.some((el) => el.type === 'field' && el.field === fieldKey);

}



function hasQrOnCanvas(elements: IdCardLayoutElement[]): boolean {

    return elements.some((el) => el.type === 'qr');

}



function staticTextOrdinal(elements: IdCardLayoutElement[], elementId: string): number {

    let n = 0;

    for (const el of elements) {

        if (el.type !== 'static') continue;

        n += 1;

        if (el.id === elementId) return n;

    }

    return n;

}



function labelFor(

    element: IdCardLayoutElement,

    elements: IdCardLayoutElement[],

    fieldOptions: IdCardFieldOption[],

): string {

    if (element.type === 'qr') return 'QR code';

    if (element.type === 'static') {

        return `Static text ${staticTextOrdinal(elements, element.id)}`;

    }

    const match = fieldOptions.find((opt) => opt.field === element.field);

    return match?.label ?? element.field ?? 'Field';

}



export interface IdCardCanvasEditorProps {

    elements: IdCardLayoutElement[];

    canvasWidth: number;

    canvasHeight: number;

    backgroundImageUrl: string | null;

    backgroundFocus: IdCardBackgroundFocus;

    fields?: EventCustomFieldRef[];

    onElementsChange: (elements: IdCardLayoutElement[]) => void;

    onCanvasSizeChange: (width: number, height: number) => void;

    onBackgroundFocusChange: (focus: IdCardBackgroundFocus) => void;

    onBackgroundFileChange: (file: File | null) => void;

    onBackgroundClear: () => void;

    onDirty?: () => void;

}



export default function IdCardCanvasEditor({

    elements,

    canvasWidth,

    canvasHeight,

    backgroundImageUrl,

    backgroundFocus,

    fields = [],

    onElementsChange,

    onCanvasSizeChange,

    onBackgroundFocusChange,

    onBackgroundFileChange,

    onBackgroundClear,

    onDirty,

}: IdCardCanvasEditorProps) {

    const [selection, setSelection] = useState<Selection>(null);

    const [scale, setScale] = useState(1);

    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

    const viewportRef = useRef<HTMLDivElement | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const scaleRef = useRef(1);

    const canvasSizeRef = useRef({ w: canvasWidth, h: canvasHeight });

    const focusRef = useRef(backgroundFocus);

    const naturalSizeRef = useRef(naturalSize);

    const isDragging = useRef(false);

    const isResizing = useRef(false);

    const isPanningBg = useRef(false);

    const dragElementId = useRef<string | null>(null);

    const dragStartMousePos = useRef({ x: 0, y: 0 });

    const dragStartElementPos = useRef({ x: 0, y: 0 });

    const resizeStartSize = useRef({ width: 0, height: 0 });

    const panStartMouse = useRef({ x: 0, y: 0 });

    const panStartFocus = useRef({ ...DEFAULT_ID_CARD_BACKGROUND_FOCUS });



    const availableFields = buildAvailableIdCardFields(fields);

    const selectedElementId = typeof selection === 'string' ? selection : null;

    const selectedElement = elements.find((el) => el.id === selectedElementId) ?? null;

    const backgroundSelected = selection === 'background';

    const elementsRef = useRef(elements);



    useEffect(() => {

        elementsRef.current = elements;

    }, [elements]);



    useEffect(() => {

        scaleRef.current = scale;

    }, [scale]);



    useEffect(() => {

        canvasSizeRef.current = { w: canvasWidth, h: canvasHeight };

    }, [canvasWidth, canvasHeight]);



    useEffect(() => {

        focusRef.current = backgroundFocus;

    }, [backgroundFocus]);



    useEffect(() => {

        naturalSizeRef.current = naturalSize;

    }, [naturalSize]);



    useEffect(() => {

        setNaturalSize(null);

        if (!backgroundImageUrl) return;

        const img = new Image();

        img.onload = () => {

            if (img.naturalWidth > 0 && img.naturalHeight > 0) {

                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });

            }

        };

        img.src = backgroundImageUrl;

    }, [backgroundImageUrl]);



    useEffect(() => {

        const viewport = viewportRef.current;

        if (!viewport) return;



        const updateScale = () => {

            const cw = viewport.clientWidth;

            const ch = viewport.clientHeight;

            if (cw <= 0 || ch <= 0) return;

            const next = Math.min(cw / canvasWidth, ch / canvasHeight);

            setScale(Number.isFinite(next) && next > 0 ? next : 1);

        };



        updateScale();

        const observer = new ResizeObserver(updateScale);

        observer.observe(viewport);

        return () => observer.disconnect();

    }, [canvasWidth, canvasHeight]);



    const markDirty = () => {

        onDirty?.();

    };



    const setElements = (next: IdCardLayoutElement[] | ((prev: IdCardLayoutElement[]) => IdCardLayoutElement[])) => {

        const resolved = typeof next === 'function' ? next(elementsRef.current) : next;

        elementsRef.current = resolved;

        onElementsChange(resolved);

    };



    const updateFocus = (patch: Partial<IdCardBackgroundFocus>) => {

        markDirty();

        onBackgroundFocusChange(

            parseIdCardBackgroundFocus({

                ...focusRef.current,

                ...patch,

            }),

        );

    };



    const updateSelected = (patch: Partial<IdCardLayoutElement>) => {

        if (!selectedElement) return;

        markDirty();

        setElements((prev) =>

            prev.map((el) => {

                if (el.id !== selectedElement.id) return el;

                const merged = { ...el, ...patch };

                if (merged.type === 'qr') {

                    const size = Math.max(MIN_ELEMENT_SIZE, merged.width);

                    merged.width = size;

                    merged.height = size;

                }

                return merged;

            }),

        );

    };



    const setCanvasDim = (axis: 'width' | 'height', raw: number) => {

        if (!Number.isFinite(raw)) return;

        const next = clamp(Math.round(raw), ID_CARD_CANVAS_MIN, ID_CARD_CANVAS_MAX);

        markDirty();

        if (axis === 'width') {

            onCanvasSizeChange(next, canvasHeight);

            setElements(clampElementsToCanvas(elementsRef.current, next, canvasHeight));

        } else {

            onCanvasSizeChange(canvasWidth, next);

            setElements(clampElementsToCanvas(elementsRef.current, canvasWidth, next));

        }

    };



    const fitCanvasToImage = () => {

        if (!naturalSize || naturalSize.w <= 0 || naturalSize.h <= 0) return;

        const nextW = clamp(Math.round(naturalSize.w), ID_CARD_CANVAS_MIN, ID_CARD_CANVAS_MAX);

        const nextH = clamp(Math.round(naturalSize.h), ID_CARD_CANVAS_MIN, ID_CARD_CANVAS_MAX);

        markDirty();

        onCanvasSizeChange(nextW, nextH);

        onBackgroundFocusChange({ ...DEFAULT_ID_CARD_BACKGROUND_FOCUS });

        setElements(clampElementsToCanvas(elementsRef.current, nextW, nextH));

    };



    const addField = (fieldKey: string) => {

        if (fieldKey !== '__static' && fieldAlreadyOnCanvas(elements, fieldKey)) return;

        const id = createUuid();

        const base: IdCardLayoutElement = {

            id,

            type: 'field',

            field: fieldKey,

            x: 24,

            y: 24 + elements.length * 28,

            width: Math.min(240, canvasWidth - 48),

            height: DEFAULT_ELEMENT_HEIGHT,

            fontSize: DEFAULT_FONT_SIZE,

            fontWeight: 'normal',

            align: 'center',

            color: '#111827',

        };

        markDirty();

        setElements((prev) => [...prev, base]);

        setSelection(id);

    };



    const addStatic = () => {

        const id = createUuid();

        const element: IdCardLayoutElement = {

            id,

            type: 'static',

            text: 'Your text here',

            x: 24,

            y: 24 + elements.length * 28,

            width: Math.min(200, canvasWidth - 48),

            height: DEFAULT_ELEMENT_HEIGHT,

            fontSize: DEFAULT_FONT_SIZE,

            fontWeight: 'normal',

            align: 'center',

            color: '#111827',

        };

        markDirty();

        setElements((prev) => [...prev, element]);

        setSelection(id);

    };



    const addQr = () => {

        if (hasQrOnCanvas(elements)) return;

        const size = Math.min(DEFAULT_QR_SIZE, canvasWidth - 48, canvasHeight - 48);

        const id = createUuid();

        const element: IdCardLayoutElement = {

            id,

            type: 'qr',

            x: Math.round((canvasWidth - size) / 2),

            y: 40,

            width: size,

            height: size,

        };

        markDirty();

        setElements((prev) => [...prev, element]);

        setSelection(id);

    };



    const deleteSelected = () => {

        if (!selectedElementId) return;

        markDirty();

        setElements((prev) => prev.filter((el) => el.id !== selectedElementId));

        setSelection(null);

    };



    const handleBackgroundPanStart = (e: ReactMouseEvent) => {

        if (!backgroundSelected || !backgroundImageUrl) return;

        e.preventDefault();

        e.stopPropagation();

        isPanningBg.current = true;

        panStartMouse.current = { x: e.clientX, y: e.clientY };

        panStartFocus.current = { ...focusRef.current };



        const onMove = (ev: MouseEvent) => {

            if (!isPanningBg.current) return;

            const currentScale = scaleRef.current || 1;

            const dx = (ev.clientX - panStartMouse.current.x) / currentScale;

            const dy = (ev.clientY - panStartMouse.current.y) / currentScale;

            const { w: cw, h: ch } = canvasSizeRef.current;

            const extents = getIdCardPanExtents(

                panStartFocus.current,

                naturalSizeRef.current,

                cw,

                ch,

            );

            const nextOffsetX =

                extents.maxX > 0

                    ? clamp(panStartFocus.current.offsetX - dx / extents.maxX, 0, 1)

                    : 0.5;

            const nextOffsetY =

                extents.maxY > 0

                    ? clamp(panStartFocus.current.offsetY - dy / extents.maxY, 0, 1)

                    : 0.5;

            onBackgroundFocusChange(

                parseIdCardBackgroundFocus({

                    ...panStartFocus.current,

                    offsetX: nextOffsetX,

                    offsetY: nextOffsetY,

                }),

            );

            markDirty();

        };



        const onUp = () => {

            isPanningBg.current = false;

            document.removeEventListener('mousemove', onMove);

            document.removeEventListener('mouseup', onUp);

        };



        document.addEventListener('mousemove', onMove);

        document.addEventListener('mouseup', onUp);

    };



    const handleElementMouseDown = (e: ReactMouseEvent, element: IdCardLayoutElement) => {

        e.preventDefault();

        e.stopPropagation();

        setSelection(element.id);



        isDragging.current = true;

        dragElementId.current = element.id;

        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        dragStartElementPos.current = { x: element.x, y: element.y };



        const onMove = (ev: MouseEvent) => {

            if (!isDragging.current || !dragElementId.current) return;

            const currentScale = scaleRef.current || 1;

            const dx = (ev.clientX - dragStartMousePos.current.x) / currentScale;

            const dy = (ev.clientY - dragStartMousePos.current.y) / currentScale;

            const { w: cw, h: ch } = canvasSizeRef.current;



            setElements((prev) =>

                prev.map((el) => {

                    if (el.id !== dragElementId.current) return el;

                    const elW = el.width;

                    const elH = el.type === 'qr' ? el.width : el.height;

                    const x = clamp(dragStartElementPos.current.x + dx, 0, Math.max(0, cw - elW));

                    const y = clamp(dragStartElementPos.current.y + dy, 0, Math.max(0, ch - elH));

                    return { ...el, x, y };

                }),

            );

            markDirty();

        };



        const onUp = () => {

            isDragging.current = false;

            dragElementId.current = null;

            document.removeEventListener('mousemove', onMove);

            document.removeEventListener('mouseup', onUp);

        };



        document.addEventListener('mousemove', onMove);

        document.addEventListener('mouseup', onUp);

    };



    const handleResizeMouseDown = (e: ReactMouseEvent, element: IdCardLayoutElement) => {

        e.preventDefault();

        e.stopPropagation();

        setSelection(element.id);



        isResizing.current = true;

        dragElementId.current = element.id;

        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        resizeStartSize.current = { width: element.width, height: element.height };

        dragStartElementPos.current = { x: element.x, y: element.y };



        const onMove = (ev: MouseEvent) => {

            if (!isResizing.current || !dragElementId.current) return;

            const currentScale = scaleRef.current || 1;

            const dx = (ev.clientX - dragStartMousePos.current.x) / currentScale;

            const dy = (ev.clientY - dragStartMousePos.current.y) / currentScale;

            const { w: cw, h: ch } = canvasSizeRef.current;



            setElements((prev) =>

                prev.map((el) => {

                    if (el.id !== dragElementId.current) return el;

                    if (el.type === 'qr') {

                        const size = clamp(

                            Math.round(resizeStartSize.current.width + Math.max(dx, dy)),

                            MIN_ELEMENT_SIZE,

                            Math.min(cw - el.x, ch - el.y),

                        );

                        return { ...el, width: size, height: size };

                    }

                    const width = clamp(

                        Math.round(resizeStartSize.current.width + dx),

                        MIN_ELEMENT_SIZE,

                        cw - el.x,

                    );

                    const height = clamp(

                        Math.round(resizeStartSize.current.height + dy),

                        MIN_ELEMENT_SIZE,

                        ch - el.y,

                    );

                    return { ...el, width, height };

                }),

            );

            markDirty();

        };



        const onUp = () => {

            isResizing.current = false;

            dragElementId.current = null;

            document.removeEventListener('mousemove', onMove);

            document.removeEventListener('mouseup', onUp);

        };



        document.addEventListener('mousemove', onMove);

        document.addEventListener('mouseup', onUp);

    };



    const handleBackgroundFile = (e: ChangeEvent<HTMLInputElement>) => {

        const file = e.target.files?.[0];

        e.target.value = '';

        if (!file) return;

        onBackgroundFileChange(file);

        onBackgroundFocusChange({ ...DEFAULT_ID_CARD_BACKGROUND_FOCUS });

        setSelection('background');

        markDirty();

    };



    const previewResolve = (fieldKey: string) => sampleIdCardFieldValue(fieldKey);



    const overlayElements = elements.map((element) => {

        const selected = element.id === selectedElementId;

        const isQr = element.type === 'qr';

        const style: CSSProperties = {

            left: element.x,

            top: element.y,

            width: isQr ? element.width : element.width,

            height: isQr ? element.width : element.height,

        };

        return (

            <div

                key={element.id}

                className={`id-card-editor-hit${selected ? ' id-card-editor-hit--selected' : ''}`}

                style={style}

                onClick={(e) => {

                    e.stopPropagation();

                    setSelection(element.id);

                }}

                onMouseDown={(e) => handleElementMouseDown(e, element)}

            >

                {selected ? (

                    <button

                        type="button"

                        className="id-card-editor-resize-handle"

                        aria-label="Resize element"

                        onMouseDown={(e) => handleResizeMouseDown(e, element)}

                    />

                ) : null}

            </div>

        );

    });



    return (

        <div className="id-card-canvas-editor">

            <aside className="id-card-canvas-editor__panel">

                <h3 className="id-card-canvas-editor__panel-title">Add field</h3>

                <div className="id-card-canvas-editor__field-list">

                    <button

                        type="button"

                        className={`id-card-canvas-editor__field-btn${

                            backgroundSelected ? ' id-card-canvas-editor__field-btn--active' : ''

                        }`}

                        onClick={() => setSelection('background')}

                    >

                        Background

                    </button>

                    <button

                        type="button"

                        className="id-card-canvas-editor__field-btn"

                        disabled={hasQrOnCanvas(elements)}

                        title={hasQrOnCanvas(elements) ? 'QR code already on canvas' : undefined}

                        onClick={addQr}

                    >

                        <QrCode size={14} />

                        QR code

                    </button>

                    {availableFields.map((field) => {

                        const already = field.onceOnly !== false && fieldAlreadyOnCanvas(elements, field.field);

                        return (

                            <button

                                key={field.field}

                                type="button"

                                className="id-card-canvas-editor__field-btn"

                                disabled={already}

                                title={already ? 'Already on canvas (only one allowed)' : undefined}

                                onClick={() => addField(field.field)}

                            >

                                {field.label}

                            </button>

                        );

                    })}

                    <button

                        type="button"

                        className="id-card-canvas-editor__field-btn"

                        onClick={addStatic}

                    >

                        <Type size={14} />

                        Static text

                    </button>

                </div>

            </aside>



            <div className="id-card-canvas-editor__center">

                <div

                    ref={viewportRef}

                    className="id-card-canvas-editor__viewport"

                    onClick={() => setSelection(null)}

                >

                    <div

                        className="id-card-canvas-editor__scale-wrap"

                        style={{

                            width: canvasWidth * scale,

                            height: canvasHeight * scale,

                        }}

                    >

                        <div

                            className={`id-card-canvas-editor__canvas${

                                backgroundSelected ? ' id-card-canvas-editor__canvas--bg-selected' : ''

                            }`}

                            style={{

                                width: canvasWidth,

                                height: canvasHeight,

                                transform: `scale(${scale})`,

                                cursor:

                                    backgroundSelected && backgroundImageUrl

                                        ? 'grab'

                                        : undefined,

                            }}

                            onClick={(e) => {

                                e.stopPropagation();

                                if (backgroundSelected) return;

                                setSelection(null);

                            }}

                            onMouseDown={(e) => {

                                if (!backgroundSelected) return;

                                // Only pan when the target is the canvas/pan layer (not an element hit).

                                if ((e.target as HTMLElement).closest('.id-card-editor-hit')) return;

                                handleBackgroundPanStart(e);

                            }}

                        >

                            <IdCardPreview

                                elements={elements}

                                canvasWidth={canvasWidth}

                                canvasHeight={canvasHeight}

                                backgroundImageUrl={backgroundImageUrl}

                                backgroundFocus={backgroundFocus}

                                resolveValue={previewResolve}

                                qrValue="SAMPLE1234"

                                fitToContainer={false}

                                className="id-card-canvas-editor__preview"

                            />

                            {overlayElements}

                        </div>

                    </div>

                </div>

            </div>



            <aside className="id-card-canvas-editor__panel id-card-canvas-editor__panel--right">

                <h3 className="id-card-canvas-editor__panel-title">Properties</h3>

                {backgroundSelected ? (

                    <div className="id-card-canvas-editor__props">

                        <div className="id-card-canvas-editor__prop-group">

                            <span className="form-label">Background</span>

                            <input

                                ref={fileInputRef}

                                type="file"

                                accept="image/jpeg,image/png,image/webp,image/heic"

                                className="id-card-canvas-editor__file-input"

                                onChange={handleBackgroundFile}

                            />

                            <div className="id-card-canvas-editor__prop-row">

                                <button

                                    type="button"

                                    className="btn btn-secondary"

                                    onClick={() => fileInputRef.current?.click()}

                                >

                                    {backgroundImageUrl ? 'Replace' : 'Choose image'}

                                </button>

                                {backgroundImageUrl ? (

                                    <button

                                        type="button"

                                        className="btn btn-danger"

                                        onClick={() => {

                                            onBackgroundClear();

                                            onBackgroundFocusChange({ ...DEFAULT_ID_CARD_BACKGROUND_FOCUS });

                                            markDirty();

                                        }}

                                    >

                                        Clear

                                    </button>

                                ) : null}

                            </div>

                        </div>



                        <div className="id-card-canvas-editor__prop-group">

                            <span className="form-label">Canvas size</span>

                            <p className="id-card-canvas-editor__hint">

                                1 px ≈ 1/96 in at print. Default 384×576 ≈ 4×6 in.

                            </p>

                        </div>

                        <div className="id-card-canvas-editor__prop-group">

                            <label className="form-label" htmlFor="id-card-canvas-w">Width (px)</label>

                            <ClampedNumberInput

                                id="id-card-canvas-w"

                                min={ID_CARD_CANVAS_MIN}

                                max={ID_CARD_CANVAS_MAX}

                                value={canvasWidth}

                                onCommit={(v) => setCanvasDim('width', v)}

                            />

                        </div>

                        <div className="id-card-canvas-editor__prop-group">

                            <label className="form-label" htmlFor="id-card-canvas-h">Height (px)</label>

                            <ClampedNumberInput

                                id="id-card-canvas-h"

                                min={ID_CARD_CANVAS_MIN}

                                max={ID_CARD_CANVAS_MAX}

                                value={canvasHeight}

                                onCommit={(v) => setCanvasDim('height', v)}

                            />

                        </div>



                        {backgroundImageUrl && naturalSize ? (

                            <div className="id-card-canvas-editor__prop-group">

                                <button

                                    type="button"

                                    className="btn btn-secondary"

                                    onClick={fitCanvasToImage}

                                >

                                    Fit to image

                                </button>

                                <p className="id-card-canvas-editor__hint">

                                    Sets canvas size to the image&apos;s pixel dimensions (

                                    {naturalSize.w}×{naturalSize.h}

                                    ).

                                </p>

                            </div>

                        ) : null}



                        {backgroundImageUrl ? (

                            <>

                                <div className="id-card-canvas-editor__prop-group">

                                    <label className="form-label" htmlFor="id-card-bg-zoom">

                                        Zoom ({backgroundFocus.scale.toFixed(2)}×)

                                    </label>

                                    <input

                                        id="id-card-bg-zoom"

                                        type="range"

                                        min={1}

                                        max={ID_CARD_FOCUS_SCALE_MAX}

                                        step={0.01}

                                        className="id-card-canvas-editor__range"

                                        value={backgroundFocus.scale}

                                        onChange={(e) => updateFocus({ scale: Number(e.target.value) })}

                                    />

                                </div>

                                <p className="id-card-canvas-editor__hint">

                                    Drag the background on the canvas to pan focus.

                                </p>

                            </>

                        ) : null}

                    </div>

                ) : !selectedElement ? (

                    <p className="id-card-canvas-editor__props-empty">

                        Select Background or an element to edit

                    </p>

                ) : (

                    <div className="id-card-canvas-editor__props">

                        <div className="id-card-canvas-editor__prop-group">

                            <span className="form-label">

                                {labelFor(selectedElement, elements, availableFields)}

                            </span>

                        </div>



                        <div className="id-card-canvas-editor__prop-group">

                            <label className="form-label" htmlFor="id-card-el-x">X</label>

                            <ClampedNumberInput

                                id="id-card-el-x"

                                min={0}

                                max={Math.max(0, canvasWidth - selectedElement.width)}

                                value={Math.round(selectedElement.x)}

                                onCommit={(v) => updateSelected({ x: v })}

                            />

                        </div>

                        <div className="id-card-canvas-editor__prop-group">

                            <label className="form-label" htmlFor="id-card-el-y">Y</label>

                            <ClampedNumberInput

                                id="id-card-el-y"

                                min={0}

                                max={Math.max(0, canvasHeight - (selectedElement.type === 'qr' ? selectedElement.width : selectedElement.height))}

                                value={Math.round(selectedElement.y)}

                                onCommit={(v) => updateSelected({ y: v })}

                            />

                        </div>

                        <div className="id-card-canvas-editor__prop-group">

                            <label className="form-label" htmlFor="id-card-el-w">

                                {selectedElement.type === 'qr' ? 'Size' : 'Width'}

                            </label>

                            <ClampedNumberInput

                                id="id-card-el-w"

                                min={MIN_ELEMENT_SIZE}

                                max={canvasWidth - selectedElement.x}

                                value={Math.round(selectedElement.width)}

                                onCommit={(v) => updateSelected({ width: v, ...(selectedElement.type === 'qr' ? { height: v } : {}) })}

                            />

                        </div>

                        {selectedElement.type !== 'qr' ? (

                            <div className="id-card-canvas-editor__prop-group">

                                <label className="form-label" htmlFor="id-card-el-h">Height</label>

                                <ClampedNumberInput

                                    id="id-card-el-h"

                                    min={MIN_ELEMENT_SIZE}

                                    max={canvasHeight - selectedElement.y}

                                    value={Math.round(selectedElement.height)}

                                    onCommit={(v) => updateSelected({ height: v })}

                                />

                            </div>

                        ) : null}



                        {selectedElement.type === 'static' ? (

                            <div className="id-card-canvas-editor__prop-group">

                                <label className="form-label" htmlFor="id-card-el-text">Text</label>

                                <textarea

                                    id="id-card-el-text"

                                    className="form-input"

                                    rows={3}

                                    value={selectedElement.text ?? ''}

                                    onChange={(e) => updateSelected({ text: e.target.value })}

                                />

                            </div>

                        ) : null}



                        {selectedElement.type === 'field' || selectedElement.type === 'static' ? (

                            <>

                                <div className="id-card-canvas-editor__prop-group">

                                    <label className="form-label" htmlFor="id-card-el-font">Font size</label>

                                    <ClampedNumberInput

                                        id="id-card-el-font"

                                        min={8}

                                        max={200}

                                        value={selectedElement.fontSize ?? DEFAULT_FONT_SIZE}

                                        onCommit={(v) => updateSelected({ fontSize: v })}

                                    />

                                </div>

                                <div className="id-card-canvas-editor__prop-group">

                                    <span className="form-label">Font weight</span>

                                    <div className="id-card-canvas-editor__prop-row">

                                        <button

                                            type="button"

                                            className={`id-card-canvas-editor__toggle-btn${(selectedElement.fontWeight ?? 'normal') === 'normal' ? ' active' : ''}`}

                                            onClick={() => updateSelected({ fontWeight: 'normal' })}

                                        >

                                            Normal

                                        </button>

                                        <button

                                            type="button"

                                            className={`id-card-canvas-editor__toggle-btn${selectedElement.fontWeight === 'bold' ? ' active' : ''}`}

                                            onClick={() => updateSelected({ fontWeight: 'bold' })}

                                        >

                                            Bold

                                        </button>

                                    </div>

                                </div>

                                <div className="id-card-canvas-editor__prop-group">

                                    <span className="form-label">Align</span>

                                    <div className="id-card-canvas-editor__prop-row">

                                        <button

                                            type="button"

                                            className={`id-card-canvas-editor__toggle-btn${(selectedElement.align ?? 'left') === 'left' ? ' active' : ''}`}

                                            onClick={() => updateSelected({ align: 'left' })}

                                            aria-label="Align left"

                                        >

                                            <AlignLeft size={14} />

                                        </button>

                                        <button

                                            type="button"

                                            className={`id-card-canvas-editor__toggle-btn${selectedElement.align === 'center' ? ' active' : ''}`}

                                            onClick={() => updateSelected({ align: 'center' })}

                                            aria-label="Align center"

                                        >

                                            <AlignCenter size={14} />

                                        </button>

                                        <button

                                            type="button"

                                            className={`id-card-canvas-editor__toggle-btn${selectedElement.align === 'right' ? ' active' : ''}`}

                                            onClick={() => updateSelected({ align: 'right' })}

                                            aria-label="Align right"

                                        >

                                            <AlignRight size={14} />

                                        </button>

                                    </div>

                                </div>

                                <div className="id-card-canvas-editor__prop-group">

                                    <label className="form-label" htmlFor="id-card-el-color">Color</label>

                                    <input

                                        id="id-card-el-color"

                                        type="color"

                                        className="id-card-canvas-editor__color"

                                        value={selectedElement.color ?? '#111827'}

                                        onChange={(e) => updateSelected({ color: e.target.value })}

                                    />

                                </div>

                            </>

                        ) : null}



                        <div className="id-card-canvas-editor__prop-group">

                            <button

                                type="button"

                                className="btn btn-danger id-card-canvas-editor__delete-btn"

                                onClick={deleteSelected}

                            >

                                Delete element

                            </button>

                        </div>

                    </div>

                )}

            </aside>

        </div>

    );

}


