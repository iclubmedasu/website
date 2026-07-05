import { useCallback, useRef } from 'react';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import type {
    EventCustomFieldRef,
    EventSessionRef,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import EventStaffModal from '@/features/Events/components/EventStaffModal';
import {
    dropdownOptions,
    getCustomFieldValueFromRecord,
} from '../customFieldUtils';
import EventQrScanner from '../EventQrScanner';
import { useCheckInFlow } from '../useCheckInFlow';
import { useHardwareScannerCapture } from '../useHardwareScannerCapture';
import SessionAttendanceOptions from './SessionAttendanceOptions';

interface EventCheckInPanelProps {
    eventId: Id | string;
    onCheckIn: () => void;
    suspended?: boolean;
    tiers?: EventTierRef[];
    sessions?: EventSessionRef[];
    tierFieldRequired?: boolean;
    sessionFieldRequired?: boolean;
}

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

export default function EventCheckInPanel({
    eventId,
    onCheckIn,
    suspended = false,
    tiers = [],
    sessions = [],
    tierFieldRequired = false,
    sessionFieldRequired = false,
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
        showCombinedModal,
        activeSessionsNow,
        selectedSessionId,
        setSelectedSessionId,
        alreadyHasDayAttendance,
        needsTier,
        needsSessions,
        selectedTierId,
        setSelectedTierId,
        selectedSessionIds,
        toggleSessionSelection,
        sortedActiveSessions,
        clearFieldError,
        processConfirmationCode,
        handleCompleteCheckIn,
        handleCancelRequiredFields,
        updatePendingField,
        handleManualLookup,
        pendingCustomValues,
    } = useCheckInFlow({
        eventId,
        onCheckIn,
        tiers,
        sessions,
        tierFieldRequired,
        sessionFieldRequired,
    });

    const handleScannerCode = useCallback((raw: string) => {
        void processConfirmationCode(raw, 'scanner');
    }, [processConfirmationCode]);

    const handleCameraCode = useCallback((raw: string) => {
        void processConfirmationCode(raw, 'camera');
    }, [processConfirmationCode]);

    const captureEnabled = !loading && !showCombinedModal && !suspended;

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
        const fieldError = fieldErrors[fieldKey];

        if (field.type === 'checkbox') {
            return (
                <div key={field.id} className="form-group">
                    <YesNoField
                        id={`checkin-field-${field.id}`}
                        label={field.label}
                        required={field.required}
                        checked={Boolean(value)}
                        onChange={(next) => updatePendingField(fieldKey, next)}
                        error={fieldError}
                        variant="stacked"
                    />
                </div>
            );
        }

        if (field.type === 'dropdown') {
            return (
                <div key={field.id} className="form-group">
                    <label className="form-label" htmlFor={`checkin-field-${field.id}`}>{field.label}</label>
                    <select
                        id={`checkin-field-${field.id}`}
                        value={value != null ? String(value) : ''}
                        onChange={(event) => updatePendingField(fieldKey, event.target.value || null)}
                        className={`form-input${fieldError ? ' error' : ''}`}
                    >
                        <option value="">Select…</option>
                        {dropdownOptions(field).map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    {fieldError ? <span className="field-error">{fieldError}</span> : null}
                </div>
            );
        }

        return (
            <div key={field.id} className="form-group">
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
                    className={`form-input${fieldError ? ' error' : ''}`}
                />
                {fieldError ? <span className="field-error">{fieldError}</span> : null}
            </div>
        );
    };

    const modalTitle = activeSessionsNow.length > 0 || needsTier || needsSessions
        ? 'Check-in details'
        : 'Complete required information';

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
                        paused={loading || showCombinedModal || suspended}
                        onCode={handleCameraCode}
                    />
                </div>
                <hr className="event-checkin-divider" />
                <div className="event-registrations-checkin-manual">
                    <h3 className="expanded-section-title expanded-section-title--sm">Manual entry</h3>
                    <div className="event-registrations-checkin-manual-row">
                        <input
                            ref={manualInputRef}
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="6-character code"
                            className="form-input"
                            disabled={loading || showCombinedModal || suspended}
                            onKeyDown={(event) => {
                                manualInputHandlers.onKeyDown(event);
                                if (event.key === 'Enter') void handleManualLookup();
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => void handleManualLookup()}
                            className="btn btn-primary"
                            disabled={loading || showCombinedModal || suspended}
                        >
                            {loading ? 'Looking up…' : 'Check in'}
                        </button>
                    </div>
                </div>
                {result ? (
                    <div className={result.type === 'error' ? 'error-message' : 'success-message'}>
                        {result.message}
                    </div>
                ) : null}
            </div>

            <EventStaffModal
                open={showCombinedModal && Boolean(registration)}
                title={modalTitle}
                subtitle={registration ? `${registration.fullName} (${registration.email}) — fill in the following before check-in.` : undefined}
                titleId="checkin-required-fields-title"
                onClose={handleCancelRequiredFields}
                closeDisabled={loading}
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={handleCancelRequiredFields}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleCompleteCheckIn()}
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Checking in…' : 'Complete check-in'}
                        </button>
                    </>
                )}
            >
                {needsTier ? (
                    <section className="form-section">
                        <h3 className="form-section-title">Registration tier</h3>
                        <div className="form-group">
                            <label className="form-label" htmlFor="checkin-tier-select">Tier *</label>
                            <select
                                id="checkin-tier-select"
                                value={selectedTierId}
                                onChange={(event) => {
                                    setSelectedTierId(event.target.value);
                                    clearFieldError('_tier');
                                }}
                                className={`form-input${fieldErrors._tier ? ' error' : ''}`}
                            >
                                <option value="">Select tier…</option>
                                {tiers.map((tier) => (
                                    <option key={tier.id} value={tier.id}>{tier.name}</option>
                                ))}
                            </select>
                            {fieldErrors._tier ? <span className="field-error">{fieldErrors._tier}</span> : null}
                        </div>
                    </section>
                ) : null}
                {needsSessions ? (
                    <section className="form-section">
                        <h3 className="form-section-title">Session selections</h3>
                        <p className="form-hint-text">
                            Select which sessions this attendee plans to attend.
                        </p>
                        <div className="team-checkbox-list" role="group" aria-label="Session selections">
                            {sortedActiveSessions.map((session) => {
                                const sessionId = String(session.id);
                                return (
                                    <label key={session.id} className="team-checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedSessionIds.includes(sessionId)}
                                            onChange={() => toggleSessionSelection(sessionId)}
                                        />
                                        <span className="team-checkbox-label">{getSessionTitle(session)}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {fieldErrors._sessions ? <span className="field-error">{fieldErrors._sessions}</span> : null}
                    </section>
                ) : null}
                {missingFields.length > 0 ? (
                    <section className="form-section">
                        <h3 className="form-section-title">Required information</h3>
                        {missingFields.map((field) => renderMissingFieldInput(field))}
                    </section>
                ) : null}
                <SessionAttendanceOptions
                    activeSessionsNow={activeSessionsNow}
                    selectedSessionId={selectedSessionId}
                    onSelectSessionId={setSelectedSessionId}
                    alreadyHasDayAttendance={alreadyHasDayAttendance}
                    radioName="checkin-session"
                />
            </EventStaffModal>
        </>
    );
}
