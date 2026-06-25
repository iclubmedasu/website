import { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import type { EventCustomFieldRef, Id } from '@/types/backend-contracts';
import {
    dropdownOptions,
    getCustomFieldValueFromRecord,
} from '../customFieldUtils';
import EventQrScanner from '../EventQrScanner';
import { useCheckInFlow } from '../useCheckInFlow';
import { useHardwareScannerCapture } from '../useHardwareScannerCapture';

interface EventCheckInPanelProps {
    eventId: Id | string;
    onCheckIn: () => void;
    suspended?: boolean;
}

export default function EventCheckInPanel({
    eventId,
    onCheckIn,
    suspended = false,
}: EventCheckInPanelProps) {
    const manualInputRef = useRef<HTMLInputElement>(null);

    const {
        manualCode,
        setManualCode,
        result,
        registration,
        missingFields,
        fieldErrors,
        loading,
        requiredFieldsModalOpen,
        processConfirmationCode,
        handleCompleteCheckIn,
        handleCancelRequiredFields,
        updatePendingField,
        handleManualLookup,
        pendingCustomValues,
    } = useCheckInFlow({ eventId, onCheckIn });

    const handleScannerCode = useCallback((raw: string) => {
        void processConfirmationCode(raw, 'scanner');
    }, [processConfirmationCode]);

    const handleCameraCode = useCallback((raw: string) => {
        void processConfirmationCode(raw, 'camera');
    }, [processConfirmationCode]);

    const captureEnabled = !loading && !requiredFieldsModalOpen && !suspended;

    const {
        captureInputRef,
        captureInputProps,
        panelClickHandler,
        manualInputHandlers,
    } = useHardwareScannerCapture({
        enabled: captureEnabled,
        manualInputRef,
        onScan: handleScannerCode,
    });

    const renderMissingFieldInput = (field: EventCustomFieldRef) => {
        const fieldKey = String(field.id);
        const existing = registration ? getCustomFieldValueFromRecord(registration.customFieldValues as Record<string, unknown> | null, field) : undefined;
        const value = pendingCustomValues[fieldKey] ?? existing;
        const errorClass = fieldErrors[fieldKey] ? ' event-checkin-field--error' : '';

        if (field.type === 'checkbox') {
            return (
                <div key={field.id} className={`event-checkin-field${errorClass}`}>
                    <YesNoField
                        id={`checkin-field-${field.id}`}
                        label={field.label}
                        required={field.required}
                        checked={Boolean(value)}
                        onChange={(next) => updatePendingField(fieldKey, next)}
                        error={fieldErrors[fieldKey]}
                        variant="stacked"
                    />
                </div>
            );
        }

        if (field.type === 'dropdown') {
            return (
                <div key={field.id} className={`event-checkin-field${errorClass}`}>
                    <label className="form-label" htmlFor={`checkin-field-${field.id}`}>{field.label}</label>
                    <select
                        id={`checkin-field-${field.id}`}
                        value={value != null ? String(value) : ''}
                        onChange={(event) => updatePendingField(fieldKey, event.target.value || null)}
                        className="form-input"
                    >
                        <option value="">Select…</option>
                        {dropdownOptions(field).map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
            );
        }

        return (
            <div key={field.id} className={`event-checkin-field${errorClass}`}>
                <label className="form-label" htmlFor={`checkin-field-${field.id}`}>{field.label}</label>
                <input
                    id={`checkin-field-${field.id}`}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={value != null ? String(value) : ''}
                    onChange={(event) => updatePendingField(
                        fieldKey,
                        field.type === 'number'
                            ? (event.target.value === '' ? null : Number(event.target.value))
                            : event.target.value,
                    )}
                    className="form-input"
                />
            </div>
        );
    };

    return (
        <>
            <input ref={captureInputRef} {...captureInputProps} />
            <div
                className="event-registrations-checkin-panel"
                onClick={panelClickHandler}
            >
                <div className="event-registrations-checkin-scan">
                    <h3 className="expanded-section-title expanded-section-title--sm">Scan</h3>
                    <EventQrScanner
                        paused={loading || requiredFieldsModalOpen || suspended}
                        onCode={handleCameraCode}
                    />
                    {/* <p className="event-checkin-scan-status">
                        Use camera, USB scanner, or enter a code below.
                    </p> */}
                </div>
                <hr className="event-checkin-divider" />
                <div className="event-registrations-checkin-manual">
                    <h3 className="expanded-section-title expanded-section-title--sm">Manual entry</h3>
                    <input
                        ref={manualInputRef}
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="6-character code"
                        className="form-input"
                        disabled={loading || requiredFieldsModalOpen || suspended}
                        onKeyDown={(event) => {
                            manualInputHandlers.onKeyDown(event);
                            if (event.key === 'Enter') void handleManualLookup();
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => void handleManualLookup()}
                        className="btn btn-primary event-expanded-btn-block"
                        disabled={loading || requiredFieldsModalOpen || suspended}
                    >
                        {loading ? 'Looking up…' : 'Check in'}
                    </button>
                </div>
                {result ? (
                    <div className={result.type === 'error' ? 'error-message' : 'success-message'}>
                        {result.message}
                    </div>
                ) : null}
            </div>

            {requiredFieldsModalOpen && registration && missingFields.length > 0 ? (
                <>
                    <div className="modal-backdrop" onClick={handleCancelRequiredFields} />
                    <div
                        className="modal-container event-checkin-required-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="checkin-required-fields-title"
                    >
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title" id="checkin-required-fields-title">
                                    Complete required information
                                </h2>
                                <p className="modal-subtitle">
                                    {registration.fullName} ({registration.email}) — fill in the following before check-in.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={handleCancelRequiredFields}
                                aria-label="Close"
                                disabled={loading}
                            >
                                <X />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="event-checkin-required-fields">
                                {missingFields.map((field) => renderMissingFieldInput(field))}
                            </div>
                        </div>
                        <div className="modal-footer event-checkin-required-actions">
                            <button
                                type="button"
                                onClick={() => void handleCompleteCheckIn()}
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Checking in…' : 'Complete check-in'}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelRequiredFields}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </>
    );
}
