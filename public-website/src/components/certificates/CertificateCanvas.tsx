"use client";

import {
    forwardRef,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import {
    publicAPI,
    type PublicCertificateBackgroundFocus,
    type PublicCertificateTemplate,
    type PublicCertificateVerify,
} from "@/lib/api";
import { getPublicOrigin } from "@/lib/share";
import "./CertificateCanvas.css";

interface CanvasElement {
    id: string;
    type: "field" | "static";
    field?: string;
    text?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: "normal" | "bold";
    align: "left" | "center" | "right";
    color: string;
}

const DEFAULT_FOCUS: PublicCertificateBackgroundFocus = {
    scale: 1,
    offsetX: 0.5,
    offsetY: 0.5,
};

const MIN_DISPLAY_WIDTH = 280;

function parseLayout(layout: unknown): CanvasElement[] {
    if (!Array.isArray(layout)) return [];
    return layout as CanvasElement[];
}

function parseBackgroundFocus(value: unknown): PublicCertificateBackgroundFocus {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
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

function formatIssuedDate(issuedAt: string | null): string {
    if (!issuedAt) return "";
    const date = new Date(issuedAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function buildVerificationUrl(code: string): string {
    const base = getPublicOrigin().replace(/\/$/, "");
    return `${base}/verify/${encodeURIComponent(code)}`;
}

function fieldValueFor(
    element: CanvasElement,
    certificate: PublicCertificateVerify,
    issuedDate: string,
    issuerName: string,
    verificationUrl: string,
    staticTextOverrides: Record<string, string>,
): string {
    if (element.type === "static") {
        const override = staticTextOverrides[element.id];
        if (typeof override === "string") return override;
        return element.text || "";
    }
    switch (element.field) {
        case "recipientName":
            return certificate.recipientName || "";
        case "title":
            return certificate.title || "";
        case "description":
            return certificate.description || "";
        case "issuedDate":
            return issuedDate;
        case "verificationCode":
            return certificate.verificationCode || "";
        case "verificationUrl":
            return verificationUrl;
        case "issuerName":
            return issuerName;
        default:
            return element.field || "";
    }
}

function readStaticTextOverrides(fieldValues: unknown): Record<string, string> {
    if (!fieldValues || typeof fieldValues !== "object" || Array.isArray(fieldValues)) {
        return {};
    }
    const raw = (fieldValues as Record<string, unknown>).staticTexts;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === "string") out[id] = value;
    }
    return out;
}

function getPanExtents(
    focus: PublicCertificateBackgroundFocus,
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

export interface CertificateCanvasProps {
    certificate: PublicCertificateVerify;
    template: PublicCertificateTemplate;
    /** Verification code used to fetch the background image. */
    verificationCode: string;
}

const CertificateCanvas = forwardRef<HTMLDivElement, CertificateCanvasProps>(function CertificateCanvas(
    { certificate, template, verificationCode },
    ref,
) {
    const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
    const [bgError, setBgError] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(MIN_DISPLAY_WIDTH);
    const viewportRef = useRef<HTMLDivElement>(null);

    const canvasWidth = template.canvasWidth || 1122;
    const canvasHeight = template.canvasHeight || 794;

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const update = (width: number) => {
            setViewportWidth(Math.max(MIN_DISPLAY_WIDTH, Math.floor(width)));
        };

        update(el.clientWidth);

        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? el.clientWidth;
            update(width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!template.hasBackground) {
            setBackgroundUrl(null);
            setNaturalSize(null);
            setBgError(false);
            return;
        }

        let cancelled = false;
        let ownedBlobUrl: string | null = null;
        let handedOff = false;

        const load = async () => {
            setBgError(false);
            setNaturalSize(null);
            try {
                const response = await fetch(
                    publicAPI.getCertificateBackgroundUrl(verificationCode),
                    { cache: "no-store" },
                );
                if (!response.ok) {
                    throw new Error("Failed to load certificate background");
                }
                const blob = await response.blob();
                ownedBlobUrl = URL.createObjectURL(blob);
                if (cancelled) {
                    URL.revokeObjectURL(ownedBlobUrl);
                    ownedBlobUrl = null;
                    return;
                }
                setBackgroundUrl(ownedBlobUrl);
                handedOff = true;
                ownedBlobUrl = null;
            } catch {
                if (!cancelled) {
                    setBgError(true);
                    setBackgroundUrl(null);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
            if (!handedOff && ownedBlobUrl) {
                URL.revokeObjectURL(ownedBlobUrl);
            }
        };
    }, [template.hasBackground, verificationCode]);

    useEffect(() => {
        return () => {
            if (backgroundUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(backgroundUrl);
            }
        };
    }, [backgroundUrl]);

    const elements = useMemo(() => parseLayout(template.layout), [template.layout]);
    const focus = useMemo(
        () => parseBackgroundFocus(template.backgroundFocus),
        [template.backgroundFocus],
    );

    const issuedDate = useMemo(
        () => formatIssuedDate(certificate.issuedAt),
        [certificate.issuedAt],
    );
    const issuerName = useMemo(() => {
        if (certificate.fieldValues && typeof certificate.fieldValues.issuerName === "string") {
            return certificate.fieldValues.issuerName.trim();
        }
        return "";
    }, [certificate.fieldValues]);

    const staticTextOverrides = useMemo(
        () => readStaticTextOverrides(certificate.fieldValues),
        [certificate.fieldValues],
    );

    const verificationUrl = useMemo(
        () => buildVerificationUrl(certificate.verificationCode || verificationCode),
        [certificate.verificationCode, verificationCode],
    );

    const fitScale = viewportWidth / canvasWidth;

    const bgStyle = (): CSSProperties => {
        if (!naturalSize) {
            return {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${focus.offsetX * 100}% ${focus.offsetY * 100}%`,
                transform: focus.scale > 1 ? `scale(${focus.scale})` : undefined,
                transformOrigin: `${focus.offsetX * 100}% ${focus.offsetY * 100}%`,
                pointerEvents: "none",
                userSelect: "none",
            };
        }
        const { scaledW, scaledH, left, top } = getPanExtents(
            focus,
            naturalSize,
            canvasWidth,
            canvasHeight,
        );
        return {
            position: "absolute",
            left,
            top,
            width: scaledW,
            height: scaledH,
            maxWidth: "none",
            pointerEvents: "none",
            userSelect: "none",
        };
    };

    return (
        <div
            ref={viewportRef}
            className="certificate-canvas-viewport"
            aria-label="Certificate"
        >
            <div
                className="certificate-canvas-scale-wrap"
                style={{
                    width: canvasWidth * fitScale,
                    height: canvasHeight * fitScale,
                }}
            >
                <div
                    ref={ref}
                    className="certificate-canvas"
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
                            className="certificate-canvas-bg"
                            draggable={false}
                            style={bgStyle()}
                            onLoad={(e) => {
                                const w = e.currentTarget.naturalWidth;
                                const h = e.currentTarget.naturalHeight;
                                if (w > 0 && h > 0) setNaturalSize({ w, h });
                            }}
                        />
                    ) : (
                        <div
                            className={`certificate-canvas-bg-placeholder${bgError ? " certificate-canvas-bg-placeholder--error" : ""}`}
                        />
                    )}
                    {elements.map((element) => {
                        const isVerifyLink =
                            element.type === "field" && element.field === "verificationUrl";
                        return (
                            <div
                                key={element.id}
                                className={`certificate-canvas-element certificate-canvas-element--align-${element.align}`}
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
                                {...(isVerifyLink
                                    ? {
                                          "data-verify-link": "",
                                          "data-verify-href": verificationUrl,
                                      }
                                    : {})}
                            >
                                {fieldValueFor(
                                    element,
                                    certificate,
                                    issuedDate,
                                    issuerName,
                                    verificationUrl,
                                    staticTextOverrides,
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

export default CertificateCanvas;
