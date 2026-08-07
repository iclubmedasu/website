import type { EventRegistrationRef, EventSessionRef, Id } from '@/types/backend-contracts';
import { formatDurationMinutes, sumSegmentDurations } from '@iclub/shared/utils';
import { formatAttendanceDayLabel } from '../../eventDateUtils';
import CollapsibleChipGroup, { type CollapsibleChipItem } from './CollapsibleChipGroup';

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
    sessions?: EventSessionRef[];
    trackSessionCheckOut?: boolean;
    canRemoveAttendance: boolean;
    collapsible: boolean;
    onRequestRemoval: (target: AttendanceRemovalTarget) => void;
}

function buildAttendanceChips(
    registration: EventRegistrationRef,
    sessionDateById: Map<string, string>,
    sessions: EventSessionRef[] | undefined,
    trackSessionCheckOut: boolean,
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

    if (trackSessionCheckOut) {
        const bySession = new Map<string, NonNullable<EventRegistrationRef['sessionAttendances']>>();
        for (const attendance of registration.sessionAttendances ?? []) {
            const key = String(attendance.sessionId);
            const list = bySession.get(key) ?? [];
            list.push(attendance);
            bySession.set(key, list);
        }

        for (const [sessionId, segments] of bySession) {
            const sessionDate = sessionDateById.get(sessionId);
            const session = sessions?.find((entry) => String(entry.id) === sessionId);
            const dayLabel = sessionDate
                ? formatAttendanceDayLabel(sessionDate)
                : (session?.label?.trim() || 'Session');
            const online = segments.some((segment) => segment.mode === 'ONLINE')
                && !segments.some((segment) => segment.mode === 'ONSITE');
            const onsiteSegments = segments.filter((segment) => segment.mode === 'ONSITE');
            const endBySession = session?.endDateTime ?? null;
            const agg = sumSegmentDurations(
                onsiteSegments.map((segment) => ({
                    joinedAt: segment.joinedAt,
                    checkedOutAt: segment.checkedOutAt ?? null,
                    sessionEndDateTime: endBySession,
                })),
            );
            const hasOpen = onsiteSegments.some(
                (segment) => segment.isOpen === true || segment.checkedOutAt == null,
            );
            const durationLabel = trackSessionCheckOut && onsiteSegments.length > 0
                ? ` · ${formatDurationMinutes(agg.totalMinutes)}`
                : '';
            const insideLabel = hasOpen && !online ? ' · inside' : '';
            const capLabel = agg.wasVirtuallyCapped ? ' · capped' : '';
            const modeLabel = online ? 'Online' : 'Onsite';
            const chipLabel = `${modeLabel} · ${dayLabel}${durationLabel}${insideLabel}${capLabel}`;
            const className = [
                'event-attendance-day-chip',
                canRemoveAttendance ? 'event-attendance-day-chip--removable' : '',
                online ? 'event-attendance-day-chip--online' : '',
                hasOpen && !online ? 'event-attendance-day-chip--inside' : '',
                agg.wasVirtuallyCapped ? 'event-attendance-day-chip--capped' : '',
            ].filter(Boolean).join(' ');
            // For removal, remove the most recent segment (or the open one if present)
            const removable = onsiteSegments.find((s) => s.checkedOutAt == null)
                ?? segments[segments.length - 1];
            chips.push({
                key: `session-${sessionId}`,
                label: chipLabel,
                className,
                removalTarget: canRemoveAttendance && removable ? {
                    registration,
                    kind: 'online',
                    sessionAttendanceId: removable.id,
                    dayLabel: chipLabel,
                } : undefined,
            });
        }
        return chips;
    }

    registration.sessionAttendances?.forEach((attendance) => {
        const sessionDate = sessionDateById.get(String(attendance.sessionId));
        const dayLabel = sessionDate ? formatAttendanceDayLabel(sessionDate) : 'Session';
        const isOnline = attendance.mode === 'ONLINE';
        const chipLabel = `${isOnline ? 'Online' : 'Onsite'} · ${dayLabel}`;
        const className = [
            'event-attendance-day-chip',
            canRemoveAttendance ? 'event-attendance-day-chip--removable' : '',
            isOnline ? 'event-attendance-day-chip--online' : '',
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
        <span className={chip.className}>
            {chip.label}
        </span>
    );
}

export default function CollapsibleAttendanceChips({
    registration,
    sessionDateById,
    sessions,
    trackSessionCheckOut = false,
    canRemoveAttendance,
    collapsible,
    onRequestRemoval,
}: CollapsibleAttendanceChipsProps) {
    const chips = buildAttendanceChips(
        registration,
        sessionDateById,
        sessions,
        trackSessionCheckOut,
        canRemoveAttendance,
    );
    const collapsibleChips: CollapsibleChipItem[] = chips.map((chip) => ({
        key: chip.key,
        label: chip.label,
        node: renderChip(chip, onRequestRemoval),
    }));

    return (
        <CollapsibleChipGroup
            chips={collapsibleChips}
            collapsible={collapsible}
            collapseTitle="Show fewer attendance chips"
        />
    );
}

export type { AttendanceRemovalTarget };
