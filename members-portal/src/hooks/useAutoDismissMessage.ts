'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Default lifetime for transient success banners / soft validation hints. */
export const AUTO_DISMISS_MS = 5000;

/**
 * Ephemeral status message that auto-clears after `durationMs` (default 5s).
 * Calling `show` replaces any previous message and resets the timer.
 * `clear` cancels the timer and removes the message immediately (e.g. on corrective action).
 */
export function useAutoDismissMessage(durationMs: number = AUTO_DISMISS_MS) {
    const [message, setMessage] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const clear = useCallback(() => {
        clearTimer();
        setMessage(null);
    }, [clearTimer]);

    const show = useCallback(
        (text: string) => {
            clearTimer();
            setMessage(text);
            timerRef.current = setTimeout(() => {
                setMessage(null);
                timerRef.current = null;
            }, durationMs);
        },
        [clearTimer, durationMs],
    );

    useEffect(() => () => clearTimer(), [clearTimer]);

    return { message, show, clear };
}
