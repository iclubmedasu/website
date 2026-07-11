import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
    formatSessionRange,
    fromDateTimeLocalValue,
    toDateTimeLocalValue,
} from '@iclub/shared/utils';
import { eventsAPI } from '@/services/api';
import type {
    CreateEventSessionPayload,
    EventSessionMode,
    EventSessionRef,
    Id,
    UpdateEventSessionPayload,
} from '@/types/backend-contracts';

interface EventSessionsSectionProps {
    eventId: Id | string;
    canManage?: boolean;
}

function formatModeLabel(mode: EventSessionMode | string): string {
    if (mode === 'ONSITE') return 'Onsite';
    return 'Online';
}

function requiresOnlineUrl(mode: EventSessionMode | string): boolean {
    return mode === 'ONLINE';
}

function truncateUrl(url: string, maxLength = 48): string {
    if (url.length <= maxLength) return url;
    return `${url.slice(0, maxLength - 1)}…`;
}

function parseMaxCapacityInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return Number.parseInt(trimmed, 10);
}

function formatSessionCapacity(session: EventSessionRef): string | null {
    const registered = session.registeredCount ?? 0;
    if (session.maxCapacity != null) {
        return `${registered} / ${session.maxCapacity}`;
    }
    if (registered > 0) {
        return `${registered} / Unlimited`;
    }
    return null;
}

function validateSessionInput(
    label: string,
    startDateTime: string,
    endDateTime: string,
    mode: EventSessionMode,
    onlineUrl: string,
    maxCapacity: string,
    options?: { registeredCount?: number },
): string | null {
    if (!label.trim()) return 'Session title is required.';
    if (!startDateTime.trim() || !endDateTime.trim()) return 'Session start and end are required.';
    if (new Date(endDateTime).getTime() < new Date(startDateTime).getTime()) {
        return 'Session end must be on or after the start.';
    }
    if (!mode) return 'Session type is required.';
    if (requiresOnlineUrl(mode) && !onlineUrl.trim()) {
        return 'Meeting link is required for online sessions.';
    }
    const trimmedCapacity = maxCapacity.trim();
    if (trimmedCapacity) {
        const parsed = Number.parseInt(trimmedCapacity, 10);
        if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== trimmedCapacity) {
            return 'Max capacity must be a positive integer or empty for unlimited.';
        }
        const registeredCount = options?.registeredCount ?? 0;
        if (parsed < registeredCount) {
            return `Cannot set max capacity below current registrations (${registeredCount}).`;
        }
    }
    return null;
}

function buildSessionPayload(
    label: string,
    startDateTime: string,
    endDateTime: string,
    mode: EventSessionMode,
    onlineUrl: string,
    maxCapacity: string,
): CreateEventSessionPayload | null {
    const startIso = fromDateTimeLocalValue(startDateTime);
    const endIso = fromDateTimeLocalValue(endDateTime);
    if (!startIso || !endIso) return null;
    return {
        label: label.trim(),
        startDateTime: startIso,
        endDateTime: endIso,
        mode,
        onlineUrl: requiresOnlineUrl(mode) ? onlineUrl.trim() : null,
        maxCapacity: parseMaxCapacityInput(maxCapacity),
    };
}

function hydrateSessionTimes(session: EventSessionRef): { start: string; end: string } {
    if (session.startDateTime && session.endDateTime) {
        return {
            start: toDateTimeLocalValue(session.startDateTime),
            end: toDateTimeLocalValue(session.endDateTime),
        };
    }
    const day = session.sessionDate.slice(0, 10);
    return {
        start: session.startTime ? `${day}T${session.startTime}` : '',
        end: session.endTime ? `${day}T${session.endTime}` : '',
    };
}

