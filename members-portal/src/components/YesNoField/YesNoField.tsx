'use client';

import Toggle from '@/components/toggle/Toggle';
import './YesNoField.css';

export interface YesNoFieldProps {
    label: string;
    required?: boolean;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    error?: string;
    variant?: 'inline' | 'stacked';
    id?: string;
    className?: string;
}

export function YesNoField({
    label,
    required = false,
    checked,
    onChange,
    disabled = false,
    error,
    variant = 'stacked',
    id,
    className = '',
}: YesNoFieldProps) {
    const labelText = `${label}${required ? ' *' : ''}`;
    const stateLabel = checked ? 'Yes' : 'No';
    const errorClass = error ? ' yes-no-field--error' : '';

    if (variant === 'inline') {
        return (
            <div className={`yes-no-field yes-no-field--inline${errorClass}${className ? ` ${className}` : ''}`}>
                <Toggle
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    aria-label={labelText}
                />
                <span className="yes-no-field-state" aria-hidden="true">{stateLabel}</span>
                {error ? <span className="yes-no-field-error">{error}</span> : null}
            </div>
        );
    }

    return (
        <div
            className={`yes-no-field yes-no-field--stacked${errorClass}${className ? ` ${className}` : ''}`}
            id={id}
        >
            <span className="yes-no-field-label" id={id ? `${id}-label` : undefined}>
                {labelText}
            </span>
            <div className="yes-no-field-control">
                <Toggle
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    aria-labelledby={id ? `${id}-label` : undefined}
                    aria-label={id ? undefined : labelText}
                />
                <span className="yes-no-field-state" aria-hidden="true">{stateLabel}</span>
            </div>
            {error ? <p className="yes-no-field-error field-error">{error}</p> : null}
        </div>
    );
}
