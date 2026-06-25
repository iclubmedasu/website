'use client';

import Toggle from '@/components/toggle/Toggle';
import '@/components/toggle/toggle.css';

interface FormToggleRowProps {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string;
}

export function FormToggleRow({
    label,
    hint,
    checked,
    onChange,
    disabled,
    ariaLabel,
}: FormToggleRowProps) {
    return (
        <div className="form-toggle-row">
            <div className="form-toggle-copy">
                <span className="form-label form-toggle-label">{label}</span>
                {hint ? <span className="form-toggle-hint">{hint}</span> : null}
            </div>
            <Toggle
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                aria-label={ariaLabel ?? label}
            />
        </div>
    );
}
