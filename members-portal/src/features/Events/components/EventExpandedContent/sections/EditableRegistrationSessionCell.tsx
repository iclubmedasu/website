import { useEffect, useRef, useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventRegistrationRef, EventSessionRef, Id } from '@/types/backend-contracts';
import { truncateRegistrationCell } from '../customFieldUtils';
import { compareSessionsBySchedule } from '../../eventUtils';

interface EditableRegistrationSessionCellProps {
    eventId: Id | string;
    registration: EventRegistrationRef;
    sessions: EventSessionRef[];
    editable?: boolean;
    onUpdated: (updated: EventRegistrationRef) => void;
}

function readSelectedSessionIds(registration: EventRegistrationRef): string[] {
    return (registration.sessionSelections ?? []).map((selection) => String(selection.sessionId));
}

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

function getSelectionTitle(
    selection: { label?: string | null; sessionId: Id | string },
    sessions: EventSessionRef[],
): string {
    const fromLabel = selection.label?.trim();
    if (fromLabel) return fromLabel;

    const session = sessions.find((entry) => String(entry.id) === String(selection.sessionId));
    return session ? getSessionTitle(session) : 'Untitled session';
}

function getClosedLabel(
    localSessionIds: string[],
    activeSessions: EventSessionRef[],
): string {
    if (localSessionIds.length === 0) return 'Select sessions';
    if (localSessionIds.length === 1) {
        const session = activeSessions.find((entry) => String(entry.id) === localSessionIds[0]);
        if (!session) return '1 session selected';
        return truncateRegistrationCell(getSessionTitle(session), 28);
    }
    return `${localSessionIds.length} sessions selected`;
}

export default function EditableRegistrationSessionCell({
    eventId,
    registration,
    sessions,
    editable = true,
    onUpdated,
}: EditableRegistrationSessionCellProps) {
    const storedSessionIds = readSelectedSessionIds(registration);
    const [localSessionIds, setLocalSessionIds] = useState<string[]>(storedSessionIds);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalSessionIds(storedSessionIds);
    }, [storedSessionIds.join('|')]);

    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    const activeSessions = [...sessions]
        .filter((session) => session.isActive !== false)
        .sort(compareSessionsBySchedule);

    const selectedSelections = localSessionIds
        .map((sessionId) => {
            const fromRegistration = registration.sessionSelections?.find(
                (selection) => String(selection.sessionId) === sessionId,
            );
            if (fromRegistration) return fromRegistration;

            const session = sessions.find((entry) => String(entry.id) === sessionId);
            if (!session) return null;

            return {
                sessionId: session.id,
                label: session.label,
            };
        })
        .filter((selection): selection is NonNullable<typeof selection> => selection != null);

    if (!editable) {
        return (
            <td>
                {selectedSelections.length > 0 ? (
                    <span className="event-attendance-days">
                        {selectedSelections.map((selection) => {
                            const title = getSelectionTitle(selection, sessions);
                            return (
                                <span
                                    key={String(selection.sessionId)}
                                    className="event-attendance-day-chip"
                                    title={title}
                                >
                                    {title}
                                </span>
                            );
                        })}
                    </span>
                ) : '—'}
            </td>
        );
    }

    const persistSelection = async (nextSessionIds: string[]) => {
        const normalizedNext = [...new Set(nextSessionIds)].sort();
        const normalizedCurrent = [...new Set(storedSessionIds)].sort();
        if (normalizedNext.join('|') === normalizedCurrent.join('|')) {
            setLocalSessionIds(normalizedNext);
            return;
        }

        setLocalSessionIds(normalizedNext);
        setSaving(true);
        setError('');
        try {
            const updated = await eventsAPI.updateRegistrationSessions(eventId, registration.id, {
                sessionIds: normalizedNext,
            });
            onUpdated(updated);
        } catch (saveError) {
            setLocalSessionIds(storedSessionIds);
            setError(saveError instanceof Error ? saveError.message : 'Failed to update sessions.');
        } finally {
            setSaving(false);
        }
    };

    const toggleSession = (sessionId: string) => {
        const next = localSessionIds.includes(sessionId)
            ? localSessionIds.filter((id) => id !== sessionId)
            : [...localSessionIds, sessionId];
        void persistSelection(next);
    };

    const closedLabel = getClosedLabel(localSessionIds, activeSessions);
    const cellClass = [
        error ? 'event-registrations-cell--error' : '',
        saving ? 'event-registrations-cell--saving' : '',
    ].filter(Boolean).join(' ') || undefined;

    return (
        <td className={cellClass} title={error || undefined}>
            <div className="event-registration-sessions-cell" ref={containerRef}>
                <button
                    type="button"
                    className={[
                        'event-registrations-table-input',
                        'form-input',
                        'event-registration-sessions-cell__trigger',
                        localSessionIds.length === 0 ? 'event-registration-sessions-cell__trigger--placeholder' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setOpen((current) => !current)}
                    disabled={saving || activeSessions.length === 0}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-label={`Sessions for ${registration.fullName}`}
                >
                    {activeSessions.length === 0 ? 'No sessions configured' : closedLabel}
                </button>
                {open && activeSessions.length > 0 ? (
                    <div className="event-registration-sessions-cell__menu" role="listbox" aria-multiselectable="true">
                        {activeSessions.map((session) => {
                            const sessionId = String(session.id);
                            const checked = localSessionIds.includes(sessionId);
                            return (
                                <label key={sessionId} className="event-registration-sessions-cell__option">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={saving}
                                        onChange={() => toggleSession(sessionId)}
                                    />
                                    <span>{getSessionTitle(session)}</span>
                                </label>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </td>
    );
}
