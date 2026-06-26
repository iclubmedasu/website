import { useState } from 'react';
import type { EventRegistrationRef, Id } from '@/types/backend-contracts';
import { formatAttendanceDayLabel } from '../../eventDateUtils';

type AttendanceRemovalTarget = {
    registration: EventRegistrationRef;
    dayLabel: string;
    kind: 'onsite';
    eventDay: string;
} | {
    registration: EventRegistrationRef;
    dayLabel: string;
    kind: 'online';
    sessionAttendanceId: Id;
};

interface AttendanceChipItem {
    key: string;
    label: string;
    className: string;
    removalTarget?: AttendanceRemovalTarget;
}

interface CollapsibleAttendanceChipsProps {
    registration: EventRegistrationRef;
    sessionDateById: Map<string, string>;
    canRemoveAttendance: boolean;
    collapsible: boolean;
    onRequestRemoval: (target: AttendanceRemovalTarget) => void;
}

function buildAttendanceChips(
    registration: EventRegistrationRef,
    sessionDateById: Map<string, string>,
    canRemoveAttendance: boolean,
): AttendanceChipItem[] {
    const chips: AttendanceChipItem[] = [];

    registration.attendanceDays?.forEach((day) => {
        const dayLabel = formatAttendanceDayLabel(day.eventDay);
        const chipLabel = `Onsite · ${dayLabel}`;
        chips.push({
            key: `onsite-${day.eventDay}`,
            label: chipLabel,
            className: canRemoveAttendance
                ? 'event-attendance-day-chip event-attendance-day-chip--removable'
                : 'event-attendance-day-chip',
            removalTarget: canRemoveAttendance ? {
                registration,
                kind: 'onsite',
                eventDay: day.eventDay,
                dayLabel: chipLabel,
            } : undefined,
        });
    });

    registration.sessionAttendances?.forEach((attendance) => {
        const sessionDate = sessionDateById.get(String(attendance.sessionId));
        const dayLabel = sessionDate ? formatAttendanceDayLabel(sessionDate) : 'Session';
        const chipLabel = `Online · ${dayLabel}`;
        const className = [
            'event-attendance-day-chip',
            canRemoveAttendance ? 'event-attendance-day-chip--removable' : '',
            'event-attendance-day-chip--online',
        ].filter(Boolean).join(' ');
        chips.push({
            key: `online-${attendance.id}`,
            label: chipLabel,
            className,
            removalTarget: canRemoveAttendance ? {
                registration,
                kind: 'online',
                sessionAttendanceId: attendance.id,
                dayLabel: chipLabel,
            } : undefined,
        });
    });

    return chips;
}

function renderChip(
    chip: AttendanceChipItem,
    onRequestRemoval: (target: AttendanceRemovalTarget) => void,
) {
    if (chip.removalTarget) {
        return (
            <button
                key={chip.key}
                type="button"
                className={chip.className}
                title={`Remove check-in for ${chip.label}`}
                onClick={() => onRequestRemoval(chip.removalTarget!)}
            >
                {chip.label}
                <span className="event-attendance-day-chip__remove" aria-hidden="true">×</span>
            </button>
        );
    }

    return (
        <span key={chip.key} className={chip.className}>
            {chip.label}
        </span>
    );
}

export default function CollapsibleAttendanceChips({
    registration,
    sessionDateById,
    canRemoveAttendance,
    collapsible,
    onRequestRemoval,
}: CollapsibleAttendanceChipsProps) {
    const [expanded, setExpanded] = useState(false);
    const chips = buildAttendanceChips(registration, sessionDateById, canRemoveAttendance);

    if (chips.length === 0) return <>—</>;

    const shouldCollapse = collapsible && chips.length > 1 && !expanded;
    const hiddenLabels = chips.slice(1).map((chip) => chip.label).join(', ');

    return (
        <span className={[
            'event-attendance-days',
            shouldCollapse ? 'event-attendance-days--collapsed' : '',
        ].filter(Boolean).join(' ')}>
            {shouldCollapse ? (
                <>
                    {renderChip(chips[0], onRequestRemoval)}
                    <button
                        type="button"
                        className="event-attendance-day-chip event-attendance-day-chip--more"
                        aria-expanded={false}
                        title={hiddenLabels}
                        onClick={() => setExpanded(true)}
                    >
                        …
                    </button>
                </>
            ) : (
                <>
                    {chips.map((chip) => renderChip(chip, onRequestRemoval))}
                    {collapsible && chips.length > 1 ? (
                        <button
                            type="button"
                            className="event-attendance-day-chip event-attendance-day-chip--more"
                            aria-expanded
                            title="Show fewer attendance chips"
                            onClick={() => setExpanded(false)}
                        >
                            …
                        </button>
                    ) : null}
                </>
            )}
        </span>
    );
}

export type { AttendanceRemovalTarget };
