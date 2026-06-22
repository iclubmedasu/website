'use client';

import { snapTimeToQuarter } from './eventTaskTimeUtils';
import './QuarterHourTimeSelect.css';

const TIME_STEP_SECONDS = 900;

interface QuarterHourTimeSelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    'aria-label': string;
}

export default function QuarterHourTimeSelect({
    value,
    onChange,
    disabled = false,
    'aria-label': ariaLabel,
}: QuarterHourTimeSelectProps) {
    const handleChange = (nextValue: string) => {
        onChange(nextValue ? snapTimeToQuarter(nextValue) : '');
    };

    return (
        <input
            type="time"
            step={TIME_STEP_SECONDS}
            className="form-input quarter-hour-time-input"
            aria-label={ariaLabel}
            value={value}
            disabled={disabled}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={(event) => handleChange(event.target.value)}
        />
    );
}
