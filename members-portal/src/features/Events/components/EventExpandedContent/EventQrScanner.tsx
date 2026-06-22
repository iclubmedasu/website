'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseScannedPayload } from './checkInScanUtils';

interface EventQrScannerProps {
    paused: boolean;
    onCode: (raw: string) => void;
}

type ScannerState = 'idle' | 'starting' | 'active' | 'error';

const VIDEO_CONSTRAINTS_HIGH: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
};

const VIDEO_CONSTRAINTS_LOW: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 640, min: 320 },
    height: { ideal: 480, min: 240 },
};

function pickPreferredCamera(cameras: Array<{ id: string; label: string }>): string {
    const backCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
    return (backCamera ?? cameras[cameras.length - 1]).id;
}

function getQrBoxSize(containerWidth: number): number {
    return Math.min(240, Math.max(140, Math.floor(containerWidth * 0.8)));
}

export default function EventQrScanner({ paused, onCode }: EventQrScannerProps) {
    const containerId = useId().replace(/:/g, '');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastScanRef = useRef<{ raw: string; at: number } | null>(null);
    const onCodeRef = useRef(onCode);
    const [state, setState] = useState<ScannerState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
    const [cameraInitFailed, setCameraInitFailed] = useState(false);

    useEffect(() => {
        onCodeRef.current = onCode;
    }, [onCode]);

    const stopScanner = useCallback(async () => {
        const scanner = scannerRef.current;
        if (!scanner) return;

        try {
            if (scanner.isScanning) {
                await scanner.stop();
            }
            scanner.clear();
        } catch {
            // Scanner may already be stopped during unmount.
        } finally {
            scannerRef.current = null;
        }
    }, []);

    useEffect(() => {
        let active = true;

        const initCameras = async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (!active) return;

                if (devices.length === 0) {
                    setErrorMessage('No camera found on this device.');
                    setState('error');
                    setCameraInitFailed(true);
                    return;
                }

                setCameras(devices);
                setSelectedCameraId(pickPreferredCamera(devices));
            } catch {
                if (!active) return;
                setErrorMessage('Camera access is unavailable. Use manual entry or a scanner device.');
                setState('error');
                setCameraInitFailed(true);
            }
        };

        void initCameras();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (paused || !selectedCameraId || cameraInitFailed) {
            void stopScanner();
            return;
        }

        let cancelled = false;

        const run = async () => {
            await stopScanner();
            if (cancelled) return;

            const container = containerRef.current;
            if (!container) return;

            setState('starting');
            setErrorMessage(null);

            const scanner = new Html5Qrcode(containerId, { verbose: false });
            scannerRef.current = scanner;

            const qrbox = getQrBoxSize(container.clientWidth || 200);
            const baseConfig = {
                fps: 8,
                qrbox: { width: qrbox, height: qrbox },
                aspectRatio: 1,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true,
                },
            };

            const onSuccess = (decodedText: string) => {
                const now = Date.now();
                const last = lastScanRef.current;
                if (last && last.raw === decodedText && now - last.at < 2000) {
                    return;
                }

                if (!parseScannedPayload(decodedText)) {
                    return;
                }

                lastScanRef.current = { raw: decodedText, at: now };
                onCodeRef.current(decodedText);
            };

            try {
                await scanner.start(
                    selectedCameraId,
                    { ...baseConfig, videoConstraints: VIDEO_CONSTRAINTS_HIGH },
                    onSuccess,
                    () => {},
                );
                if (!cancelled) setState('active');
            } catch {
                if (cancelled) return;
                try {
                    await scanner.start(
                        { facingMode: 'environment' },
                        { ...baseConfig, videoConstraints: VIDEO_CONSTRAINTS_LOW },
                        onSuccess,
                        () => {},
                    );
                    if (!cancelled) setState('active');
                } catch (secondError) {
                    if (cancelled) return;
                    const message = secondError instanceof Error
                        ? secondError.message
                        : 'Unable to start camera.';
                    setErrorMessage(message);
                    setState('error');
                    await stopScanner();
                }
            }
        };

        void run();
        return () => {
            cancelled = true;
            void stopScanner();
        };
    }, [cameraInitFailed, containerId, paused, selectedCameraId, stopScanner]);

    const handleCameraChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedCameraId(event.target.value);
    };

    return (
        <div className="event-qr-scanner" ref={containerRef}>
            <div id={containerId} className="event-qr-scanner__viewport" />
            {state === 'starting' ? (
                <p className="event-qr-scanner__overlay">Starting camera…</p>
            ) : null}
            {state === 'error' && errorMessage ? (
                <p className="event-qr-scanner__error">{errorMessage}</p>
            ) : null}
            {cameras.length > 1 && state === 'active' ? (
                <select
                    aria-label="Camera"
                    value={selectedCameraId ?? ''}
                    onChange={handleCameraChange}
                    className="form-input event-qr-scanner__camera-select"
                    disabled={paused}
                >
                    {cameras.map((camera) => (
                        <option key={camera.id} value={camera.id}>
                            {camera.label || `Camera ${camera.id.slice(0, 6)}`}
                        </option>
                    ))}
                </select>
            ) : null}
        </div>
    );
}
