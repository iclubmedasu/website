import { useMemo } from 'react';
import { getProfilePhotoUrl } from '../../../../services/api';
import './ScheduleTimetable.css';

const DEFAULT_MEMBER_COLUMN_WIDTH = 180;
const DEFAULT_HOUR_WIDTH = 56;

function getDateOrNull(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function getLocalDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function getTimelineMinuteOffset(date, dayIndexByKey) {
    const dayKey = getLocalDateKey(date);
    const dayIndex = dayIndexByKey.get(dayKey);
    if (dayIndex == null) return null;

    const minutesWithinDay = (date.getHours() * 60) + date.getMinutes() + (date.getSeconds() / 60);
    return (dayIndex * 24 * 60) + minutesWithinDay;
}

function formatDateLabel(value) {
    const date = getDateOrNull(value);
    if (!date) return '—';
    return date.toLocaleDateString([], { month: 'short', day: '2-digit' });
}

function formatHourLabel(value) {
    const date = getDateOrNull(value);
    if (!date) return '—';
    return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function formatClockRange(start, end) {
    const startDate = getDateOrNull(start);
    const endDate = getDateOrNull(end);
    if (!startDate || !endDate) return '—';

    const formatClock = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `${formatClock(startDate)} - ${formatClock(endDate)}`;
}

function formatDateTimeRange(start, end) {
    const startDate = getDateOrNull(start);
    const endDate = getDateOrNull(end);
    if (!startDate || !endDate) return '—';
    return `${startDate.toLocaleString()} → ${endDate.toLocaleString()}`;
}

function groupSlotsByMember(slots = []) {
    const groups = new Map();

    for (const slot of slots) {
        const member = slot?.member || { id: slot?.memberId ?? `slot-${slot?.id}`, fullName: 'Unknown member' };
        const key = member.id ?? `slot-${slot?.id}`;
        if (!groups.has(key)) {
            groups.set(key, { key, member, slots: [] });
        }
        groups.get(key).slots.push(slot);
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            slots: group.slots.sort((a, b) => {
                const startA = getDateOrNull(a.startDateTime)?.getTime() ?? 0;
                const startB = getDateOrNull(b.startDateTime)?.getTime() ?? 0;
                return startA - startB;
            }),
        }))
        .sort((a, b) => (a.member?.fullName ?? '').localeCompare(b.member?.fullName ?? ''));
}

function buildTimeline(slots = [], memberColumnWidth = DEFAULT_MEMBER_COLUMN_WIDTH, hourWidth = DEFAULT_HOUR_WIDTH) {
    const visibleDays = [];
    const seenDays = new Set();

    for (const slot of slots) {
        const slotStart = getDateOrNull(slot?.startDateTime);
        const slotEnd = getDateOrNull(slot?.endDateTime);
        if (!slotStart || !slotEnd) continue;

        let cursor = startOfDay(slotStart);
        const finalDay = startOfDay(slotEnd);

        while (cursor <= finalDay) {
            const dayKey = getLocalDateKey(cursor);
            if (!seenDays.has(dayKey)) {
                seenDays.add(dayKey);
                visibleDays.push(new Date(cursor));
            }
            cursor = addDays(cursor, 1);
        }
    }

    if (visibleDays.length === 0) return null;

    visibleDays.sort((a, b) => a.getTime() - b.getTime());

    const dayIndexByKey = new Map(visibleDays.map((day, index) => [getLocalDateKey(day), index]));
    const columns = [];
    const dayGroups = [];

    for (const day of visibleDays) {
        dayGroups.push({
            key: getLocalDateKey(day),
            label: formatDateLabel(day),
            span: 24,
        });

        for (let hour = 0; hour < 24; hour++) {
            const start = new Date(day);
            start.setHours(hour, 0, 0, 0);
            columns.push({
                key: `${getLocalDateKey(day)}-${String(hour).padStart(2, '0')}`,
                start,
                label: formatHourLabel(start),
            });
        }
    }

    const totalHours = visibleDays.length * 24;
    const totalMinutes = Math.max(totalHours * 60, 60);
    const minuteWidth = hourWidth / 60;

    return {
        visibleDays,
        columns,
        dayGroups,
        minuteWidth,
        trackWidth: totalMinutes * minuteWidth,
        totalWidth: memberColumnWidth + (totalMinutes * minuteWidth),
        toPixelOffset(value) {
            const date = getDateOrNull(value);
            if (!date) return null;
            const minuteOffset = getTimelineMinuteOffset(date, dayIndexByKey);
            if (minuteOffset == null) return null;
            return minuteOffset * minuteWidth;
        },
    };
}

