import { useCallback, useRef, useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventCustomFieldRef, EventRegistrationRef, Id } from '@/types/backend-contracts';
import { isCustomFieldValueEmpty, mergeCustomFieldValues } from './customFieldUtils';
import { parseScannedPayload } from './checkInScanUtils';

export type CheckInSource = 'camera' | 'scanner' | 'manual';

export type CheckInResultState = { type: 'success' | 'error'; message: string } | null;

const DEDUP_MS = 2000;

const SOURCE_LABEL: Record<CheckInSource, string> = {
    camera: 'camera',
    scanner: 'scanner',
    manual: 'manual entry',
};

interface UseCheckInFlowOptions {
    eventId: Id | string;
    onCheckIn: () => void;
}

export function useCheckInFlow({ eventId, onCheckIn }: UseCheckInFlowOptions) {
    const [manualCode, setManualCode] = useState('');
    const [result, setResult] = useState<CheckInResultState>(null);
    const [registration, setRegistration] = useState<EventRegistrationRef | null>(null);
    const [missingFields, setMissingFields] = useState<EventCustomFieldRef[]>([]);
    const [pendingCustomValues, setPendingCustomValues] = useState<Record<string, unknown>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [requiredFieldsModalOpen, setRequiredFieldsModalOpen] = useState(false);
    const [lastSource, setLastSource] = useState<CheckInSource | null>(null);

    const activeCodeRef = useRef('');
    const lastProcessedRef = useRef<{ code: string; at: number } | null>(null);

    const resetFlow = useCallback(() => {
        setRegistration(null);
        setMissingFields([]);
        setPendingCustomValues({});
        setFieldErrors({});
        setRequiredFieldsModalOpen(false);
        activeCodeRef.current = '';
    }, []);

    const shouldDedup = (code: string): boolean => {
        const now = Date.now();
        const last = lastProcessedRef.current;
        if (last && last.code === code && now - last.at < DEDUP_MS) {
            return true;
        }
        lastProcessedRef.current = { code, at: now };
        return false;
    };

    const completeCheckIn = useCallback(async (customFieldValues?: Record<string, unknown>, source?: CheckInSource) => {
        const confirmationCode = activeCodeRef.current;
        const checkedIn = await eventsAPI.checkInRegistration(eventId, 'code', {
            confirmationCode,
            ...(customFieldValues ? { customFieldValues } : {}),
        });
        const via = source ? SOURCE_LABEL[source] : 'scan';
        setResult({
            type: 'success',
            message: `Checked in ${checkedIn.fullName} (${checkedIn.confirmationCode}) via ${via}`,
        });
        setManualCode('');
        resetFlow();
        onCheckIn();
    }, [eventId, onCheckIn, resetFlow]);

    const processConfirmationCode = useCallback(async (rawInput: string, source: CheckInSource) => {
        const parsed = source === 'manual'
            ? rawInput.trim().toUpperCase()
            : parseScannedPayload(rawInput);

        if (!parsed) {
            setResult({
                type: 'error',
                message: source === 'manual' ? 'Enter a confirmation code.' : 'Invalid QR code.',
            });
            return;
        }

        if (shouldDedup(parsed)) {
            return;
        }

        activeCodeRef.current = parsed;
        setLastSource(source);
        if (source === 'manual') {
            setManualCode(rawInput);
        }

        setLoading(true);
        setResult(null);
        setFieldErrors({});

        try {
            const lookup = await eventsAPI.lookupRegistrationByCode(eventId, parsed);

            if (lookup.registration.status === 'CHECKED_IN') {
                setResult({
                    type: 'error',
                    message: `${lookup.registration.fullName} is already checked in.`,
                });
                resetFlow();
                return;
            }

            setRegistration(lookup.registration);
            setMissingFields(lookup.missingRequiredFields);

            if (lookup.missingRequiredFields.length === 0) {
                await completeCheckIn(undefined, source);
                return;
            }

            setPendingCustomValues({});
            setRequiredFieldsModalOpen(true);
        } catch (error) {
            setResult({ type: 'error', message: error instanceof Error ? error.message : 'Lookup failed' });
            resetFlow();
        } finally {
            setLoading(false);
        }
    }, [completeCheckIn, eventId, resetFlow]);

    const handleCompleteCheckIn = useCallback(async () => {
        if (!registration) return;

        const errors: Record<string, string> = {};
        for (const field of missingFields) {
            const fieldKey = String(field.id);
            const value = pendingCustomValues[fieldKey];
            if (isCustomFieldValueEmpty(field, value)) {
                errors[fieldKey] = `${field.label} is required.`;
            }
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setLoading(true);
        setFieldErrors({});

        try {
            const merged = mergeCustomFieldValues(
                registration.customFieldValues as Record<string, unknown> | null | undefined,
                pendingCustomValues,
            );
            await completeCheckIn(merged, lastSource ?? 'manual');
        } catch (error) {
            setResult({ type: 'error', message: error instanceof Error ? error.message : 'Check-in failed' });
        } finally {
            setLoading(false);
        }
    }, [completeCheckIn, lastSource, missingFields, pendingCustomValues, registration]);

    const handleCancelRequiredFields = useCallback(() => {
        resetFlow();
        setResult(null);
    }, [resetFlow]);

    const updatePendingField = useCallback((fieldKey: string, value: unknown) => {
        setPendingCustomValues((current) => ({ ...current, [fieldKey]: value }));
        setFieldErrors((current) => {
            if (!current[fieldKey]) return current;
            const next = { ...current };
            delete next[fieldKey];
            return next;
        });
    }, []);

    const handleManualLookup = useCallback(() => {
        void processConfirmationCode(manualCode, 'manual');
    }, [manualCode, processConfirmationCode]);

    return {
        manualCode,
        setManualCode,
        result,
        registration,
        missingFields,
        pendingCustomValues,
        fieldErrors,
        loading,
        requiredFieldsModalOpen,
        lastSource,
        processConfirmationCode,
        handleCompleteCheckIn,
        handleCancelRequiredFields,
        updatePendingField,
        handleManualLookup,
    };
}