export default function EventSessionsSection({ eventId, canManage = false }: EventSessionsSectionProps) {
    const [sessions, setSessions] = useState<EventSessionRef[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [editingSessionId, setEditingSessionId] = useState<number | null>(null);

    const [label, setLabel] = useState('');
    const [startDateTime, setStartDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');
    const [mode, setMode] = useState<EventSessionMode>('ONSITE');
    const [onlineUrl, setOnlineUrl] = useState('');
    const [maxCapacity, setMaxCapacity] = useState('');

    const [editLabel, setEditLabel] = useState('');
    const [editStartDateTime, setEditStartDateTime] = useState('');
    const [editEndDateTime, setEditEndDateTime] = useState('');
    const [editMode, setEditMode] = useState<EventSessionMode>('ONSITE');
    const [editOnlineUrl, setEditOnlineUrl] = useState('');
    const [editMaxCapacity, setEditMaxCapacity] = useState('');

    const isEditing = editingSessionId != null;

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await eventsAPI.getSessions(eventId);
            setSessions(result);
        } catch {
            setSessions([]);
            setError('Failed to load sessions.');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

    const resetCreateForm = () => {
        setLabel('');
        setStartDateTime('');
        setEndDateTime('');
        setMode('ONSITE');
        setOnlineUrl('');
        setMaxCapacity('');
    };

    const handleCreateSession = async () => {
        const validationError = validateSessionInput(
            label,
            startDateTime,
            endDateTime,
            mode,
            onlineUrl,
            maxCapacity,
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const payload = buildSessionPayload(label, startDateTime, endDateTime, mode, onlineUrl, maxCapacity);
        if (!payload) {
            setFormError('Please enter valid session start and end times.');
            return;
        }

        setFormError('');
        try {
            const created = await eventsAPI.createSession(eventId, payload);
            setSessions((current) => [...current, created]);
            resetCreateForm();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create session.');
        }
    };

    const startEdit = (session: EventSessionRef) => {
        const times = hydrateSessionTimes(session);
        setEditingSessionId(Number(session.id));
        setEditLabel(session.label ?? '');
        setEditStartDateTime(times.start);
        setEditEndDateTime(times.end);
        setEditMode(session.mode === 'ONSITE' ? 'ONSITE' : 'ONLINE');
        setEditOnlineUrl(session.onlineUrl ?? '');
        setEditMaxCapacity(session.maxCapacity != null ? String(session.maxCapacity) : '');
        setFormError('');
    };

    const cancelEdit = () => {
        setEditingSessionId(null);
        setEditLabel('');
        setEditStartDateTime('');
        setEditEndDateTime('');
        setEditMode('ONSITE');
        setEditOnlineUrl('');
        setEditMaxCapacity('');
    };

    const saveEdit = async (session: EventSessionRef) => {
        const validationError = validateSessionInput(
            editLabel,
            editStartDateTime,
            editEndDateTime,
            editMode,
            editOnlineUrl,
            editMaxCapacity,
            { registeredCount: session.registeredCount ?? 0 },
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const payload = buildSessionPayload(
            editLabel,
            editStartDateTime,
            editEndDateTime,
            editMode,
            editOnlineUrl,
            editMaxCapacity,
        ) as UpdateEventSessionPayload | null;
        if (!payload) {
            setFormError('Please enter valid session start and end times.');
            return;
        }

        setFormError('');
        try {
            const updated = await eventsAPI.updateSession(eventId, session.id, payload);
            setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
            cancelEdit();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to update session.');
        }
    };

    const handleRemove = async (sessionId: number) => {
        try {
            await eventsAPI.removeSession(eventId, sessionId);
            setSessions((current) => current.filter((item) => Number(item.id) !== sessionId));
            if (editingSessionId === sessionId) {
                cancelEdit();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete session.');
        }
    };

    const renderSessionFormFields = (
        values: {
            label: string;
            startDateTime: string;
            endDateTime: string;
            mode: EventSessionMode;
            onlineUrl: string;
            maxCapacity: string;
        },
        setters: {
            setLabel: (value: string) => void;
            setStartDateTime: (value: string) => void;
            setEndDateTime: (value: string) => void;
            setMode: (value: EventSessionMode) => void;
            setOnlineUrl: (value: string) => void;
            setMaxCapacity: (value: string) => void;
        },
        options?: { disabled?: boolean; actions?: ReactNode },
    ) => (
        <>
            <input
                value={values.label}
                onChange={(e) => setters.setLabel(e.target.value)}
                placeholder="Session Title"
                className="form-input"
                disabled={options?.disabled}
                aria-label="Session title"
            />
            <input
                type="datetime-local"
                value={values.startDateTime}
                onChange={(e) => setters.setStartDateTime(e.target.value)}
                className="form-input event-session-date-input"
                disabled={options?.disabled}
                aria-label="Session start"
            />
            <input
                type="datetime-local"
                value={values.endDateTime}
                onChange={(e) => setters.setEndDateTime(e.target.value)}
                className="form-input event-session-date-input"
                disabled={options?.disabled}
                aria-label="Session end"
            />
            <select
                aria-label="Session type"
                value={values.mode}
                onChange={(e) => {
                    const nextMode = e.target.value as EventSessionMode;
                    setters.setMode(nextMode);
                    if (nextMode === 'ONSITE') {
                        setters.setOnlineUrl('');
                    }
                }}
                className="form-input event-session-mode-select"
                disabled={options?.disabled}
            >
                <option value="ONSITE">Onsite</option>
                <option value="ONLINE">Online</option>
            </select>
            <input
                value={values.onlineUrl}
                onChange={(e) => setters.setOnlineUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="form-input"
                disabled={options?.disabled || values.mode === 'ONSITE'}
                aria-label="Meeting link"
            />
            <input
                type="number"
                min={1}
                step={1}
                value={values.maxCapacity}
                onChange={(e) => setters.setMaxCapacity(e.target.value)}
                placeholder="Max capacity (optional)"
                className="form-input"
                disabled={options?.disabled}
                aria-label="Max capacity"
            />
            {options?.actions}
        </>
    );

    return (
        <section className="event-expanded-panel event-expanded-panel--sessions">
            <div className="event-expanded-header event-expanded-header--compact">
                <h2 className="expanded-section-title">Sessions</h2>
            </div>
            {error ? <p className="error-message">{error}</p> : null}
            {formError ? <p className="error-message">{formError}</p> : null}

            {canManage ? (
                <div className="event-expanded-form-grid event-expanded-session-form-grid">
                    {renderSessionFormFields(
                        { label, startDateTime, endDateTime, mode, onlineUrl, maxCapacity },
                        { setLabel, setStartDateTime, setEndDateTime, setMode, setOnlineUrl, setMaxCapacity },
                        {
                            disabled: isEditing,
                            actions: (
                                <button
                                    type="button"
                                    onClick={() => void handleCreateSession()}
                                    className="btn btn-primary"
                                    disabled={isEditing}
                                >
                                    Add session
                                </button>
                            ),
                        },
                    )}
                </div>
            ) : null}

            <div className="event-expanded-sessions-list-scroll">
                {loading ? <p className="event-expanded-muted">Loading sessions…</p> : null}
                <div className="event-expanded-tiers-list">
                {sessions.map((session) => {
                    const sessionIsEditing = editingSessionId === Number(session.id);
                    const actionsDisabled = isEditing && !sessionIsEditing;
                    const timeRange = session.startDateTime && session.endDateTime
                        ? formatSessionRange(session.startDateTime, session.endDateTime)
                        : null;
                    const attendanceCount = session._count?.attendances ?? 0;
                    const capacityLabel = formatSessionCapacity(session);

                    if (sessionIsEditing) {
                        return (
                            <div key={session.id} className="event-expanded-list-item event-expanded-list-item--editing">
                                <div className="event-expanded-form-grid event-expanded-session-form-grid" style={{ flex: 1 }}>
                                    {renderSessionFormFields(
                                        {
                                            label: editLabel,
                                            startDateTime: editStartDateTime,
                                            endDateTime: editEndDateTime,
                                            mode: editMode,
                                            onlineUrl: editOnlineUrl,
                                            maxCapacity: editMaxCapacity,
                                        },
                                        {
                                            setLabel: setEditLabel,
                                            setStartDateTime: setEditStartDateTime,
                                            setEndDateTime: setEditEndDateTime,
                                            setMode: setEditMode,
                                            setOnlineUrl: setEditOnlineUrl,
                                            setMaxCapacity: setEditMaxCapacity,
                                        },
                                        {
                                            actions: (
                                                <div className="event-expanded-tier-actions">
                                                    <button type="button" onClick={() => void saveEdit(session)} className="btn btn-primary">
                                                        Save
                                                    </button>
                                                    <button type="button" onClick={cancelEdit} className="btn btn-secondary">
                                                        Cancel
                                                    </button>
                                                </div>
                                            ),
                                        },
                                    )}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={session.id} className="event-expanded-list-item">
                            <div>
                                <strong>{session.label || 'Untitled session'}</strong>
                                {' '}
                                <span className={`event-session-mode-badge event-session-mode-badge--${session.mode.toLowerCase()}`}>
                                    {formatModeLabel(session.mode)}
                                </span>
                                <p className="event-expanded-muted">
                                    {timeRange || 'No schedule set'}
                                    {capacityLabel ? ` · ${capacityLabel}` : ''}
                                    {attendanceCount > 0 ? ` · ${attendanceCount} attended` : ''}
                                </p>
                                {requiresOnlineUrl(session.mode) && session.onlineUrl ? (
                                    <p className="event-expanded-muted">
                                        <a
                                            href={session.onlineUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={session.onlineUrl}
                                        >
                                            {truncateUrl(session.onlineUrl)}
                                        </a>
                                    </p>
                                ) : null}
                            </div>
                            {canManage ? (
                                <div className="event-expanded-inline-actions">
                                    <button
                                        type="button"
                                        onClick={() => startEdit(session)}
                                        className="btn btn-secondary"
                                        disabled={actionsDisabled}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleRemove(Number(session.id))}
                                        className="btn btn-danger"
                                        disabled={actionsDisabled}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
                </div>
            </div>
        </section>
    );
}
