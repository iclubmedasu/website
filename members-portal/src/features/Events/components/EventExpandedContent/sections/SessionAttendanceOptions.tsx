import type { EventSessionRef } from '@/types/backend-contracts';

function getSessionTitle(session: EventSessionRef): string {
    return session.label?.trim() || 'Untitled session';
}

function formatSessionMode(mode: string): string {
    if (mode === 'ONSITE') return 'Onsite';
    if (mode === 'ONLINE') return 'Online';
    return mode;
}

interface SessionAttendanceOptionsProps {
    activeSessionsNow: EventSessionRef[];
    selectedSessionId: string | null;
    onSelectSessionId: (sessionId: string | null) => void;
    alreadyHasDayAttendance?: boolean;
    radioName?: string;
}

export default function SessionAttendanceOptions({
    activeSessionsNow,
    selectedSessionId,
    onSelectSessionId,
    alreadyHasDayAttendance = false,
    radioName = 'session-attendance',
}: SessionAttendanceOptionsProps) {
    if (activeSessionsNow.length === 0) return null;

    const sessionSelectorValue = selectedSessionId ?? '';

    return (
        <section className="form-section">
            <h3 className="form-section-title">Session attendance</h3>
            <p className="form-hint-text">
                Select the session this person is attending, or choose general attendance if they are not entering a specific session.
            </p>
            <div className="radio-group-list radio-group-list-compact" role="radiogroup" aria-label="Session attendance">
                {!alreadyHasDayAttendance ? (
                    <label className={`radio-option-card ${sessionSelectorValue === '' ? 'selected' : ''}`}>
                        <input
                            type="radio"
                            name={radioName}
                            value=""
                            checked={sessionSelectorValue === ''}
                            onChange={() => onSelectSessionId(null)}
                        />
                        <span className="radio-option-title">General attendance only</span>
                        <span className="radio-option-desc">Record day attendance without linking to a specific session.</span>
                    </label>
                ) : null}
                {activeSessionsNow.map((session) => {
                    const sessionId = String(session.id);
                    const timeRange = session.startTime && session.endTime
                        ? `${session.startTime}–${session.endTime}`
                        : null;
                    const isSelected = sessionSelectorValue === sessionId;
                    const modeLabel = formatSessionMode(session.mode);
                    return (
                        <label key={session.id} className={`radio-option-card ${isSelected ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name={radioName}
                                value={sessionId}
                                checked={isSelected}
                                onChange={() => onSelectSessionId(sessionId)}
                            />
                            <span className="radio-option-title">{getSessionTitle(session)}</span>
                            <span className="radio-option-desc">
                                {[timeRange, modeLabel].filter(Boolean).join(' · ')}
                            </span>
                        </label>
                    );
                })}
            </div>
        </section>
    );
}
