import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDurationMinutes } from '@iclub/shared/utils';
import { eventsAPI } from '@/services/api';
import type {
    CheckInRegistrationResult,
    EventCustomFieldRef,
    EventRegistrationRef,
    EventSessionRef,
    EventTierRef,
    Id,
    SessionAttendanceSummary,
} from '@/types/backend-contracts';
import { compareSessionsBySchedule } from '../eventUtils';
import { isCustomFieldValueEmpty, mergeCustomFieldValues } from './customFieldUtils';
import { parseScannedPayload } from './checkInScanUtils';
import {
    playCheckInDetectBeep,
    playCheckInSuccessBeep,
    playCheckOutSuccessBeep,
} from './checkInSounds';
import { AUTO_DISMISS_MS } from '@/hooks/useAutoDismissMessage';
export type CheckInSource = 'camera' | 'scanner' | 'manual' | 'table';
export type CheckInResultState = {
    type: 'success' | 'checkout' | 'error';
    message: string;
} | null;
const DEDUP_MS = 2000;
const STATION_SESSION_STORAGE_PREFIX = 'event-checkin-station-session:';
const SOURCE_LABEL: Record<CheckInSource, string> = {
    camera: 'camera',
    scanner: 'scanner',
    manual: 'manual entry',
    table: 'table',
};
interface UseCheckInFlowOptions {
    eventId: Id | string;
    onCheckIn: () => void;
    tiers?: EventTierRef[];
    sessions?: EventSessionRef[];
    tierFieldRequired?: boolean;
    sessionFieldRequired?: boolean;
    trackSessionCheckOut?: boolean;
}
function stationStorageKey(eventId: Id | string): string {
    return `${STATION_SESSION_STORAGE_PREFIX}${eventId}`;
}
function readStationSessionId(eventId: Id | string): string {
    if (typeof window === 'undefined') return '';
    try {
        return window.localStorage.getItem(stationStorageKey(eventId)) ?? '';
    } catch {
        return '';
    }
}
function writeStationSessionId(eventId: Id | string, sessionId: string): void {
    if (typeof window === 'undefined') return;
    try {
        const key = stationStorageKey(eventId);
        if (!sessionId) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, sessionId);
        }
    } catch {
        // localStorage unavailable — ignore.
    }
}
function formatVisitDurations(
    thisVisit: number | null | undefined,
    total: number | null | undefined,
): string {
    const parts: string[] = [];
    if (thisVisit != null && thisVisit >= 0) {
        parts.push(`${formatDurationMinutes(thisVisit)} this visit`);
    }
    if (total != null && total >= 0) {
        parts.push(`${formatDurationMinutes(total)} total`);
    }
    return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}
