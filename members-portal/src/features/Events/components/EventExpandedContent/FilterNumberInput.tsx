import type { InputHTMLAttributes } from 'react';

export function parseFilterNumberInput(raw: string): number | undefined {
    if (raw === '') return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
}

type FilterNumberInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
> & {
    value: number | undefined;
    onChange: (value: number | undefined) => void;
};

/** Controlled number input that allows an empty draft (does not coerce '' → 0). */
export default function FilterNumberInput({
    value,
    onChange,
    className = 'form-input',
    ...rest
}: FilterNumberInputProps) {
    return (
        <input
            {...rest}
            type="number"
            className={className}
            value={value ?? ''}
            onChange={(event) => onChange(parseFilterNumberInput(event.target.value))}
        />
    );
}
