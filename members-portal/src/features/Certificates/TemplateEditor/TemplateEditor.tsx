'use client';

import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { AlignCenter, AlignLeft, AlignRight, X } from 'lucide-react';
import {
    certificatesAPI,
    type BackgroundFocus,
} from '@/services/certificatesAPI';
import ClampedNumberInput from './ClampedNumberInput';
import { textFitsInBox } from './textFitsInBox';
import './TemplateEditor.css';

const TEXT_OVERFLOW_MSG =
    "Text doesn't fit — reduce font size or enlarge the element";
const DEFAULT_ELEMENT_FONT_SIZE = 120;
const DEFAULT_ELEMENT_HEIGHT = Math.ceil(DEFAULT_ELEMENT_FONT_SIZE * 1.2);

export interface CanvasElement {
    id: string;
    type: 'field' | 'static';
    field?: string;
    text?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    align: 'left' | 'center' | 'right';
    color: string;
}

export const AVAILABLE_FIELDS = [
    { field: 'recipientName', label: 'Recipient Name', previewText: 'Ahmed Mohamed' },
    { field: 'title', label: 'Certificate Title', previewText: 'Certificate of Participation' },
    { field: 'description', label: 'Description', previewText: 'participated in Cairo Medical Conference 2026' },
    { field: 'issuedDate', label: 'Issue Date', previewText: 'January 15, 2026' },
    { field: 'verificationCode', label: 'Verification Code', previewText: 'ABC12345' },
    {
        field: 'verificationUrl',
        label: 'Verify URL',
        previewText: 'https://example.com/verify/ABC12345',
    },
    { field: 'issuerName', label: 'Issuer Name', previewText: 'Faculty of Medicine Ain Shams' },
    { field: '__static', label: 'Static Text', previewText: 'Your custom text here' },
] as const;

/** Once-only on the canvas — add is disabled if already present. Static Text is unlimited. */
const ONCE_ONLY_FIELDS = new Set<string>([
    'recipientName',
    'title',
    'description',
    'issuedDate',
    'verificationCode',
    'verificationUrl',
    'issuerName',
]);

/** Template-owned wording: editable via Text Content and stored on `element.text`. */
const WORDING_FIELDS = new Set<string>(['description', 'issuerName']);

const FIELD_MAP = Object.fromEntries(
    AVAILABLE_FIELDS.map((f) => [f.field, f]),
) as Record<string, (typeof AVAILABLE_FIELDS)[number]>;

const DEFAULT_FOCUS: BackgroundFocus = { scale: 1, offsetX: 0.5, offsetY: 0.5 };
const CANVAS_MIN = 400;
const CANVAS_MAX = 4000;
const FOCUS_SCALE_MAX = 3;

function isWordingElement(element: CanvasElement): boolean {
    if (element.type === 'static') return true;
    return Boolean(element.field && WORDING_FIELDS.has(element.field));
}

function fieldAlreadyOnCanvas(elements: CanvasElement[], fieldKey: string): boolean {
    return elements.some((el) => el.type === 'field' && el.field === fieldKey);
}

/** 1-based index among static elements in array order (order of addition). */
function staticTextOrdinal(elements: CanvasElement[], elementId: string): number {
    let n = 0;
    for (const el of elements) {
        if (el.type !== 'static') continue;
        n += 1;
        if (el.id === elementId) return n;
    }
    return n;
}

