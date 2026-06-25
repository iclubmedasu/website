"use client";

import type { ButtonHTMLAttributes } from "react";
import "./YesNoToggle.css";

type YesNoToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onChange"> & {
    checked: boolean;
    onChange: (checked: boolean) => void;
};

export function YesNoToggle({
    checked,
    onChange,
    disabled = false,
    className = "",
    "aria-label": ariaLabel,
    ...rest
}: YesNoToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            className={`site-yes-no-toggle${checked ? " site-yes-no-toggle--on" : ""}${className ? ` ${className}` : ""}`}
            onClick={() => {
                if (!disabled) onChange(!checked);
            }}
            {...rest}
        >
            <span className="site-yes-no-toggle-knob" aria-hidden="true" />
        </button>
    );
}

export interface YesNoFieldProps {
    label: string;
    required?: boolean;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    error?: string;
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
    id,
    className = "",
}: YesNoFieldProps) {
    const labelText = `${label}${required ? " *" : ""}`;
    const stateLabel = checked ? "Yes" : "No";

    return (
        <div className={`site-yes-no-field${error ? " site-yes-no-field--error" : ""}${className ? ` ${className}` : ""}`} id={id}>
            <span className="site-yes-no-field-label" id={id ? `${id}-label` : undefined}>
                {labelText}
            </span>
            <div className="site-yes-no-field-control">
                <YesNoToggle
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    aria-labelledby={id ? `${id}-label` : undefined}
                    aria-label={id ? undefined : labelText}
                />
                <span className="site-yes-no-field-state" aria-hidden="true">{stateLabel}</span>
            </div>
            {error ? <p className="field-error mt-1 text-sm text-red-600">{error}</p> : null}
        </div>
    );
}
