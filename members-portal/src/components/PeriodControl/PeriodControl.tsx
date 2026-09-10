'use client';

import { DateInput } from '@/components/input/DateInput';
import {
    PERIOD_OPTIONS,
    type PeriodPreset,
    isValidCustomRange,
} from './periodRange';
import '@/components/modal/modal.css';
import '@/components/input/input.css';
import './PeriodControl.css';

type PeriodControlProps = {
    preset: PeriodPreset;
    customFrom: string;
    customTo: string;
    disabled?: boolean;
    ariaLabel?: string;
    onPresetChange: (preset: PeriodPreset) => void;
    onCustomFromChange: (value: string) => void;
    onCustomToChange: (value: string) => void;
};

export default function PeriodControl({
    preset,
    customFrom,
    customTo,
    disabled = false,
    ariaLabel = 'Period',
    onPresetChange,
    onCustomFromChange,
    onCustomToChange,
}: PeriodControlProps) {
    const showIncompleteHint =
        preset === 'custom' && (!customFrom || !customTo);
    const showOrderHint =
        preset === 'custom' &&
        Boolean(customFrom && customTo) &&
        !isValidCustomRange(customFrom, customTo);

    return (
        <div className="period-control">
            <div className="period-control-row">
                <div className="modal-segmented period-segmented" role="group" aria-label={ariaLabel}>
                    {PERIOD_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`modal-segmented-btn${
                                preset === option.value ? ' modal-segmented-btn--active' : ''
                            }`}
                            onClick={() => onPresetChange(option.value)}
                            disabled={disabled}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {preset === 'custom' ? (
                    <div className="period-custom-dates">
                        <label className="form-group">
                            <span className="form-label">From</span>
                            <DateInput
                                value={customFrom}
                                disabled={disabled}
                                onChange={(e) => onCustomFromChange(e.target.value)}
                            />
                        </label>
                        <label className="form-group">
                            <span className="form-label">To</span>
                            <DateInput
                                value={customTo}
                                disabled={disabled}
                                onChange={(e) => onCustomToChange(e.target.value)}
                            />
                        </label>
                    </div>
                ) : null}
            </div>

            {showIncompleteHint ? (
                <p className="period-hint">Select a From and To date to update the period.</p>
            ) : null}
            {showOrderHint ? (
                <p className="error-message">From must be on or before To.</p>
            ) : null}
        </div>
    );
}