export interface TemplateEditorProps {
    mode: 'create' | 'edit';
    initialTemplateId: number | null;
    initialName: string;
    initialElements: CanvasElement[];
    initialCanvasWidth: number;
    initialCanvasHeight: number;
    initialBackgroundImageUrl: string | null;
    initialBackgroundFocus?: BackgroundFocus | null;
    hasIssuedCertificates?: boolean;
    nested?: boolean;
    onSaved?: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function normalizeFocus(value: BackgroundFocus | null | undefined): BackgroundFocus {
    if (!value) return { ...DEFAULT_FOCUS };
    return {
        scale: clamp(Number(value.scale) || 1, 1, FOCUS_SCALE_MAX),
        offsetX: clamp(Number(value.offsetX) || 0.5, 0, 1),
        offsetY: clamp(Number(value.offsetY) || 0.5, 0, 1),
    };
}

export function previewTextFor(element: CanvasElement): string {
    if (element.type === 'static') return element.text || '';
    if (element.field && WORDING_FIELDS.has(element.field)) {
        if (element.text != null) return element.text;
        return FIELD_MAP[element.field]?.previewText ?? '';
    }
    if (element.field && FIELD_MAP[element.field]) {
        return FIELD_MAP[element.field].previewText;
    }
    return element.field || '';
}

function labelFor(element: CanvasElement, elements: CanvasElement[]): string {
    if (element.type === 'static') {
        return `Static Text ${staticTextOrdinal(elements, element.id)}`;
    }
    if (element.field && FIELD_MAP[element.field]) {
        return FIELD_MAP[element.field].label;
    }
    return element.field || 'Element';
}

function clampElementsToCanvas(
    elements: CanvasElement[],
    width: number,
    height: number,
): CanvasElement[] {
    return elements.map((el) => ({
        ...el,
        width: Math.min(el.width, width),
        height: Math.min(el.height, height),
        x: clamp(el.x, 0, Math.max(0, width - Math.min(el.width, width))),
        y: clamp(el.y, 0, Math.max(0, height - Math.min(el.height, height))),
    }));
}

type Selection = 'background' | string | null;

export default function TemplateEditor({
    mode,
    initialTemplateId,
    initialName,
    initialElements,
    initialCanvasWidth,
    initialCanvasHeight,
    initialBackgroundImageUrl,
    initialBackgroundFocus = null,
    hasIssuedCertificates = false,
    nested = false,
    onSaved,
}: TemplateEditorProps) {
    const router = useRouter();

    const [templateId, setTemplateId] = useState<number | null>(initialTemplateId);
    const [templateName, setTemplateName] = useState(initialName);
    const [elements, setElements] = useState<CanvasElement[]>(initialElements);
    const [canvasWidth, setCanvasWidth] = useState(initialCanvasWidth);
    const [canvasHeight, setCanvasHeight] = useState(initialCanvasHeight);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
        initialBackgroundImageUrl,
    );
    const [backgroundFocus, setBackgroundFocus] = useState<BackgroundFocus>(
        normalizeFocus(initialBackgroundFocus),
    );
    const [backgroundCleared, setBackgroundCleared] = useState(false);
    const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);
    const [selection, setSelection] = useState<Selection>(null);
    const [scale, setScale] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [textFitError, setTextFitError] = useState<string | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
    const [dirty, setDirty] = useState(false);
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
    const [issuedSaveConfirmOpen, setIssuedSaveConfirmOpen] = useState(false);

    const showIssuedWarning = mode === 'edit' && hasIssuedCertificates;

    const viewportRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const scaleRef = useRef(1);
    const localObjectUrlRef = useRef<string | null>(null);
    /** Blob URLs owned by this editor (host-loaded or local pick) — revoked on replace/unmount. */
    const ownedBackgroundUrlRef = useRef<string | null>(null);
    const pendingFileRef = useRef<File | null>(null);
    const backgroundClearedRef = useRef(false);
    const focusRef = useRef(backgroundFocus);
    const naturalSizeRef = useRef(naturalSize);
    const canvasSizeRef = useRef({ w: canvasWidth, h: canvasHeight });

    const isDragging = useRef(false);
    const dragElementId = useRef<string | null>(null);
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartElementPos = useRef({ x: 0, y: 0 });
    const isPanningBg = useRef(false);
    const panStartMouse = useRef({ x: 0, y: 0 });
    const panStartFocus = useRef(DEFAULT_FOCUS);

    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);

    useEffect(() => {
        focusRef.current = backgroundFocus;
    }, [backgroundFocus]);

    useEffect(() => {
        naturalSizeRef.current = naturalSize;
    }, [naturalSize]);

    useEffect(() => {
        canvasSizeRef.current = { w: canvasWidth, h: canvasHeight };
    }, [canvasWidth, canvasHeight]);

    useEffect(() => {
        pendingFileRef.current = pendingBackgroundFile;
    }, [pendingBackgroundFile]);

    useEffect(() => {
        backgroundClearedRef.current = backgroundCleared;
    }, [backgroundCleared]);

    // Sync host-provided background URL (after load / remount) and own the blob for cleanup.
    useEffect(() => {
        if (initialBackgroundImageUrl === backgroundImageUrl) {
            if (initialBackgroundImageUrl?.startsWith('blob:')) {
                ownedBackgroundUrlRef.current = initialBackgroundImageUrl;
            }
            return;
        }
        if (
            ownedBackgroundUrlRef.current &&
            ownedBackgroundUrlRef.current !== initialBackgroundImageUrl
        ) {
            URL.revokeObjectURL(ownedBackgroundUrlRef.current);
            ownedBackgroundUrlRef.current = null;
        }
        if (localObjectUrlRef.current && localObjectUrlRef.current !== initialBackgroundImageUrl) {
            URL.revokeObjectURL(localObjectUrlRef.current);
            localObjectUrlRef.current = null;
        }
        setBackgroundImageUrl(initialBackgroundImageUrl);
        if (initialBackgroundImageUrl?.startsWith('blob:')) {
            ownedBackgroundUrlRef.current = initialBackgroundImageUrl;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to host prop changes
    }, [initialBackgroundImageUrl]);

    useEffect(() => {
        return () => {
            if (localObjectUrlRef.current) {
                URL.revokeObjectURL(localObjectUrlRef.current);
                localObjectUrlRef.current = null;
            }
            if (ownedBackgroundUrlRef.current) {
                URL.revokeObjectURL(ownedBackgroundUrlRef.current);
                ownedBackgroundUrlRef.current = null;
            }
        };
    }, []);

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

    const selectedElementId = typeof selection === 'string' ? selection : null;
    const selectedElement = elements.find((el) => el.id === selectedElementId) ?? null;
    const backgroundSelected = selection === 'background';

    useEffect(() => {
        setTextFitError(null);
    }, [selectedElementId]);

    const markDirty = () => setDirty(true);

    const updateSelected = (patch: Partial<CanvasElement>) => {
        if (!selectedElementId || !selectedElement) return;

        if (isWordingElement(selectedElement)) {
            const next = { ...selectedElement, ...patch };
            const text = next.text ?? '';
            const fits =
                !text ||
                textFitsInBox(
                    text,
                    { fontSize: next.fontSize, fontWeight: next.fontWeight },
                    next.width,
                    next.height,
                );
            const isTextOnly = Object.keys(patch).length === 1 && 'text' in patch;

            if (isTextOnly && !fits) {
                setTextFitError(TEXT_OVERFLOW_MSG);
                return;
            }

            if (
                !fits &&
                (patch.fontSize != null ||
                    patch.width != null ||
                    patch.height != null ||
                    patch.fontWeight != null)
            ) {
                setTextFitError(TEXT_OVERFLOW_MSG);
            } else {
                setTextFitError(null);
            }
        } else {
            setTextFitError(null);
        }

        markDirty();
        setElements((prev) =>
            prev.map((el) => (el.id === selectedElementId ? { ...el, ...patch } : el)),
        );
    };

    const setCanvasDim = (axis: 'width' | 'height', raw: number) => {
        if (!Number.isFinite(raw)) return;
        const next = clamp(Math.round(raw), CANVAS_MIN, CANVAS_MAX);
        markDirty();
        if (axis === 'width') {
            setCanvasWidth(next);
            setElements((prev) => clampElementsToCanvas(prev, next, canvasHeight));
        } else {
            setCanvasHeight(next);
            setElements((prev) => clampElementsToCanvas(prev, canvasWidth, next));
        }
    };

    const fitCanvasToImage = () => {
        if (!naturalSize || naturalSize.w <= 0 || naturalSize.h <= 0) return;
        const nextW = clamp(Math.round(naturalSize.w), CANVAS_MIN, CANVAS_MAX);
        const nextH = clamp(Math.round(naturalSize.h), CANVAS_MIN, CANVAS_MAX);
        markDirty();
        setCanvasWidth(nextW);
        setCanvasHeight(nextH);
        setBackgroundFocus({ ...DEFAULT_FOCUS });
        setElements((prev) => clampElementsToCanvas(prev, nextW, nextH));
    };

    const updateFocus = (patch: Partial<BackgroundFocus>) => {
        markDirty();
        setBackgroundFocus((prev) =>
            normalizeFocus({
                ...prev,
                ...patch,
            }),
        );
    };

    const handleBackgroundFile = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (ownedBackgroundUrlRef.current) {
            URL.revokeObjectURL(ownedBackgroundUrlRef.current);
            ownedBackgroundUrlRef.current = null;
        }
        if (localObjectUrlRef.current) {
            URL.revokeObjectURL(localObjectUrlRef.current);
            localObjectUrlRef.current = null;
        }

        const objectUrl = URL.createObjectURL(file);
        localObjectUrlRef.current = objectUrl;
        ownedBackgroundUrlRef.current = objectUrl;
        pendingFileRef.current = file;
        setBackgroundImageUrl(objectUrl);
        setPendingBackgroundFile(file);
        setBackgroundCleared(false);
        setNaturalSize(null);
        setBackgroundFocus({ ...DEFAULT_FOCUS });
        setSelection('background');
        markDirty();
    };

    const clearBackground = () => {
        if (ownedBackgroundUrlRef.current) {
            URL.revokeObjectURL(ownedBackgroundUrlRef.current);
            ownedBackgroundUrlRef.current = null;
        }
        if (localObjectUrlRef.current) {
            URL.revokeObjectURL(localObjectUrlRef.current);
            localObjectUrlRef.current = null;
        }
        pendingFileRef.current = null;
        setBackgroundImageUrl(null);
        setPendingBackgroundFile(null);
        setBackgroundCleared(true);
        setNaturalSize(null);
        setBackgroundFocus({ ...DEFAULT_FOCUS });
        markDirty();
    };

    const addField = (fieldKey: string) => {
        if (
            fieldKey !== '__static' &&
            ONCE_ONLY_FIELDS.has(fieldKey) &&
            fieldAlreadyOnCanvas(elements, fieldKey)
        ) {
            return;
        }

        const id = crypto.randomUUID();
        const isVerificationUrl = fieldKey === 'verificationUrl';
        const base: CanvasElement = {
            id,
            type: fieldKey === '__static' ? 'static' : 'field',
            x: 80,
            y: 80 + elements.length * 40,
            width: isVerificationUrl ? 1400 : 500,
            height: isVerificationUrl ? 100 : DEFAULT_ELEMENT_HEIGHT,
            fontSize: isVerificationUrl ? 60 : DEFAULT_ELEMENT_FONT_SIZE,
            fontWeight: 'normal',
            align: 'center',
            color: isVerificationUrl ? '#0563C1' : '#ffffff',
        };

        if (fieldKey === '__static') {
            base.text = 'Your text here';
        } else {
            base.field = fieldKey;
            if (WORDING_FIELDS.has(fieldKey)) {
                base.text = FIELD_MAP[fieldKey]?.previewText ?? '';
            }
        }

        markDirty();
        setElements((prev) => [...prev, base]);
        setSelection(id);
    };

    const deleteSelected = () => {
        if (!selectedElementId) return;
        markDirty();
        setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
        setSelection(null);
    };

    const handleElementMouseDown = (e: ReactMouseEvent, element: CanvasElement) => {
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
                    const x = clamp(dragStartElementPos.current.x + dx, 0, Math.max(0, cw - el.width));
                    const y = clamp(dragStartElementPos.current.y + dy, 0, Math.max(0, ch - el.height));
                    return { ...el, x, y };
                }),
            );
            setDirty(true);
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

    const getPanExtents = (focus: BackgroundFocus, natural: { w: number; h: number } | null, cw: number, ch: number) => {
        if (!natural || natural.w <= 0 || natural.h <= 0) {
            return { maxX: 0, maxY: 0, scaledW: cw, scaledH: ch, left: 0, top: 0 };
        }
        const coverScale = Math.max(cw / natural.w, ch / natural.h);
        const totalScale = coverScale * focus.scale;
        const scaledW = natural.w * totalScale;
        const scaledH = natural.h * totalScale;
        const maxX = Math.max(0, scaledW - cw);
        const maxY = Math.max(0, scaledH - ch);
        const left = -maxX * focus.offsetX;
        const top = -maxY * focus.offsetY;
        return { maxX, maxY, scaledW, scaledH, left, top };
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
            const extents = getPanExtents(
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
            setBackgroundFocus(
                normalizeFocus({
                    ...panStartFocus.current,
                    offsetX: nextOffsetX,
                    offsetY: nextOffsetY,
                }),
            );
            setDirty(true);
        };

        const onUp = () => {
            isPanningBg.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const bgImgStyle = (): CSSProperties => {
        if (!naturalSize) {
            return {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${backgroundFocus.offsetX * 100}% ${backgroundFocus.offsetY * 100}%`,
                transform: backgroundFocus.scale > 1 ? `scale(${backgroundFocus.scale})` : undefined,
                transformOrigin: `${backgroundFocus.offsetX * 100}% ${backgroundFocus.offsetY * 100}%`,
                pointerEvents: backgroundSelected ? 'auto' : 'none',
                cursor: backgroundSelected && backgroundImageUrl ? 'grab' : 'default',
                userSelect: 'none',
            };
        }
        const { scaledW, scaledH, left, top } = getPanExtents(
            backgroundFocus,
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
            pointerEvents: backgroundSelected ? 'auto' : 'none',
            cursor: backgroundSelected ? 'grab' : 'default',
            userSelect: 'none',
        };
    };

    const leaveEditor = () => {
        setDiscardConfirmOpen(false);
        if (onSaved) {
            onSaved();
        } else {
            router.push('/certificates');
        }
    };

    const handleCancel = () => {
        if (!dirty) {
            leaveEditor();
            return;
        }
        setDiscardConfirmOpen(true);
    };

    const persistSave = async () => {
        const name = templateName.trim();
        if (!name) {
            setError('Template name is required');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            let activeId = templateId;
            const focusPayload = normalizeFocus(backgroundFocus);

            if (mode === 'create' && !activeId) {
                const created = await certificatesAPI.createTemplate({
                    name,
                    layout: elements,
                    canvasWidth,
                    canvasHeight,
                    backgroundFocus: focusPayload,
                });
                activeId = created.id;
                setTemplateId(created.id);
            } else if (activeId) {
                await certificatesAPI.updateTemplate(activeId, {
                    name,
                    layout: elements,
                    canvasWidth,
                    canvasHeight,
                    backgroundFocus: focusPayload,
                    ...(backgroundClearedRef.current && !pendingFileRef.current
                        ? { backgroundImagePath: null, backgroundImageSha: null }
                        : {}),
                });
            }

            const fileToUpload = pendingFileRef.current;
            if (activeId && fileToUpload) {
                try {
                    const uploaded = await certificatesAPI.uploadTemplateBackground(
                        activeId,
                        fileToUpload,
                    );
                    await certificatesAPI.updateTemplateBackground(activeId, {
                        backgroundImagePath: uploaded.backgroundImagePath,
                        backgroundImageSha: uploaded.backgroundImageSha,
                    });
                    setPendingBackgroundFile(null);
                    pendingFileRef.current = null;
                    setBackgroundCleared(false);
                } catch (uploadErr) {
                    setError(getErrorMessage(uploadErr, 'Failed to upload background'));
                    setSaving(false);
                    return;
                }
            }

            setDirty(false);
            leaveEditor();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save template'));
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        const name = templateName.trim();
        if (!name) {
            setError('Template name is required');
            return;
        }

        if (showIssuedWarning) {
            setIssuedSaveConfirmOpen(true);
            return;
        }

        void persistSave();
    };

    return (
        <div className={`template-editor${nested ? ' template-editor--nested' : ''}`}>
            {error ? <div className="template-editor-error">{error}</div> : null}

            {showIssuedWarning ? (
                <div className="template-editor-issued-warning" role="status">
                    <p>
                        Changes save to the live template and immediately affect all issued
                        certificates that use it (custom, event, and project).
                    </p>
                    <p>
                        If this template was reused for different contexts (e.g. attendance
                        wording vs contribution), new static text or layout may look wrong or
                        confusing on some certificates when verified.
                    </p>
                </div>
            ) : null}

            <div className="template-editor-body">
                <aside className="template-editor-panel">
                    <h2 className="template-editor-panel-title">Fields</h2>
                    <div className="template-editor-field-list">
                        <button
                            type="button"
                            className={`template-editor-field-btn${
                                backgroundSelected ? ' template-editor-field-btn--active' : ''
                            }`}
                            onClick={() => setSelection('background')}
                        >
                            Background
                        </button>
                        {AVAILABLE_FIELDS.map((field) => {
                            const alreadyOnCanvas =
                                field.field !== '__static' &&
                                ONCE_ONLY_FIELDS.has(field.field) &&
                                fieldAlreadyOnCanvas(elements, field.field);
                            return (
                                <button
                                    key={field.field}
                                    type="button"
                                    className="template-editor-field-btn"
                                    disabled={alreadyOnCanvas}
                                    title={
                                        alreadyOnCanvas
                                            ? 'Already on canvas (only one allowed)'
                                            : undefined
                                    }
                                    onClick={() => addField(field.field)}
                                >
                                    {field.label}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <div className="template-editor-center">
                    <div className="template-editor-name-row">
                        <input
                            type="text"
                            className="template-editor-name-input"
                            value={templateName}
                            onChange={(e) => {
                                setTemplateName(e.target.value);
                                markDirty();
                            }}
                            placeholder="Template name"
                            aria-label="Template name"
                        />
                    </div>

                    <div
                        ref={viewportRef}
                        className="template-editor-canvas-viewport"
                        onClick={() => setSelection(null)}
                    >
                        <div
                            className="template-editor-canvas-scale-wrap"
                            style={{
                                width: canvasWidth * scale,
                                height: canvasHeight * scale,
                            }}
                        >
                            <div
                                className={`template-editor-canvas${
                                    backgroundSelected ? ' template-editor-canvas--bg-selected' : ''
                                }`}
                                style={{
                                    width: canvasWidth,
                                    height: canvasHeight,
                                    transform: `scale(${scale})`,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (backgroundSelected) return;
                                    setSelection(null);
                                }}
                            >
                                {backgroundImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={backgroundImageUrl}
                                        alt=""
                                        className="template-editor-bg-img"
                                        draggable={false}
                                        style={bgImgStyle()}
                                        onLoad={(e) => {
                                            const w = e.currentTarget.naturalWidth;
                                            const h = e.currentTarget.naturalHeight;
                                            if (w > 0 && h > 0) {
                                                setNaturalSize({ w, h });
                                            }
                                        }}
                                        onMouseDown={handleBackgroundPanStart}
                                    />
                                ) : (
                                    <div
                                        className="template-editor-bg-placeholder"
                                        onMouseDown={(e) => {
                                            if (!backgroundSelected) return;
                                            e.stopPropagation();
                                        }}
                                    />
                                )}

                                {elements.map((element) => {
                                    const selected = element.id === selectedElementId;
                                    return (
                                        <div
                                            key={element.id}
                                            className={[
                                                'template-editor-element',
                                                `template-editor-element--align-${element.align}`,
                                                selected ? 'template-editor-element--selected' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelection(element.id);
                                            }}
                                            onMouseDown={(e) => handleElementMouseDown(e, element)}
                                        >
                                            {previewTextFor(element)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="template-editor-toolbar">
                        {dirty ? (
                            <span className="template-editor-toolbar-dirty" aria-live="polite">
                                Unsaved changes
                            </span>
                        ) : (
                            <span className="template-editor-toolbar-dirty template-editor-toolbar-dirty--idle" />
                        )}
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={saving}
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={handleSave}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>

                <aside className="template-editor-panel template-editor-panel--right">
                    <h2 className="template-editor-panel-title">Properties</h2>
                    {backgroundSelected ? (
                        <div className="template-editor-props">
                            <div className="template-editor-prop-group">
                                <span className="form-label">Background</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="template-editor-file-input"
                                    onChange={handleBackgroundFile}
                                />
                                <div className="template-editor-prop-row">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {backgroundImageUrl ? 'Replace image' : 'Choose image'}
                                    </button>
                                    {backgroundImageUrl ? (
                                        <button
                                            type="button"
                                            className="btn btn-danger"
                                            onClick={clearBackground}
                                        >
                                            Clear
                                        </button>
                                    ) : null}
                                </div>
                                {pendingBackgroundFile ? (
                                    <p className="template-editor-hint">
                                        Background uploads when you save.
                                    </p>
                                ) : null}
                            </div>

                            <div className="template-editor-prop-group">
                                <label className="form-label" htmlFor="te-canvas-w">
                                    Canvas width (px)
                                </label>
                                <ClampedNumberInput
                                    id="te-canvas-w"
                                    min={CANVAS_MIN}
                                    max={CANVAS_MAX}
                                    value={canvasWidth}
                                    onCommit={(v) => setCanvasDim('width', v)}
                                />
                            </div>

                            <div className="template-editor-prop-group">
                                <label className="form-label" htmlFor="te-canvas-h">
                                    Canvas height (px)
                                </label>
                                <ClampedNumberInput
                                    id="te-canvas-h"
                                    min={CANVAS_MIN}
                                    max={CANVAS_MAX}
                                    value={canvasHeight}
                                    onCommit={(v) => setCanvasDim('height', v)}
                                />
                            </div>

                            {backgroundImageUrl && naturalSize ? (
                                <div className="template-editor-prop-group">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={fitCanvasToImage}
                                    >
                                        Fit to image
                                    </button>
                                    <p className="template-editor-hint">
                                        Sets canvas size to the image&apos;s pixel dimensions (
                                        {naturalSize.w}×{naturalSize.h}
                                        ).
                                    </p>
                                </div>
                            ) : null}

                            {backgroundImageUrl ? (
                                <>
                                    <div className="template-editor-prop-group">
                                        <label className="form-label" htmlFor="te-bg-zoom">
                                            Zoom ({backgroundFocus.scale.toFixed(2)}×)
                                        </label>
                                        <input
                                            id="te-bg-zoom"
                                            type="range"
                                            min={1}
                                            max={FOCUS_SCALE_MAX}
                                            step={0.01}
                                            className="template-editor-range"
                                            value={backgroundFocus.scale}
                                            onChange={(e) =>
                                                updateFocus({ scale: Number(e.target.value) })
                                            }
                                        />
                                    </div>
                                    <p className="template-editor-hint">
                                        Drag the background on the canvas to pan focus.
                                    </p>
                                </>
                            ) : null}
                        </div>
                    ) : !selectedElement ? (
                        <p className="template-editor-props-empty">
                            Select Background or an element to edit
                        </p>
                    ) : (
                        <div className="template-editor-props">
                            <div className="template-editor-prop-group">
                                <span className="form-label">
                                    {labelFor(selectedElement, elements)}
                                </span>
                            </div>

                            <div className="template-editor-prop-group">
                                <label className="form-label" htmlFor="te-font-size">
                                    Font Size
                                </label>
                                <ClampedNumberInput
                                    id="te-font-size"
                                    min={8}
                                    max={120}
                                    value={selectedElement.fontSize}
                                    onCommit={(v) => updateSelected({ fontSize: v })}
                                />
                            </div>

                            <div className="template-editor-prop-group">
                                <span className="form-label">Font Weight</span>
                                <div className="template-editor-prop-row">
                                    <button
                                        type="button"
                                        className={`template-editor-toggle-btn${
                                            selectedElement.fontWeight === 'normal' ? ' active' : ''
                                        }`}
                                        onClick={() => updateSelected({ fontWeight: 'normal' })}
                                    >
                                        Normal
                                    </button>
                                    <button
                                        type="button"
                                        className={`template-editor-toggle-btn${
                                            selectedElement.fontWeight === 'bold' ? ' active' : ''
                                        }`}
                                        onClick={() => updateSelected({ fontWeight: 'bold' })}
                                    >
                                        Bold
                                    </button>
                                </div>
                            </div>

                            <div className="template-editor-prop-group">
                                <span className="form-label">Align</span>
                                <div className="template-editor-prop-row">
                                    <button
                                        type="button"
                                        className={`template-editor-toggle-btn${
                                            selectedElement.align === 'left' ? ' active' : ''
                                        }`}
                                        aria-label="Align left"
                                        onClick={() => updateSelected({ align: 'left' })}
                                    >
                                        <AlignLeft size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className={`template-editor-toggle-btn${
                                            selectedElement.align === 'center' ? ' active' : ''
                                        }`}
                                        aria-label="Align center"
                                        onClick={() => updateSelected({ align: 'center' })}
                                    >
                                        <AlignCenter size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className={`template-editor-toggle-btn${
                                            selectedElement.align === 'right' ? ' active' : ''
                                        }`}
                                        aria-label="Align right"
                                        onClick={() => updateSelected({ align: 'right' })}
                                    >
                                        <AlignRight size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="template-editor-prop-group">
                                <label className="form-label" htmlFor="te-color">
                                    Color
                                </label>
                                <input
                                    id="te-color"
                                    type="color"
                                    className="template-editor-color-input"
                                    value={selectedElement.color}
                                    onChange={(e) => updateSelected({ color: e.target.value })}
                                />
                            </div>

                            <div className="template-editor-prop-group">
                                <label className="form-label" htmlFor="te-width">
                                    Width
                                </label>
                                <ClampedNumberInput
                                    id="te-width"
                                    min={20}
                                    max={CANVAS_MAX}
                                    value={selectedElement.width}
                                    onCommit={(v) => updateSelected({ width: v })}
                                />
                            </div>

                            <div className="template-editor-prop-group">
                                <label className="form-label" htmlFor="te-height">
                                    Height
                                </label>
                                <ClampedNumberInput
                                    id="te-height"
                                    min={20}
                                    max={CANVAS_MAX}
                                    value={selectedElement.height}
                                    onCommit={(v) => updateSelected({ height: v })}
                                />
                            </div>

                            {isWordingElement(selectedElement) ? (
                                <div className="template-editor-prop-group">
                                    <label className="form-label" htmlFor="te-text">
                                        Text Content
                                    </label>
                                    <textarea
                                        id="te-text"
                                        className="form-input template-editor-prop-textarea"
                                        value={selectedElement.text || ''}
                                        onChange={(e) => updateSelected({ text: e.target.value })}
                                        aria-invalid={textFitError ? true : undefined}
                                        aria-describedby={
                                            textFitError ? 'te-text-fit-error' : undefined
                                        }
                                    />
                                </div>
                            ) : null}

                            {textFitError ? (
                                <span
                                    id="te-text-fit-error"
                                    className="field-error"
                                    role="alert"
                                >
                                    {textFitError}
                                </span>
                            ) : null}

                            <button
                                type="button"
                                className="btn btn-danger template-editor-delete-btn"
                                onClick={deleteSelected}
                            >
                                Delete Element
                            </button>
                        </div>
                    )}
                </aside>
            </div>

            {discardConfirmOpen ? (
                <>
                    <div
                        className="modal-backdrop"
                        onClick={() => setDiscardConfirmOpen(false)}
                    />
                    <div
                        className="modal-container modal-warning"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="te-discard-title"
                    >
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <h2 className="modal-title" id="te-discard-title">
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

            {issuedSaveConfirmOpen ? (
                <>
                    <div
                        className="modal-backdrop"
                        onClick={() => setIssuedSaveConfirmOpen(false)}
                    />
                    <div
                        className="modal-container modal-warning"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="te-issued-save-title"
                    >
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <h2 className="modal-title" id="te-issued-save-title">
                                    Update template used by issued certificates?
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setIssuedSaveConfirmOpen(false)}
                                aria-label="Close"
                            >
                                <X />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Changes save to the live template and immediately affect all
                                issued certificates that use it (custom, event, and project).
                            </p>
                            <p>
                                If this template was reused for different contexts (e.g.
                                attendance wording vs contribution), new static text or layout
                                may look wrong or confusing on some certificates when verified.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={saving}
                                onClick={() => setIssuedSaveConfirmOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-warning"
                                disabled={saving}
                                onClick={() => {
                                    setIssuedSaveConfirmOpen(false);
                                    void persistSave();
                                }}
                            >
                                {saving ? 'Saving…' : 'Save anyway'}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
