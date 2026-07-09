let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioContext) {
        const AudioContextClass = window.AudioContext
            ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return null;
        audioContext = new AudioContextClass();
    }
    return audioContext;
}

export function unlockCheckInAudio(): void {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            void ctx.resume();
        }
    } catch {
        // Audio unavailable — silent no-op.
    }
}

function playTone(frequency: number, durationMs: number, gainLevel: number): void {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            void ctx.resume();
        }

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.connect(ctx.destination);

        const startAt = ctx.currentTime;
        const durationSec = durationMs / 1000;
        gain.gain.setValueAtTime(gainLevel, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);

        oscillator.start(startAt);
        oscillator.stop(startAt + durationSec);
    } catch {
        // Audio unavailable — silent no-op.
    }
}

/** Short high beep when a valid scan is detected (camera or hardware scanner). */
export function playCheckInDetectBeep(): void {
    playTone(880, 80, 0.12);
}

/** Two-tone beep when check-in fully completes. */
export function playCheckInSuccessBeep(): void {
    playTone(660, 100, 0.18);
    setTimeout(() => playTone(880, 120, 0.18), 100);
}
