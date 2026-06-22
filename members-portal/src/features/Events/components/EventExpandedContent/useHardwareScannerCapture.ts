import {
    useCallback,
    useEffect,
    useRef,
    type ChangeEvent,
    type KeyboardEvent,
    type RefObject,
} from 'react';
import { parseScannedPayload } from './checkInScanUtils';

const MAX_INTER_KEY_MS = 80;
const MIN_SCANNER_LENGTH = 4;
const SUBMIT_KEYS = new Set(['Enter', 'Tab']);

function isInsideDialog(element: Element | null): boolean {
    return Boolean(element?.closest('[role="dialog"]'));
}

function isInteractiveElement(element: Element | null): boolean {
    if (!element) return false;
    const tag = element.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') {
        return true;
    }
    if (element.closest('[contenteditable="true"]')) {
        return true;
    }
    return isInsideDialog(element);
}

function shouldCaptureWedgeKeys(enabled: boolean, manualInputRef: RefObject<HTMLInputElement | null>): boolean {
    if (!enabled) return false;
    if (isInsideDialog(document.activeElement)) return false;

    const active = document.activeElement;
    if (!active || active === document.body) {
        return true;
    }

    if (active === manualInputRef.current) {
        return false;
    }

    if (isInteractiveElement(active)) {
        return false;
    }

    return true;
}

interface UseHardwareScannerCaptureOptions {
    enabled: boolean;
    manualInputRef: RefObject<HTMLInputElement | null>;
    onScan: (raw: string) => void;
}

export function useHardwareScannerCapture({
    enabled,
    manualInputRef,
    onScan,
}: UseHardwareScannerCaptureOptions) {
    const captureInputRef = useRef<HTMLInputElement>(null);
    const keyBufferRef = useRef<{ chars: string[]; lastAt: number }>({ chars: [], lastAt: 0 });
    const onScanRef = useRef(onScan);

    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    const focusCaptureInputIfAllowed = useCallback(() => {
        if (!enabled) return;
        if (isInsideDialog(document.activeElement)) return;
        if (document.activeElement === manualInputRef.current) return;
        if (isInteractiveElement(document.activeElement) && document.activeElement !== captureInputRef.current) {
            return;
        }
        captureInputRef.current?.focus({ preventScroll: true });
    }, [enabled, manualInputRef]);

    useEffect(() => {
        if (!enabled) return;
        focusCaptureInputIfAllowed();
    }, [enabled, focusCaptureInputIfAllowed]);

    const submitScan = useCallback((raw: string) => {
        const parsed = parseScannedPayload(raw);
        if (parsed) {
            onScanRef.current(raw);
        }
        if (captureInputRef.current) {
            captureInputRef.current.value = '';
        }
        keyBufferRef.current = { chars: [], lastAt: 0 };
    }, []);

    const processWedgeKey = useCallback((event: globalThis.KeyboardEvent) => {
        if (!shouldCaptureWedgeKeys(enabled, manualInputRef)) {
            keyBufferRef.current = { chars: [], lastAt: 0 };
            return;
        }

        const now = Date.now();
        const buffer = keyBufferRef.current;

        if (SUBMIT_KEYS.has(event.key)) {
            const candidate = buffer.chars.join('').trim();
            if (candidate.length >= MIN_SCANNER_LENGTH) {
                event.preventDefault();
                submitScan(candidate);
                window.setTimeout(() => focusCaptureInputIfAllowed(), 100);
            }
            return;
        }

        if (event.key.length !== 1) {
            return;
        }

        const elapsed = now - buffer.lastAt;
        if (buffer.chars.length > 0 && elapsed > MAX_INTER_KEY_MS) {
            buffer.chars = [];
        }

        buffer.chars.push(event.key);
        buffer.lastAt = now;
    }, [enabled, focusCaptureInputIfAllowed, manualInputRef, submitScan]);

    useEffect(() => {
        if (!enabled) return;

        const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
            processWedgeKey(event);
        };

        document.addEventListener('keydown', handleDocumentKeyDown);
        return () => document.removeEventListener('keydown', handleDocumentKeyDown);
    }, [enabled, processWedgeKey]);

    const handleCaptureKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        processWedgeKey(event.nativeEvent);
    }, [processWedgeKey]);

    const handleCaptureChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        if (!shouldCaptureWedgeKeys(enabled, manualInputRef)) {
            return;
        }

        const value = event.target.value;
        if (value.includes('\n') || value.includes('\r') || value.includes('\t')) {
            const candidate = value.replace(/[\r\n\t]/g, '').trim();
            if (candidate.length >= MIN_SCANNER_LENGTH) {
                submitScan(candidate);
                window.setTimeout(() => focusCaptureInputIfAllowed(), 100);
            }
        }
    }, [enabled, focusCaptureInputIfAllowed, manualInputRef, submitScan]);

    const handlePanelClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('input, textarea, select, button, a, label')) {
            return;
        }
        focusCaptureInputIfAllowed();
    }, [focusCaptureInputIfAllowed]);

    const handleManualKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        keyBufferRef.current = { chars: [], lastAt: 0 };
        void event;
    }, []);

    return {
        captureInputRef,
        captureInputProps: {
            className: 'event-checkin-scanner-capture',
            type: 'text' as const,
            autoComplete: 'off',
            autoCorrect: 'off',
            autoCapitalize: 'characters',
            spellCheck: false,
            'aria-hidden': true,
            tabIndex: -1,
            onKeyDown: handleCaptureKeyDown,
            onChange: handleCaptureChange,
        },
        panelClickHandler: handlePanelClick,
        manualInputHandlers: {
            onKeyDown: handleManualKeyDown,
        },
    };
}
