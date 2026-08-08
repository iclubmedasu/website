'use client';

import type { InputHTMLAttributes } from 'react';

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    /** Shown when value is empty. Native `placeholder` is ignored for type="date". */
    emptyLabel?: string;
};

/**
 * Full-width date control with a visible empty-state label.
 * Prefer this over a bare `<input type="date" className="form-input" />`
 * so WebKit cannot shrink-to-fit and empty fields are never blank.
 */
export function DateInput({
    value,
    className,
    emptyLabel = 'Select date',
    ...rest
}: DateInputProps) {
    const normalized = value == null ? '' : String(value);
    const isEmpty = normalized === '';
    const extraClass = (className ?? '').replace(/\bform-input\b/g, '').trim();
    const inputClassName = extraClass ? `form-input ${extraClass}` : 'form-input';

    return (
        <div className={`form-date-field${isEmpty ? ' is-empty' : ''}`}>
            <input
                type="date"
                className={inputClassName}
                value={normalized}
                {...rest}
            />
            {isEmpty ? (
                <span className="form-date-placeholder" aria-hidden="true">
                    {emptyLabel}
                </span>
            ) : null}
        </div>
    );
}
