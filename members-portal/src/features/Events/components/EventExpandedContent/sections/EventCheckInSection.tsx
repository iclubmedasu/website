import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Maximize2, Minimize2, Printer } from 'lucide-react';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import type {
    EventCustomFieldRef,
    EventIdCardDesignRef,
    EventSessionRef,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import EventStaffModal from '@/features/Events/components/EventStaffModal';
import { eventsAPI } from '@/services/api';
import {
    dropdownOptions,
    getCustomFieldValueFromRecord,
} from '../customFieldUtils';
import EventQrScanner from '../EventQrScanner';
import { unlockCheckInAudio } from '../checkInSounds';
import type { UseCheckInFlowReturn } from '../useCheckInFlow';
import { useHardwareScannerCapture } from '../useHardwareScannerCapture';
import SessionAttendanceOptions from './SessionAttendanceOptions';
import { useAuthorizedIdCardBackground } from './IdCardDesign/useAuthorizedIdCardBackground';
import { printIdCard } from './IdCardDesign/idCardPrint';

interface EventCheckInPanelProps {
    eventId: Id | string;
    checkInFlow: UseCheckInFlowReturn;
    suspended?: boolean;
    tiers?: EventTierRef[];
    fields?: EventCustomFieldRef[];
    idCardDesign?: EventIdCardDesignRef | null;
}

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

export default function EventCheckInPanel({
    eventId,
    checkInFlow,
    suspended = false,
    tiers = [],
    fields = [],
    idCardDesign,
}: EventCheckInPanelProps) {
    const manualInputRef = useRef<HTMLInputElement>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [printingId, setPrintingId] = useState(false);
    const [printCode, setPrintCode] = useState('');
    const [printError, setPrintError] = useState<string | null>(null);

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
        lastCheckedInRegistration,
    } = checkInFlow;

    const hasBackground = Boolean(idCardDesign?.idCardBackgroundImageGithubPath);
    const backgroundImageUrl = useAuthorizedIdCardBackground(
        eventId,
        hasBackground,
        idCardDesign?.idCardBackgroundImageGithubSha
            ?? idCardDesign?.idCardBackgroundImageGithubPath,
    );

    useEffect(() => {
        if (!lastCheckedInRegistration?.confirmationCode) return;
        setPrintCode(lastCheckedInRegistration.confirmationCode);
        setPrintError(null);
    }, [lastCheckedInRegistration]);

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

    useEffect(() => {
        if (!isMaximized) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMaximized(false);
            }
        };
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isMaximized]);

    const toggleMaximize = useCallback(() => {
        unlockCheckInAudio();
        setIsMaximized((prev) => !prev);
    }, []);

    const handlePanelClick = useCallback((event: MouseEvent<HTMLElement>) => {
        unlockCheckInAudio();
        panelClickHandler(event);
    }, [panelClickHandler]);

    const handlePrintId = useCallback(async () => {
        if (printingId || suspended || showCombinedModal) return;

        const code = printCode.trim().toUpperCase();
        if (!code) {
            setPrintError('Enter a confirmation code.');
            return;
        }

        setPrintError(null);
        setPrintingId(true);
        try {
            const lookup = await eventsAPI.lookupRegistrationByCode(eventId, code);
            await printIdCard({
                registration: lookup.registration,
                idCardDesign,
                tiers,
                fields,
                backgroundImageUrl,
            });
        } catch (err) {
            setPrintError(err instanceof Error ? err.message : 'Could not print ID card.');
        } finally {
            setPrintingId(false);
        }
    }, [
        backgroundImageUrl,
        eventId,
        fields,
        idCardDesign,
        printCode,
        printingId,
        showCombinedModal,
        suspended,
        tiers,
    ]);

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
                className={`event-registrations-checkin-panel${isMaximized ? ' event-registrations-checkin-panel--maximized' : ''}`}
                onClick={handlePanelClick}
            >
                <div className="event-checkin-toolbar event-checkin-toolbar--mobile-only">
                    <h3 className="event-checkin-toolbar__title">Check-in</h3>
                    <button
                        type="button"
                        className="btn btn-secondary event-checkin-toolbar__btn"
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleMaximize();
                        }}
                        title={isMaximized ? 'Minimize check-in' : 'Maximize check-in'}
                    >
                        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        <span>{isMaximized ? 'Minimize' : 'Maximize'}</span>
                    </button>
                </div>
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
                <hr className="event-checkin-divider" />
                <div className="event-registrations-checkin-print-id">
                    <h3 className="expanded-section-title expanded-section-title--sm">Print ID</h3>
                    <div className="event-registrations-checkin-manual-row">
                        <input
                            value={printCode}
                            onChange={(e) => {
                                setPrintCode(e.target.value);
                                if (printError) setPrintError(null);
                            }}
                            placeholder="6-character code"
                            className="form-input"
                            disabled={printingId || showCombinedModal || suspended}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') void handlePrintId();
                            }}
                            aria-label="Confirmation code for printing ID"
                        />
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={printingId || showCombinedModal || suspended}
                            onClick={(event) => {
                                event.stopPropagation();
                                void handlePrintId();
                            }}
                        >
                            <Printer size={16} />
                            {printingId ? 'Preparing…' : 'Print ID'}
                        </button>
                    </div>
                    {printError ? (
                        <div className="error-message">{printError}</div>
                    ) : null}
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
