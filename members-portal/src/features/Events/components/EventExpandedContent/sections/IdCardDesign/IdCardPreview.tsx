'use client';



import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import QRCode from 'qrcode';

import type {

    IdCardBackgroundFocus,

    IdCardLayoutElement,

} from '@/types/backend-contracts';

import {

    DEFAULT_ID_CARD_BACKGROUND_FOCUS,

    getIdCardPanExtents,

    parseIdCardBackgroundFocus,

    sampleIdCardFieldValue,

} from './idCardFields';

import './IdCardPreview.css';



export interface IdCardPreviewProps {

    elements: IdCardLayoutElement[];

    canvasWidth: number;

    canvasHeight: number;

    backgroundImageUrl?: string | null;

    backgroundFocus?: IdCardBackgroundFocus | null;

    qrValue?: string;

    resolveValue?: (fieldKey: string) => string;

    /** When true, fit canvas to container width; otherwise use full pixel size. */

    fitToContainer?: boolean;

    className?: string;

    label?: string;

    /** Exposed for html2canvas print: render at 1:1 without selection chrome. */

    forPrint?: boolean;

}



function clamp(n: number, min: number, max: number): number {

    return Math.min(max, Math.max(min, n));

}



function textForElement(

    element: IdCardLayoutElement,

    resolveValue?: (fieldKey: string) => string,

): string {

    if (element.type === 'static') return element.text ?? '';

    if (element.type === 'field' && element.field) {

        if (resolveValue) return resolveValue(element.field);

        return sampleIdCardFieldValue(element.field);

    }

    return '';

}



function useQrDataUrl(value: string, pixelSize: number): string | null {

    const [dataUrl, setDataUrl] = useState<string | null>(null);



    useEffect(() => {

        let cancelled = false;

        const size = Math.max(32, Math.round(pixelSize));

        void QRCode.toDataURL(value || 'SAMPLE', {

            margin: 2,

            width: size,

            color: {

                dark: '#000000',

                light: '#ffffff',

            },

        }).then((url) => {

            if (!cancelled) setDataUrl(url);

        }).catch(() => {

            if (!cancelled) setDataUrl(null);

        });

        return () => {

            cancelled = true;

        };

    }, [value, pixelSize]);



    return dataUrl;

}



function IdCardQrCell({

    value,

    size,

}: {

    value: string;

    size: number;

}) {

    const qrUrl = useQrDataUrl(value, size);

    if (!qrUrl) {

        return <div className="id-card-preview__qr-placeholder" aria-hidden />;

    }

    return (

        // eslint-disable-next-line @next/next/no-img-element

        <img

            src={qrUrl}

            alt=""

            className="id-card-preview__qr-img"

            width={size}

            height={size}

            draggable={false}

        />

    );

}



function bgImgStyle(

    focus: IdCardBackgroundFocus,

    naturalSize: { w: number; h: number } | null,

    canvasWidth: number,

    canvasHeight: number,

): CSSProperties {

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

    const { scaledW, scaledH, left, top } = getIdCardPanExtents(

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

}



export default function IdCardPreview({

    elements,

    canvasWidth,

    canvasHeight,

    backgroundImageUrl = null,

    backgroundFocus = null,

    qrValue = 'SAMPLE1234',

    resolveValue,

    fitToContainer = true,

    className = '',

    label = '',

    forPrint = false,

}: IdCardPreviewProps) {

    const [containerWidth, setContainerWidth] = useState<number | null>(null);

    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);



    const focus = useMemo(

        () => parseIdCardBackgroundFocus(backgroundFocus ?? DEFAULT_ID_CARD_BACKGROUND_FOCUS),

        [backgroundFocus],

    );



    useEffect(() => {

        setNaturalSize(null);

    }, [backgroundImageUrl]);



    useEffect(() => {

        if (!fitToContainer || !containerEl) return undefined;

        const update = () => {

            const w = containerEl.clientWidth;

            if (w > 0) setContainerWidth(w);

        };

        update();

        const observer = new ResizeObserver(update);

        observer.observe(containerEl);

        return () => observer.disconnect();

    }, [containerEl, fitToContainer]);



    const scale = useMemo(() => {

        if (!fitToContainer) return 1;

        if (!containerWidth || canvasWidth <= 0) return 1;

        return clamp(containerWidth / canvasWidth, 0.05, 4);

    }, [canvasWidth, containerWidth, fitToContainer]);



    const wrapStyle: CSSProperties = fitToContainer

        ? {

            width: '100%',

            height: canvasHeight * scale,

        }

        : {

            width: canvasWidth,

            height: canvasHeight,

        };



    const canvasStyle: CSSProperties = {

        width: canvasWidth,

        height: canvasHeight,

        transform: scale !== 1 ? `scale(${scale})` : undefined,

        transformOrigin: 'top left',

    };



    return (

        <div className={`id-card-preview-wrap ${className}`.trim()}>

            {label ? <p className="id-card-preview-label">{label}</p> : null}

            <div

                ref={setContainerEl}

                className={`id-card-preview-scale${forPrint ? ' id-card-preview-scale--print' : ''}`}

                style={wrapStyle}

            >

                <div className="id-card-preview" style={canvasStyle}>

                    {backgroundImageUrl ? (

                        // eslint-disable-next-line @next/next/no-img-element

                        <img

                            src={backgroundImageUrl}

                            alt=""

                            className="id-card-preview__bg"

                            draggable={false}

                            style={bgImgStyle(focus, naturalSize, canvasWidth, canvasHeight)}

                            onLoad={(e) => {

                                const w = e.currentTarget.naturalWidth;

                                const h = e.currentTarget.naturalHeight;

                                if (w > 0 && h > 0) setNaturalSize({ w, h });

                            }}

                        />

                    ) : (

                        <div className="id-card-preview__bg-placeholder" aria-hidden />

                    )}



                    {elements.map((element) => {

                        if (element.type === 'qr') {

                            const size = Math.max(1, element.width);

                            return (

                                <div

                                    key={element.id}

                                    className="id-card-preview__element id-card-preview__element--qr"

                                    style={{

                                        left: element.x,

                                        top: element.y,

                                        width: size,

                                        height: size,

                                    }}

                                >

                                    <IdCardQrCell value={qrValue} size={size} />

                                </div>

                            );

                        }



                        const align = element.align ?? 'left';

                        return (

                            <div

                                key={element.id}

                                className={[

                                    'id-card-preview__element',

                                    'id-card-preview__element--text',

                                    `id-card-preview__element--align-${align}`,

                                ].join(' ')}

                                style={{

                                    left: element.x,

                                    top: element.y,

                                    width: element.width,

                                    height: element.height,

                                    fontSize: element.fontSize ?? 16,

                                    fontWeight: element.fontWeight ?? 'normal',

                                    textAlign: align,

                                    color: element.color ?? '#111827',

                                }}

                            >

                                {textForElement(element, resolveValue)}

                            </div>

                        );

                    })}

                </div>

            </div>

        </div>

    );

}


