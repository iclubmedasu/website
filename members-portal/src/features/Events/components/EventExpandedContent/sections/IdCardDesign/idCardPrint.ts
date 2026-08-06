import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type {
    EventCustomFieldRef,
    EventIdCardDesignRef,
    EventRegistrationRef,
    EventTierRef,
    IdCardLayoutElement,
} from '@/types/backend-contracts';
import IdCardPreview from './IdCardPreview';
import {
    canvasSizeFromDesign,
    focusFromDesign,
    layoutFromDesign,
    resolveIdCardFieldValue,
} from './idCardFields';
import './IdCardPreview.css';

export interface PrintIdCardOptions {
    registration: EventRegistrationRef;
    idCardDesign?: EventIdCardDesignRef | null;
    tiers?: EventTierRef[];
    fields?: EventCustomFieldRef[];
    backgroundImageUrl?: string | null;
}

function waitForImages(root: HTMLElement): Promise<void> {
    const images = Array.from(root.querySelectorAll('img'));
    return Promise.all(
        images.map(
            (img) =>
                new Promise<void>((resolve) => {
                    if (img.complete) {
                        resolve();
                        return;
                    }
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                }),
        ),
    ).then(() => undefined);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function createPrintIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print ID card');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = [
        'position:fixed',
        'right:0',
        'bottom:0',
        'width:0',
        'height:0',
        'border:0',
        'opacity:0',
        'pointer-events:none',
    ].join(';');
    document.body.appendChild(iframe);
    return iframe;
}

function cleanupIframe(iframe: HTMLIFrameElement): void {
    try {
        iframe.remove();
    } catch {
        // Already removed.
    }
}

/**
 * Render the populated ID card off-screen, rasterize with html2canvas,
 * inject into a temporary iframe, and call window.print() (no popup).
 */
export async function printIdCard(options: PrintIdCardOptions): Promise<void> {
    const {
        registration,
        idCardDesign,
        tiers = [],
        fields = [],
        backgroundImageUrl = null,
    } = options;

    const size = canvasSizeFromDesign(idCardDesign);
    const elements: IdCardLayoutElement[] = layoutFromDesign(idCardDesign);
    const qrValue = registration.confirmationCode || '—';
    const resolveValue = (fieldKey: string) =>
        resolveIdCardFieldValue(fieldKey, registration, tiers, fields);

    const host = document.createElement('div');
    host.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:auto',
        'height:auto',
        'pointer-events:none',
        'opacity:1',
        'z-index:-1',
    ].join(';');
    document.body.appendChild(host);

    const root = createRoot(host);
    const iframe = createPrintIframe();
    const printWin = iframe.contentWindow;
    const printDoc = iframe.contentDocument;

    if (!printWin || !printDoc) {
        cleanupIframe(iframe);
        host.remove();
        throw new Error('Could not prepare print frame for ID card.');
    }

    try {
        root.render(
            createElement(IdCardPreview, {
                elements,
                canvasWidth: size.width,
                canvasHeight: size.height,
                backgroundImageUrl,
                backgroundFocus: focusFromDesign(idCardDesign),
                qrValue,
                resolveValue,
                fitToContainer: false,
                forPrint: true,
            }),
        );

        // Allow React commit + QR generation
        await delay(100);
        await waitForImages(host);
        await delay(450);
        await waitForImages(host);

        const target = host.querySelector('.id-card-preview') as HTMLElement | null;
        if (!target) {
            throw new Error('Failed to render ID card for print');
        }

        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default;
        const canvas = await html2canvas(target, {
            backgroundColor: '#ffffff',
            scale: 3,
            useCORS: true,
            logging: false,
            width: size.width,
            height: size.height,
        });

        const dataUrl = canvas.toDataURL('image/png');
        const widthIn = size.width / 96;
        const heightIn = size.height / 96;
        const safeName = registration.fullName.replace(/[<>&"]/g, '');

        printDoc.open();
        printDoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>ID Card — ${safeName}</title>
<style>
  @page { size: auto; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }
  body {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }
  img {
    display: block;
    width: ${widthIn}in;
    height: ${heightIn}in;
  }
</style>
</head>
<body>
<img src="${dataUrl}" alt="ID card" width="${size.width}" height="${size.height}" />
</body>
</html>`);
        printDoc.close();

        await new Promise<void>((resolve) => {
            const img = printDoc.querySelector('img');
            if (!img || img.complete) {
                resolve();
                return;
            }
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
        });

        await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                printWin.removeEventListener('afterprint', finish);
                window.clearTimeout(fallbackTimer);
                resolve();
            };

            printWin.addEventListener('afterprint', finish);
            const fallbackTimer = window.setTimeout(finish, 60_000);

            printWin.focus();
            printWin.print();
        });
    } finally {
        root.unmount();
        host.remove();
        cleanupIframe(iframe);
    }
}
