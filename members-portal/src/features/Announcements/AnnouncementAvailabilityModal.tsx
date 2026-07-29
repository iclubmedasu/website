'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatDate } from '@iclub/shared/utils';
import '@/components/modal/modal.css';
import {
    type AvailabilityMode,
    type AvailabilityPeriod,
    daysToPeriods,
    enumerateInclusiveDays,
    mergePeriodUnion,
    normalizePeriods,
    periodsToDaySet,
    validatePeriods,
} from './announcementAvailability';
import './AnnouncementAvailabilityModal.css';

export interface AnnouncementAvailabilityModalProps {
    title: string;
    mode: AvailabilityMode;
    windowStart: string;
    windowEnd: string;
    initialPeriods: AvailabilityPeriod[];
    submitting?: boolean;
    onClose: () => void;
    onSave: (periods: AvailabilityPeriod[]) => void | Promise<void>;
}

export default function AnnouncementAvailabilityModal({
    title,
    mode,
    windowStart,
    windowEnd,
    initialPeriods,
    submitting = false,
    onClose,
    onSave,
}: AnnouncementAvailabilityModalProps) {
    const dayOptions =
        mode === 'days' ? enumerateInclusiveDays(windowStart, windowEnd, 31) ?? [] : [];

    const [selectedDays, setSelectedDays] = useState<string[]>(() =>
        periodsToDaySet(initialPeriods),
    );
    const [periodRows, setPeriodRows] = useState<AvailabilityPeriod[]>(() => {
        const merged = mergePeriodUnion(initialPeriods);
        return merged.length > 0 ? merged : [{ start: windowStart, end: windowStart }];
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setSelectedDays(periodsToDaySet(initialPeriods));
        const merged = mergePeriodUnion(initialPeriods);
        setPeriodRows(
            merged.length > 0 ? merged : [{ start: windowStart, end: windowStart }],
        );
        setError(null);
    }, [initialPeriods, windowStart, windowEnd]);

    const window = { start: windowStart, end: windowEnd };

    function toggleDay(day: string) {
        setSelectedDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
        );
        setError(null);
    }

    function updatePeriod(index: number, field: 'start' | 'end', value: string) {
        setPeriodRows((prev) =>
            prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        );
        setError(null);
    }

    function addPeriod() {
        setPeriodRows((prev) => [...prev, { start: windowStart, end: windowStart }]);
        setError(null);
    }

    function removePeriod(index: number) {
        setPeriodRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
        setError(null);
    }

    async function handleSave() {
        const periods =
            mode === 'days'
                ? daysToPeriods(selectedDays)
                : mergePeriodUnion(normalizePeriods(periodRows));

        if (periods.length === 0) {
            setError(mode === 'days' ? 'Select at least one day' : 'Add at least one period');
            return;
        }

        const validationError = validatePeriods(periods, window);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        await onSave(periods);
    }

    const handleClose = () => {
        if (submitting) return;
        onClose();
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container announcement-availability-modal">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {mode === 'days' ? 'Pick days' : 'Pick periods'} — {title}
                    </h2>
                    <button
                        className="modal-close-btn"
                        onClick={handleClose}
                        type="button"
                        disabled={submitting}
                    >
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    <p className="announcement-availability-window">
                        Available window:{' '}
                        {windowStart === windowEnd
                            ? formatDate(windowStart, { timeZone: 'UTC' })
                            : `${formatDate(windowStart, { timeZone: 'UTC' })} – ${formatDate(windowEnd, { timeZone: 'UTC' })}`}
                    </p>

                    {mode === 'days' ? (
                        <div className="announcement-availability-days">
                            {dayOptions.map((day) => (
                                <div key={day} className="checkbox-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="checkbox-input"
                                            checked={selectedDays.includes(day)}
                                            disabled={submitting}
                                            onChange={() => toggleDay(day)}
                                        />
                                        <span className="checkbox-text">
                                            {formatDate(day, { timeZone: 'UTC' })}
                                        </span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="announcement-availability-periods">
                            {periodRows.map((row, index) => (
                                <div
                                    key={`period-${index}`}
                                    className="announcement-availability-period-row"
                                >
                                    <label className="form-group">
                                        <span className="form-label">Start</span>
                                        <input
                                            type="date"
                                            className="form-input"
                                            min={windowStart}
                                            max={windowEnd}
                                            value={row.start}
                                            disabled={submitting}
                                            onChange={(e) =>
                                                updatePeriod(index, 'start', e.target.value)
                                            }
                                        />
                                    </label>
                                    <label className="form-group">
                                        <span className="form-label">End</span>
                                        <input
                                            type="date"
                                            className="form-input"
                                            min={windowStart}
                                            max={windowEnd}
                                            value={row.end}
                                            disabled={submitting}
                                            onChange={(e) =>
                                                updatePeriod(index, 'end', e.target.value)
                                            }
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="btn btn-secondary announcement-availability-remove"
                                        disabled={submitting || periodRows.length <= 1}
                                        onClick={() => removePeriod(index)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={submitting}
                                onClick={addPeriod}
                            >
                                Add period
                            </button>
                        </div>
                    )}

                    {error ? <p className="error-message">{error}</p> : null}
                </div>
                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={submitting}
                        onClick={handleClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={submitting}
                        onClick={() => void handleSave()}
                    >
                        {submitting ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </>
    );
}
