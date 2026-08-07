import type { EventSessionRef, SessionAttendanceSummary } from '@/types/backend-contracts';
import { formatSessionRange } from '@iclub/shared/utils';

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
    trackSessionCheckOut?: boolean;
    sessionSummaries?: SessionAttendanceSummary[];
}

export default function SessionAttendanceOptions({
    activeSessionsNow,
    selectedSessionId,
    onSelectSessionId,
    alreadyHasDayAttendance = false,
    radioName = 'session-attendance',
    trackSessionCheckOut = false,
    sessionSummaries = [],
}: SessionAttendanceOptionsProps) {
    if (activeSessionsNow.length === 0) return null;

    const sessionSelectorValue = selectedSessionId ?? '';
    const summaryBySession = new Map(
        sessionSummaries.map((summary) => [String(summary.sessionId), summary]),
    );

    return (
        <section className="form-section">
            <h3 className="form-section-title">Session attendance</h3>
            <p className="form-hint-text">
                {trackSessionCheckOut
                    ? 'Select the session. The scan will check them in if they are outside, or out if they are still inside.'
                    : 'Select the session this person is attending, or choose general attendance if they are not entering a specific session.'}
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
                    const timeRange = session.startDateTime && session.endDateTime
                        ? formatSessionRange(session.startDateTime, session.endDateTime)
                        : null;
                    const isSelected = sessionSelectorValue === sessionId;
                    const modeLabel = formatSessionMode(session.mode);
                    const summary = summaryBySession.get(sessionId);
                    const statusParts = [timeRange, modeLabel].filter(Boolean);
                    if (trackSessionCheckOut && summary?.hasOpenSegment) {
                        statusParts.push('Currently inside');
                    } else if (trackSessionCheckOut && summary && summary.visitCount > 0) {
                        statusParts.push(`${summary.visitCount} visit${summary.visitCount === 1 ? '' : 's'}`);
                    }
                    return (
                        <label key={session.id} className={`radio-option-card ${isSelected ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name={radioName}
                                value={sessionId}
                                checked={isSelected}
                                onChange={() => onSelectSessionId(sessionId)}
                            />
                            <span className="radio-option-title">
                                {getSessionTitle(session)}
                                {trackSessionCheckOut && summary?.hasOpenSegment ? (
                                    <span className="session-inside-dot" aria-hidden="true" title="Currently inside" />
                                ) : null}
                            </span>
                            <span className="radio-option-desc">
                                {statusParts.join(' · ')}
                            </span>
                        </label>
                    );
                })}
            </div>
        </section>
    );
}
