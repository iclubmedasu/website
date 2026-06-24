'use client';

import type { ButtonHTMLAttributes } from 'react';
import './toggle.css';

type ToggleColor = 'purple' | 'brand' | 'gray';

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onChange'> {
    checked: boolean;
    onChange: (checked: boolean) => void;
    color?: ToggleColor;
}

export default function Toggle({
    checked,
    onChange,
    disabled = false,
    color = 'purple',
    className = '',
    'aria-label': ariaLabel,
    ...rest
}: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            className={`portal-toggle portal-toggle--${color}${checked ? ' portal-toggle--on' : ''}${className ? ` ${className}` : ''}`}
            onClick={() => {
                if (!disabled) {
                    onChange(!checked);
                }
            }}
            {...rest}
        >
            <span className="portal-toggle-knob" aria-hidden="true" />
        </button>
    );
}
