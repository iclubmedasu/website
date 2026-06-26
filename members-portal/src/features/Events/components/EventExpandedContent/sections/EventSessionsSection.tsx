import { useCallback, useEffect, useState, type ReactNode } from 'react';
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

function formatSessionDateLabel(sessionDate: string): string {
    const parsed = new Date(`${sessionDate.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return sessionDate;
    return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function validateSessionInput(
    label: string,
    sessionDate: string,
    mode: EventSessionMode,
    onlineUrl: string,
): string | null {
    if (!label.trim()) return 'Session title is required.';
    if (!sessionDate.trim()) return 'Session date is required.';
    if (!mode) return 'Session type is required.';
    if (requiresOnlineUrl(mode) && !onlineUrl.trim()) {
        return 'Meeting link is required for online sessions.';
    }
    return null;
}

export default function EventSessionsSection({ eventId, canManage = false }: EventSessionsSectionProps) {
    const [sessions, setSessions] = useState<EventSessionRef[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [editingSessionId, setEditingSessionId] = useState<number | null>(null);

    const [label, setLabel] = useState('');
    const [sessionDate, setSessionDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [mode, setMode] = useState<EventSessionMode>('ONSITE');
    const [onlineUrl, setOnlineUrl] = useState('');

    const [editLabel, setEditLabel] = useState('');
    const [editSessionDate, setEditSessionDate] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editMode, setEditMode] = useState<EventSessionMode>('ONSITE');
    const [editOnlineUrl, setEditOnlineUrl] = useState('');

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
        setSessionDate('');
        setStartTime('');
        setEndTime('');
        setMode('ONSITE');
        setOnlineUrl('');
    };

    const handleCreateSession = async () => {
        const validationError = validateSessionInput(label, sessionDate, mode, onlineUrl);
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setFormError('');
        const payload: CreateEventSessionPayload = {
            label: label.trim(),
            sessionDate: sessionDate.trim(),
            startTime: startTime.trim() || null,
            endTime: endTime.trim() || null,
            mode,
            onlineUrl: requiresOnlineUrl(mode) ? onlineUrl.trim() : null,
        };

        try {
            const created = await eventsAPI.createSession(eventId, payload);
            setSessions((current) => [...current, created]);
            resetCreateForm();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create session.');
        }
    };

    const startEdit = (session: EventSessionRef) => {
        setEditingSessionId(Number(session.id));
        setEditLabel(session.label ?? '');
        setEditSessionDate(session.sessionDate.slice(0, 10));
        setEditStartTime(session.startTime ?? '');
        setEditEndTime(session.endTime ?? '');
        setEditMode(session.mode === 'ONSITE' ? 'ONSITE' : 'ONLINE');
        setEditOnlineUrl(session.onlineUrl ?? '');
        setFormError('');
    };

    const cancelEdit = () => {
        setEditingSessionId(null);
        setEditLabel('');
        setEditSessionDate('');
        setEditStartTime('');
        setEditEndTime('');
        setEditMode('ONSITE');
        setEditOnlineUrl('');
    };

    const saveEdit = async (session: EventSessionRef) => {
        const validationError = validateSessionInput(editLabel, editSessionDate, editMode, editOnlineUrl);
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setFormError('');
        const payload: UpdateEventSessionPayload = {
            label: editLabel.trim(),
            sessionDate: editSessionDate.trim(),
            startTime: editStartTime.trim() || null,
            endTime: editEndTime.trim() || null,
            mode: editMode,
            onlineUrl: requiresOnlineUrl(editMode) ? editOnlineUrl.trim() : null,
        };

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
            sessionDate: string;
            startTime: string;
            endTime: string;
            mode: EventSessionMode;
            onlineUrl: string;
        },
        setters: {
            setLabel: (value: string) => void;
            setSessionDate: (value: string) => void;
            setStartTime: (value: string) => void;
            setEndTime: (value: string) => void;
            setMode: (value: EventSessionMode) => void;
            setOnlineUrl: (value: string) => void;
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
                type="date"
                value={values.sessionDate}
                onChange={(e) => setters.setSessionDate(e.target.value)}
                className="form-input event-session-date-input"
                disabled={options?.disabled}
                aria-label="Session date"
            />
            <div className="event-session-time-range">
                <input
                    type="time"
                    value={values.startTime}
                    onChange={(e) => setters.setStartTime(e.target.value)}
                    className="form-input"
                    disabled={options?.disabled}
                    aria-label="Start time"
                />
                <input
                    type="time"
                    value={values.endTime}
                    onChange={(e) => setters.setEndTime(e.target.value)}
                    className="form-input"
                    disabled={options?.disabled}
                    aria-label="End time"
                />
            </div>
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
                        { label, sessionDate, startTime, endTime, mode, onlineUrl },
                        { setLabel, setSessionDate, setStartTime, setEndTime, setMode, setOnlineUrl },
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
                    const timeRange = session.startTime && session.endTime
                        ? `${session.startTime} – ${session.endTime}`
                        : null;
                    const attendanceCount = session._count?.attendances ?? 0;

                    if (sessionIsEditing) {
                        return (
                            <div key={session.id} className="event-expanded-list-item event-expanded-list-item--editing">
                                <div className="event-expanded-form-grid event-expanded-session-form-grid" style={{ flex: 1 }}>
                                    {renderSessionFormFields(
                                        {
                                            label: editLabel,
                                            sessionDate: editSessionDate,
                                            startTime: editStartTime,
                                            endTime: editEndTime,
                                            mode: editMode,
                                            onlineUrl: editOnlineUrl,
                                        },
                                        {
                                            setLabel: setEditLabel,
                                            setSessionDate: setEditSessionDate,
                                            setStartTime: setEditStartTime,
                                            setEndTime: setEditEndTime,
                                            setMode: setEditMode,
                                            setOnlineUrl: setEditOnlineUrl,
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
                                <span className="event-expanded-muted">
                                    {formatSessionDateLabel(session.sessionDate)}
                                </span>
                                {' '}
                                <span className={`event-session-mode-badge event-session-mode-badge--${session.mode.toLowerCase()}`}>
                                    {formatModeLabel(session.mode)}
                                </span>
                                <p className="event-expanded-muted">
                                    {timeRange ? `${timeRange} · ` : ''}
                                    {attendanceCount} attended
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