export function useCheckInFlow({
    eventId,
    onCheckIn,
    tiers = [],
    sessions = [],
    tierFieldRequired = false,
    sessionFieldRequired = false,
    trackSessionCheckOut = false,
}: UseCheckInFlowOptions) {
    const [manualCode, setManualCode] = useState('');
    const [result, setResult] = useState<CheckInResultState>(null);
    const [registration, setRegistration] = useState<EventRegistrationRef | null>(null);
    const [missingFields, setMissingFields] = useState<EventCustomFieldRef[]>([]);
    const [pendingCustomValues, setPendingCustomValues] = useState<Record<string, unknown>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [requiredFieldsModalOpen, setRequiredFieldsModalOpen] = useState(false);
    const [lastSource, setLastSource] = useState<CheckInSource | null>(null);
    const [activeSessionsNow, setActiveSessionsNow] = useState<EventSessionRef[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [alreadyHasDayAttendance, setAlreadyHasDayAttendance] = useState(false);
    const [needsTier, setNeedsTier] = useState(false);
    const [needsSessions, setNeedsSessions] = useState(false);
    const [selectedTierId, setSelectedTierId] = useState('');
    const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
    const [stationSessionId, setStationSessionIdState] = useState(() => readStationSessionId(eventId));
    const [sessionSummaries, setSessionSummaries] = useState<SessionAttendanceSummary[]>([]);
    const [closingOpen, setClosingOpen] = useState(false);
    const [openInsideCount, setOpenInsideCount] = useState(0);
    const [lastCheckedInRegistration, setLastCheckedInRegistration] = useState<EventRegistrationRef | null>(null);
    const activeCodeRef = useRef('');
    const lastProcessedRef = useRef<{ code: string; at: number } | null>(null);
    const showCombinedModal = requiredFieldsModalOpen
        || activeSessionsNow.length > 0
        || needsTier
        || needsSessions;
    useEffect(() => {
        setStationSessionIdState(readStationSessionId(eventId));
    }, [eventId]);

    useEffect(() => {
        if (!result) return;
        const timer = setTimeout(() => setResult(null), AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [result]);

    const setStationSessionId = useCallback((sessionId: string) => {
        setStationSessionIdState(sessionId);
        writeStationSessionId(eventId, sessionId);
    }, [eventId]);
    const sortedActiveSessions = useMemo(
        () => [...sessions]
            .filter((session) => session.isActive !== false)
            .sort(compareSessionsBySchedule),
        [sessions],
    );
    const stationSession = useMemo(
        () => sortedActiveSessions.find((session) => String(session.id) === stationSessionId) ?? null,
        [sortedActiveSessions, stationSessionId],
    );
    // Count people currently inside the selected station session (from registration list is not available here;
    // the panel can pass openInsideCount via refreshOpenCount). We keep local state updated after actions.
    const refreshOpenCount = useCallback(async () => {
        if (!trackSessionCheckOut || !stationSessionId) {
            setOpenInsideCount(0);
            return;
        }
        // Open count is hydrated by parent table data when possible; leave as-is if unknown.
    }, [stationSessionId, trackSessionCheckOut]);
    const resetFlow = useCallback(() => {
        setRegistration(null);
        setMissingFields([]);
        setPendingCustomValues({});
        setFieldErrors({});
        setRequiredFieldsModalOpen(false);
        setActiveSessionsNow([]);
        setSelectedSessionId(null);
        setAlreadyHasDayAttendance(false);
        setNeedsTier(false);
        setNeedsSessions(false);
        setSelectedTierId('');
        setSelectedSessionIds([]);
        setSessionSummaries([]);
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
    const applyCheckInResult = useCallback((
        checkedIn: CheckInRegistrationResult,
        source?: CheckInSource,
    ) => {
        const via = source ? SOURCE_LABEL[source] : 'scan';
        const priorDays = checkedIn.attendanceDays?.length ?? 0;
        const dayNote = priorDays > 1 ? ` (day ${priorDays} of attendance)` : '';
        if (checkedIn.sessionAction === 'checked_out') {
            const durationNote = formatVisitDurations(
                checkedIn.thisVisitDurationMinutes,
                checkedIn.totalSessionDurationMinutes,
            );
            setResult({
                type: 'checkout',
                message: `Checked out ${checkedIn.fullName} (${checkedIn.confirmationCode}) via ${via}${durationNote}`,
            });
            playCheckOutSuccessBeep();
        } else {
            setResult({
                type: 'success',
                message: `Checked in ${checkedIn.fullName} (${checkedIn.confirmationCode}) via ${via}${dayNote}`,
            });
            playCheckInSuccessBeep();
        }
        setLastCheckedInRegistration(checkedIn);
        setManualCode('');
        resetFlow();
        onCheckIn();
    }, [onCheckIn, resetFlow]);
    const completeCheckIn = useCallback(async (
        customFieldValues?: Record<string, unknown>,
        source?: CheckInSource,
        sessionId?: string | null,
        tierId?: string | null,
        sessionIds?: string[],
    ) => {
        const confirmationCode = activeCodeRef.current;
        const checkedIn = await eventsAPI.checkInRegistration(eventId, 'code', {
            confirmationCode,
            ...(customFieldValues ? { customFieldValues } : {}),
            ...(sessionId ? { sessionId } : {}),
            ...(tierId ? { tierId } : {}),
            ...(sessionIds && sessionIds.length > 0 ? { sessionIds } : {}),
        });
        applyCheckInResult(checkedIn, source);
    }, [applyCheckInResult, eventId]);
    const processConfirmationCode = useCallback(async (rawInput: string, source: CheckInSource) => {
        const parsed = source === 'manual' || source === 'table'
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
        if (source === 'camera' || source === 'scanner') {
            playCheckInDetectBeep();
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
            const activeNow = lookup.activeSessionsNow ?? [];
            const alreadyCheckedIn = lookup.alreadyCheckedInToday ?? lookup.checkedInToday;
            const summaries = lookup.sessionAttendanceSummaries ?? [];
            setSessionSummaries(summaries);
            const openSessionIds = new Set(
                summaries.filter((summary) => summary.hasOpenSegment).map((summary) => String(summary.sessionId)),
            );
            const attendedSessionIds = new Set(
                (lookup.existingSessionAttendances ?? []).map((attendance) => String(attendance.sessionId)),
            );
            // When check-out tracking is on, sessions with open OR closed segments remain actionable.
            // Without tracking, only unattended sessions are offered (legacy one-and-done).
            const sessionsForModal = trackSessionCheckOut
                ? activeNow
                : activeNow.filter((session) => !attendedSessionIds.has(String(session.id)));
            const registrationNeedsTier = tierFieldRequired && !lookup.registration.tier;
            const registrationNeedsSessions = sessionFieldRequired
                && (lookup.registration.sessionSelections?.length ?? 0) === 0;
            const existingSelectionIds = (lookup.registration.sessionSelections ?? [])
                .map((selection) => String(selection.sessionId));
            // Preselected station session: skip session modal, auto check-in/out when possible.
            const preselectedSessionId = stationSessionId
                && sortedActiveSessions.some((session) => String(session.id) === stationSessionId)
                ? stationSessionId
                : '';
            if (
                preselectedSessionId
                && trackSessionCheckOut
                && lookup.missingRequiredFields.length === 0
                && !registrationNeedsTier
                && !registrationNeedsSessions
            ) {
                await completeCheckIn(undefined, source, preselectedSessionId);
                return;
            }
            // Legacy / no station: already fully checked with nothing actionable.
            if (
                !trackSessionCheckOut
                && alreadyCheckedIn
                && sessionsForModal.length === 0
                && !registrationNeedsTier
                && !registrationNeedsSessions
                && lookup.missingRequiredFields.length === 0
                && !preselectedSessionId
            ) {
                const alreadyMessage = activeNow.length === 1
                    ? `${lookup.registration.fullName} is already checked in for the current session.`
                    : activeNow.length > 1
                        ? `${lookup.registration.fullName} is already checked in for today's active sessions.`
                        : `${lookup.registration.fullName} is already checked in today.`;
                setResult({
                    type: 'error',
                    message: alreadyMessage,
                });
                resetFlow();
                return;
            }
            // Station preselected without checkout tracking: auto when not yet attended that session.
            if (
                preselectedSessionId
                && !trackSessionCheckOut
                && lookup.missingRequiredFields.length === 0
                && !registrationNeedsTier
                && !registrationNeedsSessions
            ) {
                if (attendedSessionIds.has(preselectedSessionId) && alreadyCheckedIn) {
                    setResult({
                        type: 'error',
                        message: `${lookup.registration.fullName} is already checked in for the selected session.`,
                    });
                    resetFlow();
                    return;
                }
                await completeCheckIn(undefined, source, preselectedSessionId);
                return;
            }
            setRegistration(lookup.registration);
            setMissingFields(lookup.missingRequiredFields);
            setActiveSessionsNow(sessionsForModal);
            setNeedsTier(registrationNeedsTier);
            setNeedsSessions(registrationNeedsSessions);
            setSelectedTierId('');
            setSelectedSessionIds(existingSelectionIds);
            if (preselectedSessionId) {
                setSelectedSessionId(preselectedSessionId);
            } else if (alreadyCheckedIn && sessionsForModal.length > 0) {
                setAlreadyHasDayAttendance(true);
                // Prefer an open session if check-out tracking (checkout), else first unattended.
                const preferred = trackSessionCheckOut
                    ? sessionsForModal.find((session) => openSessionIds.has(String(session.id)))
                        ?? sessionsForModal[0]
                    : sessionsForModal[0];
                setSelectedSessionId(String(preferred.id));
            } else if (sessionsForModal.length > 0) {
                // Prefer station if it is in the list, else null (or first when only sessions matter).
                const stationInList = sessionsForModal.find(
                    (session) => String(session.id) === stationSessionId,
                );
                setSelectedSessionId(stationInList ? String(stationInList.id) : null);
            }
            if (alreadyCheckedIn && sessionsForModal.length > 0) {
                setAlreadyHasDayAttendance(true);
            }
            const canAutoCheckIn = lookup.missingRequiredFields.length === 0
                && sessionsForModal.length === 0
                && !registrationNeedsTier
                && !registrationNeedsSessions
                && !preselectedSessionId;
            if (canAutoCheckIn) {
                // Day-only auto check-in (no active sessions)
                if (!alreadyCheckedIn) {
                    await completeCheckIn(undefined, source);
                    return;
                }
                setResult({
                    type: 'error',
                    message: `${lookup.registration.fullName} is already checked in today.`,
                });
                resetFlow();
                return;
            }
            // Station preselected + still need fields → open modal with session locked.
            if (preselectedSessionId) {
                setAlreadyHasDayAttendance(alreadyCheckedIn);
                setPendingCustomValues({});
                if (lookup.missingRequiredFields.length > 0 || registrationNeedsTier || registrationNeedsSessions) {
                    setRequiredFieldsModalOpen(true);
                }
                return;
            }
            setPendingCustomValues({});
            if (lookup.missingRequiredFields.length > 0 || registrationNeedsTier || registrationNeedsSessions) {
                setRequiredFieldsModalOpen(true);
            }
        } catch (error) {
            setResult({ type: 'error', message: error instanceof Error ? error.message : 'Lookup failed' });
            resetFlow();
        } finally {
            setLoading(false);
        }
    }, [
        completeCheckIn,
        eventId,
        resetFlow,
        sessionFieldRequired,
        sortedActiveSessions,
        stationSessionId,
        tierFieldRequired,
        trackSessionCheckOut,
    ]);
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
        if (needsTier && !selectedTierId) {
            errors._tier = 'A registration tier is required.';
        }
        if (needsSessions && selectedSessionIds.length === 0) {
            errors._sessions = 'At least one session must be selected.';
        }
        if (activeSessionsNow.length > 0 && selectedSessionId === null && alreadyHasDayAttendance) {
            errors._sessionAttendance = 'Select a session.';
        }
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setLoading(true);
        setFieldErrors({});
        try {
            const merged = missingFields.length > 0
                ? mergeCustomFieldValues(
                    registration.customFieldValues as Record<string, unknown> | null | undefined,
                    pendingCustomValues,
                )
                : undefined;
            await completeCheckIn(
                merged,
                lastSource ?? 'manual',
                selectedSessionId,
                needsTier ? selectedTierId : undefined,
                needsSessions ? selectedSessionIds : undefined,
            );
        } catch (error) {
            setResult({ type: 'error', message: error instanceof Error ? error.message : 'Check-in failed' });
        } finally {
            setLoading(false);
        }
    }, [
        activeSessionsNow.length,
        alreadyHasDayAttendance,
        completeCheckIn,
        lastSource,
        missingFields,
        needsSessions,
        needsTier,
        pendingCustomValues,
        registration,
        selectedSessionId,
        selectedSessionIds,
        selectedTierId,
    ]);
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
    const toggleSessionSelection = useCallback((sessionId: string) => {
        setSelectedSessionIds((current) => {
            if (current.includes(sessionId)) {
                return current.filter((id) => id !== sessionId);
            }
            const session = sessions.find((s) => String(s.id) === sessionId);
            if (session?.isFull) return current;
            return [...current, sessionId];
        });
        setFieldErrors((current) => {
            if (!current._sessions) return current;
            const next = { ...current };
            delete next._sessions;
            return next;
        });
    }, [sessions]);
    const clearFieldError = useCallback((key: string) => {
        setFieldErrors((current) => {
            if (!current[key]) return current;
            const next = { ...current };
            delete next[key];
            return next;
        });
    }, []);
    const handleManualLookup = useCallback(() => {
        void processConfirmationCode(manualCode, 'manual');
    }, [manualCode, processConfirmationCode]);
    const handleCloseOpenAttendances = useCallback(async () => {
        if (!stationSessionId || !trackSessionCheckOut) return;
        setClosingOpen(true);
        try {
            const resultClose = await eventsAPI.closeOpenSessionAttendances(eventId, stationSessionId);
            setResult({
                type: 'checkout',
                message: resultClose.closedCount === 0
                    ? 'No one is currently checked into this session.'
                    : `Closed ${resultClose.closedCount} open check-in${resultClose.closedCount === 1 ? '' : 's'}.`,
            });
            setOpenInsideCount(0);
            onCheckIn();
        } catch (error) {
            setResult({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to close open check-ins',
            });
        } finally {
            setClosingOpen(false);
        }
    }, [eventId, onCheckIn, stationSessionId, trackSessionCheckOut]);
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
        clearFieldError,
        tiers,
        sortedActiveSessions,
        lastSource,
        processConfirmationCode,
        handleCompleteCheckIn,
        handleCancelRequiredFields,
        updatePendingField,
        handleManualLookup,
        lastCheckedInRegistration,
        trackSessionCheckOut,
        stationSessionId,
        setStationSessionId,
        stationSession,
        sessionSummaries,
        handleCloseOpenAttendances,
        closingOpen,
        openInsideCount,
        setOpenInsideCount,
        refreshOpenCount,
    };
}
export type UseCheckInFlowReturn = ReturnType<typeof useCheckInFlow>;
