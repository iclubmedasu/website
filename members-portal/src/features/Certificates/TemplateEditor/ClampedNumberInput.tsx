'use client';

import { useState, type KeyboardEvent } from 'react';

export interface ClampedNumberInputProps {
    id?: string;
    className?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    'aria-label'?: string;
    onCommit: (value: number) => void;
}

/**
 * Number input that only clamps/commits on blur or Enter (and when a fully
 * in-range value is typed, e.g. spinner). Partial digits while typing are kept
 * as a draft so "1800" is not forced to min when the first digit is "1".
 */
export default function ClampedNumberInput({
    id,
    className = 'form-input',
    value,
    min,
    max,
    step = 1,
    disabled,
    'aria-label': ariaLabel,
    onCommit,
}: ClampedNumberInputProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const display = draft ?? String(value);

    const applyCommit = (raw: string) => {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            setDraft(null);
            return;
        }
        const next = Math.min(max, Math.max(min, Math.round(parsed)));
        setDraft(null);
        if (next !== value) {
            onCommit(next);
        }
    };

    const handleChange = (raw: string) => {
        setDraft(raw);
        if (raw.trim() === '') return;
        const parsed = Number(raw);
        // Fully formed integer in range (spinner / paste of complete value)
        if (
            Number.isFinite(parsed) &&
            Number.isInteger(parsed) &&
            String(parsed) === raw.trim() &&
            parsed >= min &&
            parsed <= max
        ) {
            setDraft(null);
            if (parsed !== value) onCommit(parsed);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyCommit(draft ?? String(value));
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
        }
    };

    return (
        <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            className={className}
            disabled={disabled}
            aria-label={ariaLabel}
            value={display}
            onFocus={() => setDraft(String(value))}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => applyCommit(draft ?? String(value))}
            onKeyDown={handleKeyDown}
        />
    );
}