export default function ScheduleTimetable({
    slots = [],
    emptyMessage = 'No schedule slots available.',
    memberColumnWidth = DEFAULT_MEMBER_COLUMN_WIDTH,
    hourWidth = DEFAULT_HOUR_WIDTH,
    className = '',
    showMemberAvatar = true,
    slotTimeFormatter = formatClockRange,
    slotTooltipFormatter = formatDateTimeRange,
}) {
    const groupedSlots = useMemo(() => groupSlotsByMember(slots), [slots]);
    const timeline = useMemo(() => buildTimeline(slots, memberColumnWidth, hourWidth), [slots, memberColumnWidth, hourWidth]);

    if (!timeline) {
        return <div className={`schedule-timetable-empty${className ? ` ${className}` : ''}`}>{emptyMessage}</div>;
    }

    const memberWidthRem = `${memberColumnWidth / 16}rem`;
    const hourWidthRem = `${hourWidth / 16}rem`;

    return (
        <div
            className={`schedule-timetable${className ? ` ${className}` : ''}`}
            style={{
                '--schedule-timetable-member-width': memberWidthRem,
                '--schedule-timetable-hour-width': hourWidthRem,
                '--schedule-timetable-minute-width': `${timeline.minuteWidth}px`,
            }}
        >
            <div className="schedule-timetable-shell">
                <div className="schedule-timetable-grid" style={{ minWidth: `${timeline.totalWidth}px` }}>
                    <div className="schedule-timetable-axis-row schedule-timetable-axis-row--dates">
                        <div className="schedule-timetable-axis-stub">Date</div>
                        <div
                            className="schedule-timetable-axis-strip schedule-timetable-axis-strip--dates"
                            style={{ gridTemplateColumns: `repeat(${timeline.columns.length}, var(--schedule-timetable-hour-width))` }}
                        >
                            {timeline.dayGroups.map((group) => (
                                <div
                                    key={group.key}
                                    className="schedule-timetable-date-group"
                                    style={{ gridColumn: `span ${group.span}` }}
                                >
                                    {group.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="schedule-timetable-axis-row schedule-timetable-axis-row--hours">
                        <div className="schedule-timetable-axis-stub">Time</div>
                        <div
                            className="schedule-timetable-axis-strip schedule-timetable-axis-strip--hours"
                            style={{ gridTemplateColumns: `repeat(${timeline.columns.length}, var(--schedule-timetable-hour-width))` }}
                        >
                            {timeline.columns.map((column) => (
                                <div key={column.key} className="schedule-timetable-hour-cell">
                                    {column.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="schedule-timetable-member-list">
                        {groupedSlots.map((group) => (
                            <div
                                key={group.key}
                                className="schedule-timetable-member-row"
                                style={{ minWidth: `${timeline.totalWidth}px` }}
                            >
                                <div className="schedule-timetable-member-info">
                                    {showMemberAvatar && (
                                        <span className="schedule-timetable-member-avatar">
                                            {group.member?.profilePhotoUrl ? (
                                                <img src={getProfilePhotoUrl(group.member.id)} alt={group.member.fullName || 'Member'} />
                                            ) : (
                                                (group.member?.fullName || '?').charAt(0).toUpperCase()
                                            )}
                                        </span>
                                    )}
                                    <div className="schedule-timetable-member-copy">
                                        <strong>{group.member?.fullName || 'Unknown member'}</strong>
                                        <span>{group.slots.length} slot{group.slots.length === 1 ? '' : 's'}</span>
                                    </div>
                                </div>

                                <div className="schedule-timetable-track" style={{ width: `${timeline.trackWidth}px` }}>
                                    <div className="schedule-timetable-track-grid" />
                                    {group.slots.map((slot) => {
                                        const slotStart = getDateOrNull(slot.startDateTime);
                                        const slotEnd = getDateOrNull(slot.endDateTime);
                                        if (!slotStart || !slotEnd) return null;

                                        const left = timeline.toPixelOffset(slot.startDateTime);
                                        const right = timeline.toPixelOffset(slot.endDateTime);
                                        if (left == null || right == null) return null;

                                        const width = Math.max(2, right - left);
                                        const label = slot.title || slot.task?.title || 'Time slot';

                                        return (
                                            <div
                                                key={slot.id}
                                                className={`schedule-timetable-bar${slot.isActive === false ? ' schedule-timetable-bar--inactive' : ''}`}
                                                style={{ left: `${left}px`, width: `${width}px` }}
                                                title={slotTooltipFormatter(slot.startDateTime, slot.endDateTime)}
                                            >
                                                <span className="schedule-timetable-bar-title">{label}</span>
                                                <span className="schedule-timetable-bar-time">{slotTimeFormatter(slot.startDateTime, slot.endDateTime)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}